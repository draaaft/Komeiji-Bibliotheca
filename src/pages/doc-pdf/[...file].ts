import { readFile } from 'node:fs/promises';
import type { APIRoute } from 'astro';
import { loadLibrary } from '../../lib/docs';

export async function getStaticPaths() {
	const { docs } = await loadLibrary();
	return docs
		.filter((doc) => doc.format === 'pdf' && doc.pdfFile)
		.map((doc) => ({
			params: { file: `${doc.id}.pdf` },
			props: { pdfFile: doc.pdfFile! },
		}));
}

export const GET: APIRoute = async ({ props }) => {
	const pdf = await readFile(props.pdfFile as string);
	return new Response(new Uint8Array(pdf), {
		headers: { 'Content-Type': 'application/pdf' },
	});
};
