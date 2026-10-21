/**
 * The worker screen: the Jeera queue, the open ticket, the terminal, chat
 * and tools. Progress is saved in this browser only (see storage.ts).
 */
import { startJonkins } from './jonkins';
import { initLayout, resetLayout } from './layout';
import { gitFiles, gitLog } from './sprint2';
import { sprints } from './sprints';
import { clearSprint, loadGame, loadSprint, saveGame, saveSprint, type SprintProgress } from './storage';
import type { CheckResult, Person, Ticket, VMs } from './types';
import { GameVM } from './vm';

const PASSWORD = 'Welcome1';
const PADLOCK =
	'<svg aria-hidden="true" viewBox="0 0 16 16" width="12" height="12"><path fill="currentColor" d="M4 7V5a4 4 0 0 1 8 0v2h1v8H3V7zm2 0h4V5a2 2 0 0 0-4 0z"/></svg>';
// Accounts that already exist on the servers, or belong to the cast.
const TAKEN = ['root', 'learner', 'sandra', 'kev', 'brant', 'derek', 'priya', 'tom', 'admin', 'nobody', 'sshd', 'daemon', 'bin', 'nginx', 'git'];

/** Returns why a username can't be used, or null if it's fine. */
function usernameProblem(name: string): string | null {
	if (!/^[a-z][a-z0-9]{1,15}$/.test(name)) return 'Use 2 to 16 lowercase letters and numbers, starting with a letter.';
	if (TAKEN.includes(name)) return `${name} is already taken at Darts Unlimited. Pick another.`;
	return null;
}

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const el = (tag: string, cls?: string, text?: string) => {
	const e = document.createElement(tag);
	if (cls) e.className = cls;
	if (text !== undefined) e.textContent = text;
	return e;
};

/** The GitBit panel: shows what has been pushed to the gitbit server. */
function startGitBit(vm: GameVM, user: string) {
	$('#gitbit').hidden = false;
	$('#gitbit-repo').textContent = `${user} / darts-shop`;
	const body = $('#gitbit-body');
	let last = '';
	const refresh = async () => {
		const [log, files] = await Promise.all([gitLog(vm, 'darts-shop'), gitFiles(vm, 'darts-shop')]);
		const key = JSON.stringify([log, files]);
		if (key === last) return;
		last = key;
		body.replaceChildren();
		if (!log.length) {
			body.append(el('p', '', 'This repository is empty. Push to it from web01 to see your commits here.'));
			return;
		}
		body.append(el('p', '', `${log.length} ${log.length === 1 ? 'commit' : 'commits'} on main`));
		const ol = el('ol');
		for (const c of log) {
			const li = el('li');
			li.append(el('span', 'hash', c.hash.slice(0, 7)), el('span', '', c.subject), el('span', 'who', c.author));
			ol.append(li);
		}
		body.append(ol, el('p', 'files', `Files: ${files.join(', ')}`));
	};
	void refresh();
	setInterval(() => void refresh(), 3000);
}

