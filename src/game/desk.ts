/**
 * The worker screen: the Jeera queue, the open ticket, the terminal, chat
 * and tools. Progress is saved in this browser only.
 */
import { initLayout, resetLayout } from './layout';
import { retro, setup, sprint, tickets, translation, type CheckResult, type Person, type Ticket } from './sprint1';
import { GameVM } from './vm';

const STORE = 'wid-sprint1';

interface Progress {
	done: string[];
	opened: string[];
	chat: { from: Person; text: string; time: string }[];
	promoted: boolean;
	username?: string;
}

const PASSWORD = 'Welcome1';
// Accounts that already exist on web01, or belong to the cast.
const TAKEN = ['root', 'learner', 'sandra', 'kev', 'brant', 'derek', 'priya', 'tom', 'admin', 'nobody', 'sshd', 'daemon', 'bin'];

/** Returns why a username can't be used, or null if it's fine. */
function usernameProblem(name: string): string | null {
	if (!/^[a-z][a-z0-9]{1,15}$/.test(name))
		return 'Use 2 to 16 lowercase letters and numbers, starting with a letter.';
	if (TAKEN.includes(name)) return `${name} is already taken at Darts Unlimited. Pick another.`;
	return null;
}

function loadProgress(): Progress {
	try {
		const p = JSON.parse(localStorage.getItem(STORE) ?? 'null') as Progress | null;
		if (p?.done) return p;
	} catch {
		// Fall through to a fresh start.
	}
	return { done: [], opened: [], chat: [], promoted: false };
}

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const el = (tag: string, cls?: string, text?: string) => {
	const e = document.createElement(tag);
	if (cls) e.className = cls;
	if (text !== undefined) e.textContent = text;
	return e;
};

