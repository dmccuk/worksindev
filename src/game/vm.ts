/**
 * The terminal: real Linux in the page, using the v86 emulator (BSD-2-Clause)
 * and the Alpine image built by learndevops (labs/_browser-vm in that repo).
 *
 * The sprint's scenario is copied into the VM as a script and run as root
 * before the terminal is shown. Ticket checks read files straight from the
 * VM's filesystem, so they never type into the player's terminal.
 */
import '@xterm/xterm/css/xterm.css';
import type { Terminal } from '@xterm/xterm';
import type { FitAddon } from '@xterm/addon-fit';

export interface VMOptions {
	/** Where the VM files are served, ending in a slash */
	base: string;
	/** Hostname inside the VM */
	name: string;
	/** Address on the in-browser network, e.g. 10.5.0.21/24 */
	ip: string;
	/** Shell script run as root before the player gets the terminal. $P is the player's username. */
	setup: string;
	/** The player's username and password on the VM */
	user: string;
	password: string;
	onStatus: (text: string) => void;
}

type Emulator = {
	add_listener(event: string, fn: (value: number) => void): void;
	serial0_send(text: string): void;
	create_file(path: string, data: Uint8Array): Promise<void>;
	read_file(path: string): Promise<Uint8Array | null>;
};

export class GameVM {
	private emulator?: Emulator;
	private term?: Terminal;
	private fit?: FitAddon;