export function startDesk() {
	const root = $('.workspace');
	const layout = initLayout(root);
	const base = root.dataset.vmBase!;
	const game = loadGame();
	const sprint = sprints.find((s) => s.number === game.current) ?? sprints[0];
	const { tickets } = sprint;
	const progress: SprintProgress = loadSprint(sprint.number);
	const vms: VMs = Object.fromEntries(sprint.servers.map((s) => [s.name, new GameVM()]));
	const main = sprint.servers.find((s) => s.terminal) ?? sprint.servers[0];
	let selected: string | null = null;
	const revealed: Record<string, number> = {};
	const lastResult: Record<string, CheckResult> = {};
	const save = () => saveSprint(sprint.number, progress);

	// Labels that depend on the sprint.
	$('#sprint-name').textContent = `Sprint ${sprint.number}: ${sprint.title}`;
	$('#h-queue').textContent = `Jeera: sprint ${sprint.number}`;
	$('#h-term').textContent = `Terminal: ${main.name}`;
	document.querySelectorAll<HTMLElement>('[data-unlocks]').forEach((t) => {
		const n = Number(t.dataset.unlocks);
		t.classList.toggle('locked', n > sprint.number);
		t.querySelector('.unlock')!.textContent = n > sprint.number ? `Sprint ${n}` : 'In use';
	});

	// Game clock: Monday 09:00, three minutes per message.
	const clock = () => {
		const mins = 9 * 60 + progress.chat.length * 3;
		return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
	};

	const blockers = (t: Ticket) => (t.blockedBy ?? []).filter((id) => !progress.done.includes(id));
	const arrived = () =>
		tickets.filter((t) => t.arrivesAfter === undefined || progress.done.filter((d) => d !== t.id).length >= t.arrivesAfter);

	// Chat
	const chatLog = $('#chat-log');
	const renderMessage = (m: SprintProgress['chat'][number]) => {
		const li = el('li', `msg from-${m.from.toLowerCase()}`);
		const head = el('p', 'msg-head');
		head.append(el('strong', '', m.from), el('span', 'time', m.time));
		li.append(head);
		for (const para of m.text.split('\n\n')) {
			li.append(el(para.includes('=') && !para.includes(' ') ? 'pre' : 'p', 'msg-text', para));
		}
		chatLog.append(li);
		chatLog.scrollTop = chatLog.scrollHeight;
	};
	const say = (from: Person, text: string) => {
		const m = { from, text, time: clock() };
		progress.chat.push(m);
		save();
		renderMessage(m);
		const tab = document.querySelector<HTMLElement>('[data-tab="panel-chat"]');
		if (tab?.getAttribute('aria-selected') !== 'true') tab?.classList.add('unread');
	};
	const sayLater = (lines: { from: Person; text: string }[], gap = 900) =>
		lines.reduce<Promise<void>>(
			(p, l) => p.then(() => new Promise((r) => setTimeout(() => (say(l.from, l.text), r()), gap))),
			Promise.resolve(),
		);

	// Queue
	const renderQueue = () => {
		const list = arrived();
		const total = list.reduce((a, t) => a + t.points, 0);
		const left = list.filter((t) => !progress.done.includes(t.id)).reduce((a, t) => a + t.points, 0);
		$('#burndown-text').textContent = `${left} of ${total} points left`;
		$<HTMLProgressElement>('#burndown').value = total - left;
		$<HTMLProgressElement>('#burndown').max = total;
		$('#top-burndown').textContent = `${left} of ${total} points left`;

		const cols: Record<string, Ticket[]> = { todo: [], doing: [], done: [] };
		for (const t of list) {
			if (progress.done.includes(t.id)) cols.done.push(t);
			else if (progress.opened.includes(t.id)) cols.doing.push(t);
			else cols.todo.push(t);
		}
		for (const [col, items] of Object.entries(cols)) {
			const ul = $(`#col-${col}`);
			ul.replaceChildren();
			$(`#count-${col}`).textContent = String(items.length);
			for (const t of items) {
				const li = el('li');
				const blocked = progress.done.includes(t.id) ? [] : blockers(t);
				const b = el(
					'button',
					`card${t.interruption ? ' interruption' : ''}${blocked.length ? ' blocked' : ''}${selected === t.id ? ' selected' : ''}`,
				);
				b.setAttribute('type', 'button');
				b.append(el('span', 'card-id', t.id), el('span', 'card-title', t.title));
				const meta = el('span', 'card-meta');
				meta.append(el('span', '', `From ${t.from}`), el('span', 'points', String(t.points)));
				b.append(meta);
				if (t.interruption && !progress.done.includes(t.id)) b.append(el('span', 'flag', 'Interruption'));
				if (blocked.length) {
					const tag = el('span', 'blocked-by');
					tag.innerHTML = PADLOCK;
					tag.append(document.createTextNode(`Blocked by ${blocked.join(', ')}`));
					b.append(tag);
				}
				b.addEventListener('click', () => openTicket(t.id));
				li.append(b);
				ul.append(li);
			}
		}
		const allDone = list.length === tickets.length && list.every((t) => progress.done.includes(t.id));
		$('#review').hidden = !allDone;
		$('#review').textContent = progress.promoted ? 'Sprint done: see your promotion' : 'Go to sprint review';
	};

	// Ticket
	// Shows a result on ticket `id`, if it is still the one on screen.
	const result = (id: string, r: CheckResult) => {
		lastResult[id] = r;
		if (selected !== id) return;
		const out = $('#ticket-result');
		out.textContent = r.message;
		out.className = `result ${r.ok ? 'pass' : 'fail'}`;
	};
	const complete = (t: Ticket) => {
		if (progress.done.includes(t.id)) return;
		const before = arrived().length;
		const waiting = arrived().filter((x) => !progress.done.includes(x.id) && blockers(x).length);
		progress.done.push(t.id);
		save();
		say(t.from, t.thanks);
		renderQueue();
		renderTicket();
		for (const n of arrived().slice(before)) {
			for (const [server, script] of Object.entries(n.onArrive ?? {})) void vms[server]?.exec(script);
			setTimeout(() => {
				say(n.from, `${n.title}${/[?!.]$/.test(n.title) ? '' : '.'} ${n.body[0]}`);
				document.querySelector('[data-tab="panel-queue"]')?.classList.add('unread');
			}, 1500);
		}
		for (const n of waiting.filter((x) => !blockers(x).length)) {
			setTimeout(() => say(n.from, `${t.id} is done, so ${n.id} is unblocked. ${n.title}: over to you.`), 1500);
		}
		if (progress.done.length === tickets.length) void sayLater(sprint.done, 1500);
	};

	// The "Stuck?" coach: checks which steps are already done on the servers,
	// then shows the next one. Each press reveals one more step.
	const coach = async () => {
		const t = tickets.find((x) => x.id === selected);
		if (!t || progress.done.includes(t.id)) return;
		const btn = $<HTMLButtonElement>('#stuck');
		btn.disabled = true;
		const states = await Promise.all(t.steps.map((s) => (s.done ? s.done(vms).catch(() => false) : null)));
		btn.disabled = false;
		if (selected !== t.id) return;
		const shown = revealed[t.id] ?? 0;
		let next = states.findIndex((d, i) => d === false || (d === null && i >= shown));
		if (next === -1) next = t.steps.length - 1;
		revealed[t.id] = Math.min(t.steps.length, Math.max(shown + 1, next + 1));
		renderCoach(t, states);
		document.querySelector('#coach')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
	};
	const renderCoach = (t: Ticket, states: (boolean | null)[] = []) => {
		const box = document.querySelector('#coach');
		if (!box) return;
		box.replaceChildren();
		const shown = revealed[t.id] ?? 0;
		if (!shown) return;
		box.append(el('h4', '', 'Stuck? Here is what to do'));
		const ol = el('ol', 'steps');
		t.steps.slice(0, shown).forEach((s, i) => {
			const done = states[i] === true;
			const li = el('li', done ? 'done' : i === shown - 1 ? 'current' : '');
			const label = el('p', 'step-text');
			if (done) label.append(el('strong', '', 'Done. '));
			label.append(document.createTextNode(s.text));
			li.append(label);
			if (s.cmd && !done) li.append(el('pre', 'cmd', s.cmd));
			ol.append(li);
		});
		box.append(ol);
		if (shown < t.steps.length)
			box.append(el('p', 'more', `Step ${shown} of ${t.steps.length}. Press Stuck? again for the next step.`));
	};

	const renderTicket = () => {
		const pane = $('#ticket-body');
		pane.replaceChildren();
		const stuck = $<HTMLButtonElement>('#stuck');
		const t = tickets.find((x) => x.id === selected);
		stuck.hidden = !t || progress.done.includes(t.id);
		if (!t) {
			pane.append(el('p', 'empty', 'Pick a ticket from the queue to start work on it.'));
			return;
		}
		const done = progress.done.includes(t.id);
		const blocked = done ? [] : blockers(t);
		stuck.hidden ||= blocked.length > 0;
		const head = el('div', 'ticket-head');
		head.append(el('span', 'card-id', t.id), el('h3', 'ticket-title', t.title));
		head.append(el('p', 'ticket-meta', `From ${t.from}. ${t.points} ${t.points === 1 ? 'point' : 'points'}.${done ? ' Done.' : ''}`));
		pane.append(head);
		for (const para of t.body) pane.append(el('p', '', para));

		if (blocked.length) {
			const note = el('div', 'blocked-note');
			note.append(el('strong', '', 'Blocked. '));
			note.append(
				document.createTextNode(
					`This ticket needs ${blocked.map((id) => `${id} (${tickets.find((x) => x.id === id)?.title ?? id})`).join(' and ')} done first. You can read it now, and work it once it's unblocked.`,
				),
			);
			pane.append(note);
			return;
		}

		const actions = el('div', 'actions');
		if (!done) {
			if (t.answer) {
				const form = el('form', 'answer') as HTMLFormElement;
				const id = `answer-${t.id}`;
				const label = el('label', '', t.answer.label);
				label.setAttribute('for', id);
				const input = el('input') as HTMLInputElement;
				input.id = id;
				input.autocomplete = 'off';
				input.spellcheck = false;
				const submit = el('button', 'btn', 'Send answer');
				submit.setAttribute('type', 'submit');
				form.append(label, input, submit);
				form.addEventListener('submit', (e) => {
					e.preventDefault();
					const r = t.answer!.check(input.value);
					result(t.id, r);
					if (r.ok) complete(t);
				});
				actions.append(form);
			}
			if (t.check) {
				const b = el('button', 'btn', 'Check my work');
				b.setAttribute('type', 'button');
				b.addEventListener('click', async () => {
					b.setAttribute('disabled', '');
					b.textContent = 'Checking…';
					const r = await t.check!(vms);
					b.removeAttribute('disabled');
					b.textContent = 'Check my work';
					result(t.id, r);
					if (r.ok) complete(t);
				});
				actions.append(b);
			}
			for (const c of t.choices ?? []) {
				const b = el('button', 'btn secondary', c.label);
				b.setAttribute('type', 'button');
				b.addEventListener('click', () => {
					result(t.id, c.result);
					if (c.result.ok) complete(t);
				});
				actions.append(b);
			}
			if (t.ask) {
				const b = el('button', 'btn secondary', t.ask.label);
				b.setAttribute('type', 'button');
				b.addEventListener('click', () => {
					b.remove();
					void sayLater(t.ask!.reply.map((text) => ({ from: t.from, text })), 700);
				});
				actions.append(b);
			}
		}
		pane.append(actions);
		const out = el('p', 'result');
		out.id = 'ticket-result';
		out.setAttribute('role', 'status');
		if (done) {
			const last = lastResult[t.id];
			out.textContent = last?.ok ? `Closed. ${last.message}` : 'Closed.';
			out.className = 'result pass';
		}
		pane.append(out);
		if (!done) {
			const box = el('div', 'coach');
			box.id = 'coach';
			box.setAttribute('aria-live', 'polite');
			pane.append(box);
			renderCoach(t);
		}
	};

	const openTicket = (id: string) => {
		selected = id;
		const t = tickets.find((x) => x.id === id)!;
		if (!progress.opened.includes(id) && !blockers(t).length) {
			progress.opened.push(id);
			save();
			if (!progress.done.includes(id)) say(t.from, t.opened);
		}
		renderQueue();
		renderTicket();
		layout.show('panel-ticket');
	};
	$('#stuck').addEventListener('click', () => void coach());

	// Sprint review: the retro, then promotion.
	const review = $<HTMLDialogElement>('#review-dialog');
	$('#review').addEventListener('click', () => {
		// Passed already: straight to the promotion.
		if (progress.promoted) {
			$('#review-intro').textContent = `You passed the sprint ${sprint.number} retro.`;
			$('#retro-form').hidden = true;
			review.showModal();
			showPromotion();
			return;
		}
		const form = $('#retro-form');
		form.replaceChildren();
		sprint.retro.forEach((q, qi) => {
			const fs = el('fieldset');
			fs.append(el('legend', '', q.question));
			q.options.forEach((o, oi) => {
				const label = el('label', 'option');
				const input = el('input') as HTMLInputElement;
				input.type = 'radio';
				input.name = `q${qi}`;
				input.value = String(oi);
				input.required = true;
				label.append(input, document.createTextNode(` ${o}`));
				fs.append(label);
			});
			fs.append(el('p', 'why'));
			form.append(fs);
		});
		const submit = el('button', 'btn', 'Submit retro');
		submit.setAttribute('type', 'submit');
		form.append(submit);
		$('#review-intro').textContent = `Derek wants to know what you learned. Answer all ${sprint.retro.length} to finish the sprint.`;
		$('#promotion').hidden = true;
		form.hidden = false;
		review.showModal();
	});
	$('#retro-form').addEventListener('submit', (e) => {
		e.preventDefault();
		const form = e.currentTarget as HTMLFormElement;
		const data = new FormData(form);
		let right = 0;
		sprint.retro.forEach((q, qi) => {
			const ok = Number(data.get(`q${qi}`)) === q.correct;
			if (ok) right++;
			const why = form.querySelectorAll<HTMLElement>('.why')[qi];
			why.textContent = `${ok ? 'Right.' : `Not quite: ${q.options[q.correct]}.`} ${q.why}`;
			why.className = `why ${ok ? 'pass' : 'fail'}`;
		});
		if (right !== sprint.retro.length) return;
		progress.promoted = true;
		save();
		renderQueue();
		form.querySelector('button[type="submit"]')?.remove();
		showPromotion();
	});
	// The promotion, with the way into the next sprint.
	const showPromotion = () => {
		const promo = $('#promotion');
		promo.hidden = false;
		$('#promotion-title').textContent = `Promoted: stripe ${sprint.number}`;
		$('#promotion-text').textContent = `Sprint ${sprint.number} done. ${sprint.promotion}`;
		const tbody = $('#translation');
		tbody.replaceChildren();
		for (const [a, b] of sprint.translation) {
			const tr = el('tr');
			tr.append(el('th', '', a), el('td', '', b));
			tbody.append(tr);
		}
		const following = sprints.find((s) => s.number === sprint.number + 1);
		const next = $('#next-sprint');
		next.replaceChildren();
		if (following) {
			const b = el('button', 'btn', `Start sprint ${following.number}: ${following.title}`);
			b.setAttribute('type', 'button');
			b.addEventListener('click', () => {
				game.current = following.number;
				saveGame(game);
				location.reload();
			});
			next.append(el('p', '', sprint.next), b);
		} else {
			next.append(el('p', '', `${sprint.next} It's being built now.`));
		}
		promo.scrollIntoView({ behavior: 'smooth' });
	};
	$('#review-close').addEventListener('click', () => review.close());

	// Top bar
	$('#reset-layout').addEventListener('click', resetLayout);
	$('#restart').addEventListener('click', () => {
		if (!confirm(`Reset sprint ${sprint.number}? Your tickets, chat and progress for this sprint are cleared, and the servers start fresh.`))
			return;
		clearSprint(sprint.number);
		delete game.username;
		saveGame(game);
		location.reload();
	});
	const sprintPicker = $<HTMLSelectElement>('#sprint-picker');
	for (const s of sprints) {
		const reachable = s.number === 1 || loadSprint(s.number - 1).promoted;
		const o = el('option', '', `Sprint ${s.number}: ${s.title}`) as HTMLOptionElement;
		o.value = String(s.number);
		o.disabled = !reachable;
		o.selected = s.number === sprint.number;
		sprintPicker.append(o);
	}
	sprintPicker.hidden = sprints.length < 2;
	sprintPicker.addEventListener('change', () => {
		game.current = Number(sprintPicker.value);
		saveGame(game);
		location.reload();
	});
	document.querySelectorAll<HTMLElement>('[data-tab]').forEach((t) =>
		t.addEventListener('click', () => t.classList.remove('unread')),
	);

	// Restore saved chat, then clock in.
	progress.chat.forEach(renderMessage);
	renderQueue();
	renderTicket();

	const clockIn = $<HTMLDialogElement>('#clock-in');
	const nameInput = $<HTMLInputElement>('#username');
	if (game.username) nameInput.value = game.username;
	$('#clock-in-time').textContent = sprint.number === 1 ? 'Monday, 9:00am' : `Sprint ${sprint.number}, Monday, 9:00am`;
	if (sprint.number > 1) $('#clock-in-title').textContent = `Sprint ${sprint.number}: ${sprint.title}`;
	clockIn.addEventListener('cancel', (e) => e.preventDefault());
	$('#clock-in-form').addEventListener('submit', (e) => {
		e.preventDefault();
		const user = nameInput.value.trim().toLowerCase();
		const problem = usernameProblem(user);
		$('#username-error').textContent = problem ?? '';
		nameInput.setAttribute('aria-invalid', String(Boolean(problem)));
		if (problem) return;
		game.username = user;
		saveGame(game);
		clockIn.close();
		void startServers(user);
	});

	// Already clocked in before: log straight in. Reset sprint clears the name.
	if (game.username && !usernameProblem(game.username)) {
		if (progress.chat.length)
			renderMessage({
				from: 'Derek',
				text: `Morning, ${game.username}. Your tickets are where you left them. Brant restored the servers from last night's backup: anything you finished is still there, but redo any half-finished work.`,
				time: clock(),
			});
		void startServers(game.username);
	} else {
		clockIn.showModal();
	}

	async function startServers(user: string) {
		$('#h-term').textContent = `Terminal: ${user}@${main.name}`;
		if (!progress.chat.length) void sayLater(sprint.intro.map((m) => ({ ...m, text: m.text.replace('{name}', user) })), 1200);
		const status = $('#term-status');
		const hosts = sprint.servers.map((s) => `${s.ip.split('/')[0]} ${s.name}`).join('\n');
		// Tickets that arrived before a refresh, whose events must happen again.
		const waitingEvents = arrived().filter((t) => t.onArrive && !progress.done.includes(t.id));
		try {
			await Promise.all(
				sprint.servers.map((s) =>
					vms[s.name].start(s === main ? $('#term') : null, {
						base,
						name: s.name,
						ip: s.ip,
						setup: [
							s.setup,
							...tickets.filter((t) => progress.done.includes(t.id)).map((t) => t.restore?.[s.name] ?? ''),
							progress.done.length ? (sprint.afterRestore?.[s.name] ?? '') : '',
							...waitingEvents.map((t) => t.onArrive?.[s.name] ?? ''),
						].join('\n'),
						files: s.files,
						user,
						password: PASSWORD,
						hosts,
						onStatus: s === main ? (text) => (status.textContent = text) : () => undefined,
					}),
				),
			);
			vms[main.name].focus();
			if (vms.gitbit) startGitBit(vms.gitbit, user);
			if (vms.gitbit && sprint.number >= 3) startJonkins(vms.gitbit);
		} catch {
			// The status line already says what went wrong.
		}
	}
}
