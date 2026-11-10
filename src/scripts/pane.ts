import { toContentPath } from '../lib/site';

interface PaneOptions {
	initial?: boolean;
	query?: string | null;
	focus?: boolean;
}

let outlineObserver: IntersectionObserver | null = null;

/** Wires the interactive parts of a page pane: search, outline, and anchors. */
export function initPane(pane: HTMLElement, options: PaneOptions = {}): void {
	initSearch(pane, options);
	initOutlineToggle(pane);
	initAnchors(pane);
}

/** Applies a search query to an already-initialized search pane. */
export function applySearchQuery(pane: HTMLElement, query: string): void {
	const input = pane.querySelector<HTMLInputElement>('#search-input');
	if (!input) return;
	input.value = query;
	input.dispatchEvent(new Event('input'));
}

/** Points the outline observer at the pane currently on screen. */
export function activateOutline(pane: HTMLElement | null): void {
	outlineObserver?.disconnect();
	outlineObserver = null;
	if (!pane) return;

	const links = [...pane.querySelectorAll<HTMLAnchorElement>('.toc-i[data-target]')];
	if (links.length === 0) return;

	const editor = document.getElementById('editor');
	if (!editor) return;

	const headings = links
		.map((link) => (link.dataset.target ? pane.querySelector(`#${CSS.escape(link.dataset.target)}`) : null))
		.filter((heading): heading is Element => heading !== null);
	if (headings.length === 0) return;

	const activate = (id: string) =>
		links.forEach((link) => link.classList.toggle('on', link.dataset.target === id));

	const observer = new IntersectionObserver(
		(entries) => {
			const visible = entries
				.filter((entry) => entry.isIntersecting)
				.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
			if (visible[0]) activate(visible[0].target.id);
		},
		{ root: editor, rootMargin: '0px 0px -72% 0px', threshold: 0 }
	);
	outlineObserver = observer;
	headings.forEach((heading) => observer.observe(heading));
}

function initSearch(pane: HTMLElement, { initial = false, query = null, focus = false }: PaneOptions): void {
	const input = pane.querySelector<HTMLInputElement>('#search-input');
	if (!input) return;

	const items = [...pane.querySelectorAll<HTMLElement>('.lib-item')];
	const count = pane.querySelector<HTMLElement>('#search-count');
	const empty = pane.querySelector<HTMLElement>('#search-empty');

	if (initial) {
		const initialQuery = new URLSearchParams(location.search).get('q');
		if (initialQuery) input.value = initialQuery;
		if (initialQuery || location.hash === '#search' || input.hasAttribute('data-autofocus')) {
			input.focus();
		}
	} else {
		if (query) input.value = query;
		if (focus) input.focus();
	}

	const update = () => {
		const value = input.value.trim().toLowerCase();
		let matches = 0;

		for (const item of items) {
			const hit = !value || (item.dataset.search ?? '').includes(value);
			item.toggleAttribute('hidden', !hit);
			if (hit) matches += 1;
		}

		if (count) count.textContent = `${matches} 篇`;
		empty?.toggleAttribute('hidden', matches !== 0);
	};

	input.addEventListener('input', update);
	update();
}

function initOutlineToggle(pane: HTMLElement): void {
	const toggle = pane.querySelector<HTMLButtonElement>('.toc-toggle');
	toggle?.addEventListener('click', () => {
		const off = document.body.classList.toggle('toc-off');
		toggle.setAttribute('aria-expanded', String(!off));
		toggle.title = off ? '显示目录' : '隐藏目录';
	});
}

function initAnchors(pane: HTMLElement): void {
	pane.addEventListener('click', (event) => {
		const anchor = (event.target as Element | null)?.closest<HTMLAnchorElement>('a[href]');
		if (!anchor) return;
		const raw = anchor.getAttribute('href') ?? '';
		if (!raw.startsWith('#')) return;

		let id: string;
		try {
			id = decodeURIComponent(raw.slice(1));
		} catch {
			return;
		}
		if (!id) return;

		const target = pane.querySelector(`#${CSS.escape(id)}`);
		if (!target) return;

		event.preventDefault();
		target.scrollIntoView({ block: 'start' });

		if (anchor.classList.contains('toc-i')) {
			pane.querySelectorAll<HTMLAnchorElement>('.toc-i').forEach((link) => {
				link.classList.toggle('on', link === anchor);
			});
		}

		// Keep the address bar usable for anchors while the pane still belongs
		// to the page that was actually loaded.
		const paneHref = pane.dataset.tabHref;
		if (paneHref) {
			const panePath = toContentPath(new URL(paneHref, location.href).pathname);
			if (panePath === toContentPath(location.pathname)) {
				history.replaceState(null, '', `${location.pathname}${location.search}#${encodeURIComponent(id)}`);
			}
		}
	});
}