export function startDesk() {
	const root = $('.workspace');
	const layout = initLayout(root);
	const vm = new GameVM();
	const base = root.dataset.vmBase!;
	let progress = loadProgress();
	let selected: string | null = null;
	const hintsShown: Record<string, number> = {};
	const lastResult: Record<string, CheckResult> = {};

	const save = () => {
		try {
			localStorage.setItem(STORE, JSON.stringify(progress));
		} catch {
			// Storage can be blocked; the sprint still works for this visit.
		}
	};

	// Game clock: Monday 09:00, three minutes per message.
	const clock = () => {
		const mins = 9 * 60 + progress.chat.length * 3;
		return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
	};

	const arrived = () =>
		tickets.filter((t) => t.arrivesAfter === undefined || progress.done.filter((d) => d !== t.id).length >= t.arrivesAfter);

	// Chat
	const chatLog = $('#chat-log');
	const renderMessage = (m: Progress['chat'][number]) => {
		const li = el('li', `msg from-${m.from.toLowerCase()}`);
		const head = el('p', 'msg-head');
		head.append(el('strong', '', m.from), el('span', 'time', m.time));
		li.append(head);
		for (const para of m.text.split('\n\n')) {
			const p = el(para.includes('=') && !para.includes(' ') ? 'pre' : 'p', 'msg-text', para);
			li.append(p);
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
				const b = el('button', `card${t.interruption ? ' interruption' : ''}${selected === t.id ? ' selected' : ''}`);
				b.setAttribute('type', 'button');
				b.append(el('span', 'card-id', t.id), el('span', 'card-title', t.title));
				const meta = el('span', 'card-meta');
				meta.append(el('span', '', `From ${t.from}`), el('span', 'points', String(t.points)));
				b.append(meta);
				if (t.interruption && !progress.done.includes(t.id)) b.append(el('span', 'flag', 'Interruption'));
				b.addEventListener('click', () => openTicket(t.id));
				li.append(b);
				ul.append(li);
			}
		}
		const allDone = list.length === tickets.length && list.every((t) => progress.done.includes(t.id));
		$('#review').hidden = !allDone;
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
		progress.done.push(t.id);
		save();
		say(t.from, t.thanks);
		renderQueue();
		renderTicket();
		const newly = arrived().slice(before);
		for (const n of newly) {
			setTimeout(() => {
				say(n.from, `${n.title}. ${n.body[0]}`);
				document.querySelector('[data-tab="panel-queue"]')?.classList.add('unread');
			}, 1500);
		}
		if (arrived().length === tickets.length && progress.done.length === tickets.length) {
			void sayLater(sprint.done, 1500);
		}
	};

	const renderTicket = () => {
		const pane = $('#ticket-body');
		pane.replaceChildren();
		const t = tickets.find((x) => x.id === selected);
		if (!t) {
			pane.append(el('p', 'empty', 'Pick a ticket from the queue to start work on it.'));
			return;
		}
		const done = progress.done.includes(t.id);
		const head = el('div', 'ticket-head');
		head.append(el('span', 'card-id', t.id), el('h3', 'ticket-title', t.title));
		const meta = el('p', 'ticket-meta', `From ${t.from}. ${t.points} ${t.points === 1 ? 'point' : 'points'}.${done ? ' Done.' : ''}`);
		head.append(meta);
		pane.append(head);
		for (const para of t.body) pane.append(el('p', '', para));

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
					const r = await t.check!(vm);
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

		if (!done && t.hints.length) {
			const shown = hintsShown[t.id] ?? 0;
			const hints = el('div', 'hints');
			hints.append(el('h4', '', 'Hints'));
			const ol = el('ol');
			t.hints.slice(0, shown).forEach((h) => ol.append(el('li', '', h)));
			hints.append(ol);
			if (shown < t.hints.length) {
				const b = el('button', 'link', `Show a hint (${shown + 1} of ${t.hints.length})`);
				b.setAttribute('type', 'button');
				b.addEventListener('click', () => {
					hintsShown[t.id] = shown + 1;
					renderTicket();
				});
				hints.append(b);
			}
			pane.append(hints);
		}
	};

	const openTicket = (id: string) => {
		selected = id;
		const t = tickets.find((x) => x.id === id)!;
		if (!progress.opened.includes(id)) {
			progress.opened.push(id);
			save();
			if (!progress.done.includes(id)) say(t.from, t.opened);
		}
		renderQueue();
		renderTicket();
		layout.show('panel-ticket');
	};

	// Sprint review: the retro, then promotion.
	const review = $<HTMLDialogElement>('#review-dialog');
	$('#review').addEventListener('click', () => {
		const form = $('#retro-form');
		form.replaceChildren();
		retro.forEach((q, qi) => {
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
		$('#promotion').hidden = true;
		form.hidden = false;
		review.showModal();
	});
	$('#retro-form').addEventListener('submit', (e) => {
		e.preventDefault();
		const form = e.currentTarget as HTMLFormElement;
		const data = new FormData(form);
		let right = 0;
		retro.forEach((q, qi) => {
			const ok = Number(data.get(`q${qi}`)) === q.correct;
			if (ok) right++;
			const why = form.querySelectorAll<HTMLElement>('.why')[qi];
			why.textContent = `${ok ? 'Right.' : `Not quite: ${q.options[q.correct]}.`} ${q.why}`;
			why.className = `why ${ok ? 'pass' : 'fail'}`;
		});
		if (right === retro.length) {
			progress.promoted = true;
			save();
			form.querySelector('button[type="submit"]')?.remove();
			const promo = $('#promotion');
			promo.hidden = false;
			const tbody = $('#translation');
			tbody.replaceChildren();
			for (const [a, b] of translation) {
				const tr = el('tr');
				tr.append(el('th', '', a), el('td', '', b));
				tbody.append(tr);
			}
			promo.scrollIntoView({ behavior: 'smooth' });
		}
	});
	$('#review-close').addEventListener('click', () => review.close());

	// Top bar
	$('#reset-layout').addEventListener('click', resetLayout);
	$('#restart').addEventListener('click', () => {
		if (!confirm('Start sprint 1 again from the beginning? Your progress in this browser is cleared.')) return;
		try {
			localStorage.removeItem(STORE);
		} catch {
			// Nothing saved.
		}
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
	if (progress.username) nameInput.value = progress.username;
	if (progress.done.length)
		$('#clock-in-text').textContent =
			'Welcome back. Your tickets are where you left them. web01 has been reset to how it was on Monday morning, so redo any half-finished work.';
	clockIn.showModal();
	clockIn.addEventListener('cancel', (e) => e.preventDefault());
	$('#clock-in-form').addEventListener('submit', async (e) => {
		e.preventDefault();
		const user = nameInput.value.trim().toLowerCase();
		const problem = usernameProblem(user);
		$('#username-error').textContent = problem ?? '';
		nameInput.setAttribute('aria-invalid', String(Boolean(problem)));
		if (problem) return;
		progress.username = user;
		save();
		$('#h-term').textContent = `Terminal: ${user}@${sprint.vm.name}`;
		clockIn.close();
		if (!progress.chat.length) void sayLater(sprint.intro.map((m) => ({ ...m, text: m.text.replace('{name}', user) })), 1200);
		const status = $('#term-status');
		try {
			await vm.start($('#term'), {
				base,
				name: sprint.vm.name,
				ip: sprint.vm.ip,
				setup,
				user,
				password: PASSWORD,
				onStatus: (s) => (status.textContent = s),
			});
			vm.focus();
		} catch {
			// The status line already says what went wrong.
		}
	});
}
