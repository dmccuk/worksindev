/**
 * Jonkins: the build server, from sprint 3. It runs on the gitbit server as a
 * post-receive hook (see sprint3.ts), and writes its runs and console logs to
 * /var/lib/desk/jonkins. This file reads them, for the checks and the panel.
 */
import type { GameVM } from './vm';

export interface Run {
	n: number;
	status: 'RUNNING' | 'SUCCESS' | 'FAILURE';
	hash: string;
	author: string;
	subject: string;
}

const DIR = '/var/lib/desk/jonkins';

/** Every run, newest first. */
export async function jonkinsRuns(vm: GameVM): Promise<Run[]> {
	return ((await vm.readFile(`${DIR}/runs`)) ?? '')
		.split('\n')
		.filter(Boolean)
		.map((l) => {
			const [n, status, hash, author, ...rest] = l.split('|');
			return { n: Number(n), status: status as Run['status'], hash, author, subject: rest.join('|') };
		});
}

export async function jonkinsLog(vm: GameVM, n: number): Promise<string> {
	return (await vm.readFile(`${DIR}/${n}.log`)) ?? '';
}

/** Whether build.sh was executable in run n's workspace. */
export async function jonkinsExecutable(vm: GameVM, n: number): Promise<boolean> {
	return ((await vm.readFile(`${DIR}/${n}.exec`)) ?? '').trim() === 'yes';
}

/**
 * The newest build of commit `hash` once it has finished, waiting up to
 * `seconds` for it to start and finish. Without a hash, the newest build.
 * After the wait, whatever the newest build is.
 */
export async function buildOf(vm: GameVM, hash?: string, seconds = 60): Promise<Run | undefined> {
	let runs: Run[] = [];
	for (let i = 0; i < seconds; i++) {
		runs = await jonkinsRuns(vm);
		const run = hash ? runs.find((r) => hash.startsWith(r.hash)) : runs[0];
		if (run && run.status !== 'RUNNING') return run;
		await new Promise((r) => setTimeout(r, 1000));
	}
	return runs[0];
}

const el = (tag: string, cls?: string, text?: string) => {
	const e = document.createElement(tag);
	if (cls) e.className = cls;
	if (text !== undefined) e.textContent = text;
	return e;
};

/** The Jonkins panel: the build history, and the console of the chosen run. */
export function startJonkins(vm: GameVM) {
	const box = document.querySelector<HTMLElement>('#jonkins')!;
	const list = box.querySelector<HTMLElement>('#jonkins-runs')!;
	const console_ = box.querySelector<HTMLElement>('#jonkins-console')!;
	const heading = box.querySelector<HTMLElement>('#jonkins-console-title')!;
	box.hidden = false;
	// null follows the newest run.
	let chosen: number | null = null;
	let lastRuns = '';
	let lastLog = '';
	const refresh = async () => {
		const runs = await jonkinsRuns(vm);
		const key = JSON.stringify([runs, chosen]);
		if (key !== lastRuns) {
			lastRuns = key;
			list.replaceChildren();
			if (!runs.length) list.append(el('li', 'empty', 'No builds yet. Push a Jonkinsfile to GitBit and Jonkins builds it.'));
			for (const r of runs) {
				const li = el('li');
				const b = el('button', `run${(chosen ?? runs[0].n) === r.n ? ' chosen' : ''}`);
				b.setAttribute('type', 'button');
				b.append(
					el('span', 'run-n', `#${r.n}`),
					el('span', `status ${r.status.toLowerCase()}`, r.status === 'RUNNING' ? 'Running' : r.status === 'SUCCESS' ? 'Passed' : 'Failed'),
					el('span', 'run-what', `${r.hash} ${r.subject}`),
					el('span', 'run-who', r.author),
				);
				b.addEventListener('click', () => {
					chosen = r.n === runs[0].n ? null : r.n;
					lastLog = '';
					void refresh();
				});
				li.append(b);
				list.append(li);
			}
		}
		const n = chosen ?? runs[0]?.n;
		heading.textContent = n ? `Console output, build #${n}` : 'Console output';
		const log = n ? await jonkinsLog(vm, n) : '';
		if (log !== lastLog) {
			lastLog = log;
			console_.textContent = log || 'Nothing yet.';
			console_.scrollTop = console_.scrollHeight;
		}
	};
	void refresh();
	setInterval(() => void refresh(), 2500);
}
