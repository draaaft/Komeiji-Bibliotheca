import { getCollection, type CollectionEntry } from 'astro:content';

export interface Doc {
	id: string;
	path: string;
	dir: string;
	file: string;
	title: string;
	author?: string;
	description?: string;
	pubDate?: Date;
	update?: Date;
	tags: string[];
	hasH1: boolean;
	entry: CollectionEntry<'docs'>;
}

export interface LibraryNode {
	kind: 'folder' | 'file';
	name: string;
	path: string;
	count: number;
	children: LibraryNode[];
	doc?: Doc;
}

export interface Library {
	docs: Doc[];
	tree: LibraryNode[];
	folders: LibraryNode[];
}

export interface OutlineItem {
	slug: string;
	text: string;
}

const stripInline = (value: string) =>
	value
		.replace(/!\[[^\]]*\]\([^)]*\)/g, '')
		.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
		.replace(/\${1,2}([^$]+)\${1,2}/g, '$1')
		.replace(/[*_~`]/g, '')
		.trim();

export function normalizePath(path: string): string {
	const withLeading = path.startsWith('/') ? path : `/${path}`;
	return withLeading.endsWith('/') ? withLeading : `${withLeading}/`;
}

export function formatDate(date: Date): string {
	const pad = (value: number) => String(value).padStart(2, '0');
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function latestDate(doc: Doc): Date | undefined {
	return doc.update ?? doc.pubDate;
}

// Heading text from the parsed AST drops math, so pair each h2 with its raw
// Markdown line to keep formulas in the outline readable.
export function buildOutline(
	doc: Doc,
	headings: { depth: number; slug: string; text: string }[]
): OutlineItem[] {
	const body = (doc.entry.body ?? '')
		.replace(/<!--[\s\S]*?-->/g, '')
		.replace(/^ {0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?^ {0,3}(?:`{3,}|~{3,})[^\n]*$/gm, '');
	const rawHeadings = [...body.matchAll(/^ {0,3}##[ \t]+(.+?)[ \t]*$/gm)].map((match) =>
		stripInline(match[1].replace(/[ \t]+#+[ \t]*$/, ''))
	);
	const astHeadings = headings.filter((heading) => heading.depth === 2);
	const useRaw = rawHeadings.length === astHeadings.length;
	return astHeadings.map((heading, index) => ({
		slug: heading.slug,
		text: useRaw ? rawHeadings[index] || heading.text : heading.text,
	}));
}

function toDoc(entry: CollectionEntry<'docs'>): Doc {
	const segments = entry.id.split('/');
	const stem = segments.at(-1)!;
	const body = (entry.body ?? '').replace(/<!--[\s\S]*?-->/g, '');
	const heading = body.match(/^ {0,3}#[ \t]+(.+?)[ \t]*$/m)?.[1];
	const fallbackTitle = heading ? stripInline(heading) : stem;
	return {
		id: entry.id,
		path: normalizePath(entry.id),
		dir: segments.slice(0, -1).join('/'),
		file: `${stem}.md`,
		title: entry.data.title?.trim() || fallbackTitle,
		author: entry.data.author,
		description: entry.data.description,
		pubDate: entry.data.pubDate,
		update: entry.data.update,
		tags: entry.data.tags,
		hasH1: Boolean(heading),
		entry,
	};
}

function compareDocs(a: Doc, b: Doc): number {
	const aDate = latestDate(a);
	const bDate = latestDate(b);
	if (aDate && bDate) {
		return bDate.getTime() - aDate.getTime() || a.path.localeCompare(b.path, 'zh-Hans-CN');
	}
	if (aDate) return -1;
	if (bDate) return 1;
	return a.path.localeCompare(b.path, 'zh-Hans-CN');
}

function compareNodes(a: LibraryNode, b: LibraryNode): number {
	if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1;
	return a.name.localeCompare(b.name, 'zh-Hans-CN', { numeric: true, sensitivity: 'base' });
}

interface DraftFolder {
	kind: 'folder';
	name: string;
	path: string;
	children: Map<string, DraftNode>;
}

interface DraftFile {
	kind: 'file';
	name: string;
	path: string;
	doc: Doc;
}

type DraftNode = DraftFolder | DraftFile;

function buildTree(docs: Doc[]): LibraryNode[] {
	const root = new Map<string, DraftNode>();

	for (const doc of docs) {
		const segments = doc.id.split('/');
		let level = root;

		for (const [index, name] of segments.entries()) {
			if (index === segments.length - 1) {
				level.set(`file:${name}`, {
					kind: 'file',
					name: doc.file,
					path: doc.path,
					doc,
				});
				continue;
			}

			const key = `folder:${name}`;
			const existing = level.get(key);
			const folder: DraftFolder =
				existing?.kind === 'folder'
					? existing
					: {
							kind: 'folder',
							name,
							path: normalizePath(segments.slice(0, index + 1).join('/')),
							children: new Map(),
						};
			level.set(key, folder);
			level = folder.children;
		}
	}

	const finalize = (level: Map<string, DraftNode>): LibraryNode[] =>
		[...level.values()]
			.map((node): LibraryNode => {
				if (node.kind === 'file') {
					return {
						kind: 'file',
						name: node.name,
						path: node.path,
						count: 1,
						children: [],
						doc: node.doc,
					};
				}
				const children = finalize(node.children);
				return {
					kind: 'folder',
					name: node.name,
					path: node.path,
					count: children.reduce((total, child) => total + child.count, 0),
					children,
				};
			})
			.sort(compareNodes);

	return finalize(root);
}

function collectFolders(nodes: LibraryNode[], result: LibraryNode[] = []): LibraryNode[] {
	for (const node of nodes) {
		if (node.kind === 'folder') {
			result.push(node);
			collectFolders(node.children, result);
		}
	}
	return result;
}

export async function loadLibrary(): Promise<Library> {
	const docs = (await getCollection('docs'))
		.filter((entry) => !entry.data.draft)
		.map(toDoc)
		.sort(compareDocs);
	const tree = buildTree(docs);
	return { docs, tree, folders: collectFolders(tree) };
}
