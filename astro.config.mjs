// @ts-check
// Markdown pipeline: content images, display math, bylines, and KaTeX.
import { defineConfig } from 'astro/config';
import { satteri } from '@astrojs/markdown-satteri';
import { satteriKatex } from 'satteri-katex';
import { displayMath, docMeta, missingImages } from './src/lib/markdown-plugins.mjs';

// https://astro.build/config
export default defineConfig({
  site: 'https://draaaft.github.io',
  base: '/Komeiji-Bibliotheca',
  markdown: {
		processor: satteri({
			features: { math: true },
			mdastPlugins: [missingImages(), displayMath(), docMeta(), satteriKatex()],
		}),
	},
});
