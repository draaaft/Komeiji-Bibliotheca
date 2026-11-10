import { base, site, toContentPath, withBase } from '../lib/site';
import { activateOutline, applySearchQuery, initPane } from './pane';

const MAX_TABS = 7;

interface Tab {
	id: string;
	href: string;
	label: string;
	icon: string;
	docTitle: string;
	preview: boolean;
	pane: HTMLElement | null;
	loading: boolean;
	scroll: number;
	query: string | null;
}

interface PageMeta {
	href: string;
	label: string;
	icon: string;
}

const KNOWN_PAGES: Record<string, { label: string; icon: string }> = {
	'/': { label: '开始', icon: 'flag' },
	'/search/': { label: '搜索', icon: 'search' },
	'/tags/': { label: '标签', icon: 'tag' },
	'/library/': { label: '藏书阁', icon: 'files' },
};

/** Turns the top bar into VS Code-style editor tabs for every page on the site. */
export function initTabs(): void {
	const tabbar = document.getElementById('tabbar');
	const editor = document.getElementById('editor');
	const plus = tabbar?.querySelector<HTMLAnchorElement>('.tab-plus');
	const template = document.getElementById('tab-template') as HTMLTemplateElement | null;
	const initialPane = editor?.querySelector<HTMLElement>('.pane');
	if (!tabbar || !editor || !plus || !template || !initialPane) return;

	const tabs: Tab[] = [];
	let active: Tab | null = null;
	let dragTab: HTMLAnchorElement | null = null;
	let suppressClick = false;

	const elementFor = (tab: Tab) =>
		[...tabbar.querySelectorAll<HTMLAnchorElement>('.tab')].find(
			(element) => element.dataset.tabId === tab.id
		) ?? null;

	const tabFrom = (element: Element) => {
		const id = element.closest<HTMLElement>('.tab')?.dataset.tabId;
		return tabs.find((tab) => tab.id === id) ?? null;
	};

	const makeTab = (tab: Tab): HTMLAnchorElement => {
		const element = template.content.firstElementChild!.cloneNode(true) as HTMLAnchorElement;
		element.href = tab.href;
		element.dataset.tabId = tab.id;
		element.title = `~${tab.id}`;
		element.classList.toggle('on', tab === active);
		element.classList.toggle('preview', tab.preview);
		element.setAttribute('draggable', 'true');
		if (tab === active) element.setAttribute('aria-current', 'page');
		element.querySelector('use')!.setAttribute('href', `#i-${tab.icon}`);
		element.querySelector('span:not(.x)')!.textContent = tab.label;
		element.querySelector('[data-tab-close]')!.setAttribute('aria-label', `关闭 ${tab.label}`);
		return element;
	};

	const render = () => {
		tabbar.querySelectorAll('.tab').forEach((element) => element.remove());
		const fragment = document.createDocumentFragment();
		for (const tab of tabs) fragment.append(makeTab(tab));
		tabbar.insertBefore(fragment, plus);
	};

	const syncClasses = () => {
		for (const tab of tabs) {
			const element = elementFor(tab);
			if (!element) continue;
			element.classList.toggle('on', tab === active);
			element.classList.toggle('preview', tab.preview);
			if (tab === active) element.setAttribute('aria-current', 'page');
			else element.removeAttribute('aria-current');
		}
	};

	const syncTab = (tab: Tab) => {
		const element = elementFor(tab);
		if (!element) return;
		element.querySelector('span:not(.x)')!.textContent = tab.label;
		element.querySelector('use')!.setAttribute('href', `#i-${tab.icon}`);
		element.querySelector('[data-tab-close]')!.setAttribute('aria-label', `关闭 ${tab.label}`);
	};

	const syncTree = (id: string | null) => {
		const tree = document.querySelector<HTMLElement>('#sidebar .tree');
		if (!tree) return;
		tree.querySelectorAll<HTMLElement>('.sel').forEach((element) => element.classList.remove('sel'));
		tree
			.querySelectorAll<HTMLElement>('[aria-current]')
			.forEach((element) => element.removeAttribute('aria-current'));
		if (!id) return;

		const link = [...tree.querySelectorAll<HTMLAnchorElement>('a[href]')].find(
			(anchor) => toContentPath(new URL(anchor.href, location.href).pathname) === id
		);
		if (!link) return;

		(link.closest<HTMLElement>('.trow') ?? link).classList.add('sel');
		link.setAttribute('aria-current', 'page');

		let group = link.closest<HTMLElement>('.tree-children[hidden]');
		while (group) {
			group.removeAttribute('hidden');
			const toggle = group.previousElementSibling?.querySelector<HTMLButtonElement>('[data-tree-toggle]');
			toggle?.setAttribute('aria-expanded', 'true');
			toggle?.setAttribute('aria-label', `折叠 ${toggle.dataset.name ?? ''}`);
			const parent = group.parentElement?.parentElement;
			group = parent?.matches('.tree-children[hidden]') ? parent : null;
		}
	};

	const syncActivity = (id: string | null) => {
		document.querySelectorAll<HTMLAnchorElement>('.activity a.act-btn').forEach((link) => {
			const url = new URL(link.href, location.href);
			if (url.origin !== location.origin) return;
			const on = toContentPath(url.pathname) === id;
			link.classList.toggle('on', on);
			if (on) link.setAttribute('aria-current', 'page');
			else link.removeAttribute('aria-current');
		});
		const files = document.querySelector<HTMLElement>('[data-sidebar-toggle]');
		files?.classList.toggle('on', id !== '/search/' && id !== '/tags/');
	};

	// The editor scrolls smoothly for anchors; restoring a tab position must be instant.
	const setScroll = (top: number) => {
		editor.style.scrollBehavior = 'auto';
		editor.scrollTop = top;
		editor.style.scrollBehavior = '';
	};

	const show = (tab: Tab | null) => {
		// Choosing a tab means reading it, so the mobile drawer should step aside.
		document.body.classList.remove('drawer-open');
		document.querySelector('.burger')?.setAttribute('aria-expanded', 'false');

		if (tab && tab === active) {
			if (!tab.pane && !tab.loading) loadPane(tab);
			return;
		}

		if (active?.pane) active.scroll = editor.scrollTop;
		active = tab;

		for (const item of tabs) item.pane?.toggleAttribute('hidden', item !== tab);
		if (tab) {
			if (tab.pane) {
				setScroll(tab.scroll);
				activateOutline(tab.pane);
			} else {
				setScroll(0);
				activateOutline(null);
			}
			document.title = tab.docTitle || site.nameZh;
		} else {
			setScroll(0);
			activateOutline(null);
			document.title = site.nameZh;
		}

		syncTree(tab?.id ?? null);
		syncActivity(tab?.id ?? null);
		syncClasses();

		if (tab && !tab.pane && !tab.loading) loadPane(tab);
	};

	const closeTab = (tab: Tab) => {
		const index = tabs.indexOf(tab);
		if (index < 0) return;

		const wasActive = tab === active;
		if (wasActive) active = null;
		tabs.splice(index, 1);
		tab.pane?.remove();
		render();

		if (wasActive) show(tabs[index] ?? tabs[index - 1] ?? null);
	};

	const loadPane = async (tab: Tab) => {
		if (tab.loading) return;
		tab.loading = true;

		try {
			const response = await fetch(tab.href);
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			const html = await response.text();
			if (!tabs.includes(tab)) return;

			const doc = new DOMParser().parseFromString(html, 'text/html');
			const source = doc.querySelector<HTMLElement>('#editor .pane');
			if (!source) throw new Error('missing pane');

			const pane = document.importNode(source, true);
			resolveRelativeLinks(pane, tab.href);
			tab.pane = pane;
			pane.toggleAttribute('hidden', tab !== active);
			editor.append(pane);

			tab.label = pane.dataset.tabLabel ?? tab.label;
			tab.icon = pane.dataset.tabIcon ?? tab.icon;
			tab.docTitle = doc.title;

			initPane(pane, { query: tab.query, focus: tab === active });
			if (tab === active) {
				setScroll(tab.scroll);
				activateOutline(pane);
				document.title = tab.docTitle;
			}
			syncTab(tab);
		} catch (error) {
			console.error(`Failed to open ${tab.href}`, error);
		} finally {
			tab.loading = false;
		}
	};

	const applyQuery = (tab: Tab, query: string) => {
		tab.query = query;
		if (tab.pane) applySearchQuery(tab.pane, query);
	};

	const metaFor = (url: URL): PageMeta => {
		const id = toContentPath(url.pathname);
		const known = KNOWN_PAGES[id];
		const name = id.split('/').filter(Boolean).at(-1);
		return {
			href: withBase(id),
			label: known?.label ?? name ?? '开始',
			icon: known?.icon ?? 'md',
		};
	};

	const openPage = (rawHref: string, preview: boolean) => {
		const url = new URL(rawHref, location.href);
		const id = toContentPath(url.pathname);
		const query = id === '/search/' ? url.searchParams.get('q') : null;
		const existing = tabs.find((tab) => tab.id === id);

		if (existing) {
			if (!preview) existing.preview = false;
			if (query) applyQuery(existing, query);
			show(existing);
			syncClasses();
			return;
		}

		const meta = metaFor(url);
		const tab: Tab = {
			id,
			href: `${meta.href}${url.search}`,
			label: meta.label,
			icon: meta.icon,
			docTitle: '',
			preview,
			pane: null,
			loading: false,
			scroll: 0,
			query,
		};

		let slot = -1;
		if (preview) {
			// The start page is a scratch tab, so a preview opened from it takes its
			// slot. Any other preview is pinned to keep a single preview tab.
			if (active?.id === '/') {
				slot = tabs.indexOf(active);
				for (const item of tabs) {
					if (item !== active && item.preview) item.preview = false;
				}
			} else {
				slot = tabs.findIndex((item) => item.preview);
			}
		}
		if (slot < 0 && tabs.length >= MAX_TABS) slot = tabs.length - 1;

		if (slot >= 0) {
			const replaced = tabs[slot];
			replaced.pane?.remove();
			if (active === replaced) active = null;
			tabs[slot] = tab;
		} else {
			tabs.push(tab);
		}

		loadPane(tab);
		render();
		show(tab);
	};

	const pageLink = (anchor: HTMLAnchorElement): URL | null => {
		if (anchor.target && anchor.target !== '_self') return null;
		if (anchor.hasAttribute('download')) return null;
		const raw = anchor.getAttribute('href');
		if (!raw) return null;
		const url = new URL(raw, location.href);
		if (url.origin !== location.origin) return null;
		if (!url.pathname.endsWith('/')) return null;
		if (base && url.pathname !== base && !url.pathname.startsWith(`${base}/`)) return null;
		return url;
	};

	tabbar.addEventListener('click', (event) => {
		const target = event.target as Element;
		const close = target.closest<HTMLElement>('[data-tab-close]');
		if (close) {
			event.preventDefault();
			event.stopPropagation();
			const tab = tabFrom(close);
			if (tab) closeTab(tab);
			return;
		}

		const element = target.closest<HTMLAnchorElement>('.tab');
		if (element) {
			event.preventDefault();
			event.stopPropagation();
			if (suppressClick) return;
			const tab = tabFrom(element);
			if (tab) show(tab);
			return;
		}

		if (target.closest('.tab-plus')) {
			event.preventDefault();
			event.stopPropagation();
			openPage(withBase('/'), false);
		}
	});

	tabbar.addEventListener('dblclick', (event) => {
		const tab = tabFrom(event.target as Element);
		if (!tab?.preview) return;
		event.preventDefault();
		tab.preview = false;
		syncClasses();
	});

	tabbar.addEventListener('keydown', (event) => {
		if (event.key !== 'Enter' && event.key !== ' ') return;
		const close = (event.target as Element).closest<HTMLElement>('[data-tab-close]');
		if (!close) return;
		event.preventDefault();
		const tab = tabFrom(close);
		if (tab) closeTab(tab);
	});

	tabbar.addEventListener('dragstart', (event) => {
		const element = (event.target as Element).closest<HTMLAnchorElement>('.tab');
		if (!element) return;
		dragTab = element;
		element.style.opacity = '0.5';
		event.dataTransfer?.setData('text/plain', element.dataset.tabId ?? '');
		if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
	});

	tabbar.addEventListener('dragover', (event) => {
		if (!dragTab) return;
		event.preventDefault();
		const over = (event.target as Element).closest<HTMLAnchorElement>('.tab');
		if (!over || over === dragTab) return;
		const rect = over.getBoundingClientRect();
		const after = event.clientX > rect.left + rect.width / 2;
		over.parentElement?.insertBefore(dragTab, after ? over.nextSibling : over);
	});

	tabbar.addEventListener('drop', (event) => {
		if (dragTab) event.preventDefault();
	});

	tabbar.addEventListener('dragend', () => {
		if (!dragTab) return;
		dragTab.style.opacity = '';
		dragTab = null;
		const order = [...tabbar.querySelectorAll<HTMLElement>('.tab')].map(
			(element) => element.dataset.tabId ?? ''
		);
		tabs.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
		suppressClick = true;
		setTimeout(() => {
			suppressClick = false;
		}, 0);
	});

	document.addEventListener('click', (event) => {
		if (
			event.defaultPrevented ||
			event.button !== 0 ||
			event.metaKey ||
			event.ctrlKey ||
			event.shiftKey ||
			event.altKey
		) {
			return;
		}
		const anchor = (event.target as Element | null)?.closest<HTMLAnchorElement>('a[href]');
		if (!anchor || anchor.closest('#tabbar')) return;
		const raw = anchor.getAttribute('href') ?? '';
		if (!raw || raw.startsWith('#')) return;
		const url = pageLink(anchor);
		if (!url) return;
		event.preventDefault();
		openPage(url.href, true);
	});

	document.addEventListener('dblclick', (event) => {
		const anchor = (event.target as Element | null)?.closest<HTMLAnchorElement>('a[href]');
		if (!anchor || anchor.closest('#tabbar')) return;
		const url = pageLink(anchor);
		if (!url) return;
		const tab = tabs.find((item) => item.id === toContentPath(url.pathname));
		if (!tab?.preview) return;
		tab.preview = false;
		syncClasses();
	});

	const initialTab: Tab = {
		id: toContentPath(location.pathname),
		href: initialPane.dataset.tabHref ?? withBase(location.pathname),
		label: initialPane.dataset.tabLabel ?? document.title,
		icon: initialPane.dataset.tabIcon ?? 'md',
		docTitle: document.title,
		preview: false,
		pane: initialPane,
		loading: false,
		scroll: 0,
		query: null,
	};
	tabs.push(initialTab);

	initPane(initialPane, { initial: true });
	initialTab.scroll = editor.scrollTop;
	render();
	show(initialTab);
}

function resolveRelativeLinks(pane: HTMLElement, href: string): void {
	for (const anchor of pane.querySelectorAll<HTMLAnchorElement>('a[href]')) {
		const raw = anchor.getAttribute('href') ?? '';
		if (!raw || raw.startsWith('#') || raw.startsWith('/') || raw.startsWith('//')) continue;
		if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) continue;
		try {
			const resolved = new URL(raw, href);
			if (resolved.origin === location.origin) anchor.setAttribute('href', resolved.href);
		} catch {
			// Leave malformed links alone.
		}
	}
}