	/** Starts the VM in `el` and resolves when the player can type. */
	async start(el: HTMLElement, opts: VMOptions): Promise<void> {
		const { base } = opts;
		opts.onStatus('Loading the emulator…');

		const filesOk = await Promise.all(
			['v86.wasm', 'state.bin.zst', 'fs.json'].map((f) =>
				fetch(`${base}${f}`, { method: 'HEAD' })
					.then((r) => r.ok)
					.catch(() => false),
			),
		).then((all) => all.every(Boolean));
		if (!filesOk) {
			opts.onStatus('The Linux image is not available right now. Try again in a few minutes.');
			throw new Error('VM files missing');
		}

		const [{ V86 }, { Terminal }, { FitAddon }] = await Promise.all([
			import('v86'),
			import('@xterm/xterm'),
			import('@xterm/addon-fit'),
		]);
		// Measure the terminal font only after it has loaded, or letters misalign.
		await document.fonts.load("14px 'JetBrains Mono Variable'").catch(() => undefined);

		const term = new Terminal({
			cursorBlink: true,
			fontFamily: "'JetBrains Mono Variable', ui-monospace, monospace",
			fontSize: 14,
			theme: { background: '#10161f', foreground: '#dfe6dd', cursor: '#f2c230' },
		});
		const fit = new FitAddon();
		term.loadAddon(fit);
		term.open(el);
		fit.fit();
		this.term = term;
		this.fit = fit;
		new ResizeObserver(() => this.refit()).observe(el);
		term.write(`Logging in to ${opts.name}…\r\n`);
		opts.onStatus('Starting Linux…');

		const emulator = new V86({
			wasm_path: `${base}v86.wasm`,
			bios: { url: `${base}seabios.bin` },
			vga_bios: { url: `${base}vgabios.bin` },
			memory_size: 256 * 1024 * 1024,
			vga_memory_size: 2 * 1024 * 1024,
			initial_state: { url: `${base}state.bin.zst` },
			filesystem: { baseurl: `${base}rootfs-flat/`, basefs: `${base}fs.json` },
			net_device: { type: 'virtio', relay_url: 'inbrowser' },
			autostart: true,
			disable_keyboard: true,
			disable_mouse: true,
			disable_speaker: true,
		}) as unknown as Emulator;
		this.emulator = emulator;

		// Output is hidden while the scenario is set up, then batched into one
		// write per frame.
		let quiet = true;
		let pending: number[] = [];
		let scheduled = false;
		let tail = '';
		let waitDone: (() => void) | null = null;
		let waitFor = 'LD-42';
		emulator.add_listener('serial0-output-byte', (byte) => {
			tail = (tail + String.fromCharCode(byte)).slice(-64);
			if (waitDone && tail.includes(waitFor)) {
				const done = waitDone;
				waitDone = null;
				done();
			}
			if (quiet) return;
			pending.push(byte);
			if (!scheduled) {
				scheduled = true;
				requestAnimationFrame(() => {
					term.write(new Uint8Array(pending));
					pending = [];
					scheduled = false;
				});
			}
		});

		// The emulated serial port only buffers a few characters, so input is
		// fed in small chunks.
		let queue = '';
		let draining = false;
		const type = (text: string) => {
			queue += text;
			if (draining) return;
			draining = true;
			const drain = () => {
				if (!queue) {
					draining = false;
					return;
				}
				emulator.serial0_send(queue.slice(0, 8));
				queue = queue.slice(8);
				setTimeout(drain, 10);
			};
			drain();
		};
		// Commands end in `echo LD-$((40+2))`: "LD-42" appears only once
		// everything before it has finished, never in the echoed command.
		const run = (cmd: string) =>
			new Promise<void>((resolve) => {
				tail = '';
				waitFor = 'LD-42';
				waitDone = resolve;
				type(`${cmd}; echo LD-$((40+2))\n`);
			});
		// Types a line and waits until the output contains `text`.
		const typeUntil = (line: string, text: string) =>
			new Promise<void>((resolve) => {
				tail = '';
				waitFor = text;
				waitDone = resolve;
				type(line);
			});

		await new Promise<void>((resolve, reject) => {
			emulator.add_listener('download-error', () => reject(new Error('download failed')));
			emulator.add_listener('emulator-ready', () => resolve());
		}).catch((err) => {
			opts.onStatus('The Linux image could not be loaded. Check your connection and reload the page.');
			throw err;
		});
		await new Promise((r) => setTimeout(r, 200));

		opts.onStatus('Setting up your desk…');
		// Create the player's account, then build the sprint's scenario.
		const account = `#!/bin/sh
P=${opts.user}
adduser -D -s /bin/bash "$P"
echo "$P:${opts.password}" | chpasswd
echo "$P ALL=(ALL) ALL" > /etc/sudoers.d/desk-player && chmod 440 /etc/sudoers.d/desk-player
cat > /home/$P/.bashrc <<'EOF'
PS1='\\u@\\h:\\w\\$ '
EOF
echo '. ~/.bashrc' > /home/$P/.bash_profile
chown "$P:$P" /home/$P/.bashrc /home/$P/.bash_profile
`;
		await emulator.create_file('/tmp/.desk-setup.sh', new TextEncoder().encode(account + opts.setup));
		fit.fit();
		await run(
			`stty cols ${term.cols} rows ${term.rows}; sudo ld-net ${opts.name} ${opts.ip}; ` +
				`echo learner | sudo -S sh -c 'sh /tmp/.desk-setup.sh; rm -f /tmp/.desk-setup.sh' >/dev/null 2>&1`,
		);
		// Log in as the player. sudo still remembers the password from setup.
		await typeUntil(`exec sudo -u ${opts.user} -i\n`, `${opts.user}@${opts.name}`);

		quiet = false;
		term.reset();
		term.onData((data) => type(data));
		type('\n');
		opts.onStatus('');
	}

	/** Reads a file from the VM, or returns null if it does not exist. */
	async readFile(path: string): Promise<string | null> {
		if (!this.emulator) return null;
		try {
			const data = await this.emulator.read_file(path);
			return data ? new TextDecoder().decode(data) : null;
		} catch {
			return null;
		}
	}

	/** Size in bytes, or null if the file does not exist. */
	async fileSize(path: string): Promise<number | null> {
		if (!this.emulator) return null;
		try {
			const data = await this.emulator.read_file(path);
			return data ? data.length : null;
		} catch {
			return null;
		}
	}

	refit() {
		this.fit?.fit();
	}

	focus() {
		this.term?.focus();
	}
}
