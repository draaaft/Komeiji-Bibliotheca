export const site = {
	name: 'Komeiji Bibliotheca',
	nameZh: '古明寺藏书阁',
	root: 'Komeiji-Bibliotheca',
	description: '古明地恋的物理讨论班，不止于物理~',
};

// GitHub Pages serves project sites under /<repo>, so every internal link has
// to carry the configured base or it resolves against the domain root.
const rawBase = import.meta.env.BASE_URL;
export const base = rawBase.endsWith('/') ? rawBase.slice(0, -1) : rawBase;

/** Prefix a site-internal absolute path with the deployment base path. */
export function withBase(path: string): string {
	if (!path.startsWith('/') || path.startsWith('//')) return path;
	return base ? `${base}${path}` : path;
}

/** Turn the current URL pathname into a base-less, decoded content path. */
export function toContentPath(pathname: string): string {
	let path = pathname;
	try {
		path = decodeURIComponent(path);
	} catch {
		// Keep the raw pathname when it contains malformed escapes.
	}
	if (base && (path === base || path.startsWith(`${base}/`))) {
		path = path.slice(base.length);
	}
	if (!path.startsWith('/')) path = `/${path}`;
	return path.endsWith('/') ? path : `${path}/`;
}
