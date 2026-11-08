import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineMdastPlugin } from 'satteri';

const escapeHtml = (value) =>
	value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

// Relative images that do not exist on disk would fail Astro's asset
// collection. Replace them with a visible placeholder so the rest of the
// document still renders.
export function missingImages() {
	return defineMdastPlugin({
		name: 'missing-images',
		image(node, ctx) {
			const { url, alt } = node;
			if (!ctx.fileURL || !url || /^(?:[a-z][a-z0-9+.-]*:|\/\/|\/)/i.test(url)) {
				return;
			}
			if (existsSync(fileURLToPath(new URL(url, ctx.fileURL)))) {
				return;
			}

			const label = alt && alt !== 'alt text' ? alt : url;
			ctx.replaceNode(node, {
				type: 'html',
				value: `<span class="img-missing" role="img" aria-label="${escapeHtml(label)}"><span class="img-missing-label">图片待补充</span><code>${escapeHtml(url)}</code></span>`,
			});
		},
	});
}

// Sätteri parses `$$…$$` written on one line as inline math. When such an
// expression is the whole paragraph, render it as display math instead.
export function displayMath() {
	return defineMdastPlugin({
		name: 'display-math',
		paragraph(node, ctx) {
			const children = node.children.filter(
				(child) => !(child.type === 'text' && child.value.trim() === '')
			);
			if (children.length !== 1 || children[0].type !== 'inlineMath') {
				return;
			}
			ctx.replaceNode(node, { type: 'math', value: children[0].value });
		},
	});
}

const formatFrontmatterDate = (value) => {
	const date = value instanceof Date ? value : new Date(value);
	return Number.isNaN(date.getTime()) ? String(value) : date.toISOString().slice(0, 10);
};

// Insert the frontmatter byline and tags into the Markdown flow directly
// under the title, without any layout wrappers.
export function docMeta() {
	return defineMdastPlugin({
		name: 'doc-meta',
		before(root, ctx) {
			const frontmatter = ctx.data.astro?.frontmatter;
			if (!frontmatter) return;

			const parts = [];
			if (frontmatter.author) {
				parts.push(`author: ${escapeHtml(String(frontmatter.author))}`);
			}
			if (frontmatter.pubDate) {
				parts.push(`pubDate: ${escapeHtml(formatFrontmatterDate(frontmatter.pubDate))}`);
			}
			if (frontmatter.update) {
				parts.push(`update: ${escapeHtml(formatFrontmatterDate(frontmatter.update))}`);
			}
			const tags = Array.isArray(frontmatter.tags) ? frontmatter.tags : [];
			if (parts.length === 0 && tags.length === 0) return;

			const h1Index = root.children.findIndex(
				(child) => child.type === 'heading' && child.depth === 1
			);
			if (h1Index < 0) return;

			const tagList = tags.length
				? `<span class="doc-tags">${tags
						.map((tag) => `<span class="tag">${escapeHtml(String(tag))}</span>`)
						.join('')}</span>`
				: '';
			const meta = `<p class="doc-meta">${parts
				.map((part) => `<span>${part}</span>`)
				.join('')}${tagList}</p>`;
			ctx.insertAfter(root.children[h1Index], { type: 'html', value: meta });
		},
	});
}
