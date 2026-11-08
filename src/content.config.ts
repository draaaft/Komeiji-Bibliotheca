import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const docs = defineCollection({
	loader: glob({
		pattern: ['**/*.md', '!**/*.assets/**'],
		base: './src/content',
	}),
	schema: z.object({
		title: z.string().optional(),
		author: z.string().optional(),
		pubDate: z.coerce.date().optional(),
		update: z.coerce.date().optional(),
		description: z.string().optional(),
		tags: z.array(z.string()).default([]),
		draft: z.boolean().default(false),
	}),
});

export const collections = { docs };
