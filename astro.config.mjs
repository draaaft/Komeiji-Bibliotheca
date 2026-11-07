// @ts-check
import { defineConfig } from 'astro/config';
import { satteri } from '@astrojs/markdown-satteri';
import { satteriKatex } from 'satteri-katex';
import { displayMath, missingImages } from './src/lib/markdown-plugins.mjs';

// https://astro.build/config
export default defineConfig({
	markdown: {
		processor: satteri({
			features: { math: true },
			mdastPlugins: [missingImages(), displayMath(), satteriKatex()],
		}),
	},
});
