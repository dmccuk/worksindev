/**
 * Resizable panels. A split container ([data-split]) holds panels with
 * separators between them. Drag a separator, or focus it and use the arrow
 * keys, to resize. Sizes are saved in this browser only.
 */
const STORE = 'wid-layout';

type Sizes = Record<string, number[]>;

function load(): Sizes {
	try {
		return JSON.parse(localStorage.getItem(STORE) ?? '{}') as Sizes;
	} catch {
		return {};
	}
}

function save(sizes: Sizes) {
	try {
		localStorage.setItem(STORE, JSON.stringify(sizes));
	} catch {
		// Storage can be blocked; the layout still works for this visit.
	}
}

export function resetLayout() {
	try {
		localStorage.removeItem(STORE);
	} catch {
		// Nothing saved, nothing to reset.
	}
	location.reload();
}

export function initLayout(root: HTMLElement) {
	const saved = load();
	const splits = [root, ...root.querySelectorAll<HTMLElement>('[data-split]')].filter((s) => s.dataset.split);
	for (const split of splits) {
		const key = split.dataset.split!;
		const vertical = split.dataset.direction === 'column';
		const defaults = (split.dataset.sizes ?? '').split(',').map(Number);
		let sizes = saved[key]?.length === defaults.length ? saved[key] : defaults;
		const prop = vertical ? 'gridTemplateRows' : 'gridTemplateColumns';
		const apply = () => {
			split.style[prop] = sizes.map((s) => `minmax(0, ${s}fr)`).join(' var(--sep) ');
			split.querySelectorAll<HTMLElement>(':scope > [role="separator"]').forEach((sep, i) => {
				const pct = Math.round((sizes.slice(0, i + 1).reduce((a, b) => a + b, 0) / total()) * 100);
				sep.setAttribute('aria-valuenow', String(pct));
			});
		};
		const total = () => sizes.reduce((a, b) => a + b, 0);
		const MIN = 0.12;
		const move = (i: number, deltaFr: number) => {
			const t = total();
			const a = Math.max(MIN * t, Math.min(sizes[i] + deltaFr, sizes[i] + sizes[i + 1] - MIN * t));
			const pair = sizes[i] + sizes[i + 1];
			sizes = sizes.map((s, j) => (j === i ? a : j === i + 1 ? pair - a : s));
			apply();
		};
		const persist = () => {
			const all = load();
			all[key] = sizes;
			save(all);
		};

		split.querySelectorAll<HTMLElement>(':scope > [role="separator"]').forEach((sep, i) => {
			sep.tabIndex = 0;
			sep.setAttribute('aria-orientation', vertical ? 'horizontal' : 'vertical');
			sep.setAttribute('aria-valuemin', '0');
			sep.setAttribute('aria-valuemax', '100');
			sep.addEventListener('pointerdown', (e) => {
				e.preventDefault();
				sep.setPointerCapture(e.pointerId);
				const rect = split.getBoundingClientRect();
				const length = vertical ? rect.height : rect.width;
				let last = vertical ? e.clientY : e.clientX;
				sep.classList.add('dragging');
				const onMove = (ev: PointerEvent) => {
					const pos = vertical ? ev.clientY : ev.clientX;
					move(i, ((pos - last) / length) * total());
					last = pos;
				};
				const onUp = () => {
					sep.classList.remove('dragging');
					sep.removeEventListener('pointermove', onMove);
					sep.removeEventListener('pointerup', onUp);
					persist();
				};
				sep.addEventListener('pointermove', onMove);
				sep.addEventListener('pointerup', onUp);
			});
			sep.addEventListener('keydown', (e) => {
				const back = vertical ? 'ArrowUp' : 'ArrowLeft';
				const fwd = vertical ? 'ArrowDown' : 'ArrowRight';
				if (e.key !== back && e.key !== fwd) return;
				e.preventDefault();
				move(i, (e.key === fwd ? 0.04 : -0.04) * total());
				persist();
			});
		});
		apply();
	}

	// Maximise and restore any panel.
	const restore = () => {
		root.querySelector('.panel.maximised')?.classList.remove('maximised');
		root.querySelectorAll<HTMLButtonElement>('[data-maximise]').forEach((b) => {
			b.setAttribute('aria-pressed', 'false');
			b.textContent = 'Maximise';
		});
	};
	root.querySelectorAll<HTMLButtonElement>('[data-maximise]').forEach((btn) => {
		btn.addEventListener('click', () => {
			const panel = btn.closest<HTMLElement>('.panel')!;
			const was = panel.classList.contains('maximised');
			restore();
			if (!was) {
				panel.classList.add('maximised');
				btn.setAttribute('aria-pressed', 'true');
				btn.textContent = 'Restore';
			}
		});
	});
	document.addEventListener('keydown', (e) => {
		if (e.key === 'Escape' && root.querySelector('.panel.maximised') && !document.querySelector('dialog[open]')) restore();
	});

	// On small screens, one panel at a time, chosen with tabs.
	const tabs = [...document.querySelectorAll<HTMLButtonElement>('[data-tab]')];
	const show = (id: string) => {
		tabs.forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === id)));
		root.querySelectorAll<HTMLElement>('.panel').forEach((p) => p.toggleAttribute('data-active', p.id === id));
	};
	tabs.forEach((t) => t.addEventListener('click', () => show(t.dataset.tab!)));
	show('panel-queue');
	return { show };
}
