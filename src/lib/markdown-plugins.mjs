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
