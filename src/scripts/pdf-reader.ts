import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

/** Renders PDF pages in the editor's own scroll area, without a nested viewer. */
export async function initPdfReader(pane: HTMLElement): Promise<void> {
	const reader = pane.querySelector<HTMLElement>('[data-pdf-reader]');
	const pages = reader?.querySelector<HTMLElement>('.pdf-pages');
	const status = reader?.querySelector<HTMLElement>('.pdf-status');
	const url = reader?.dataset.pdfUrl;
	if (!reader || !pages || !status || !url) return;

	try {
		const pdf = await pdfjs.getDocument({ url }).promise;
		if (!pane.isConnected) {
			void pdf.destroy();
			return;
		}

		const firstPage = await pdf.getPage(1);
		const firstViewport = firstPage.getViewport({ scale: 1 });
		const aspect = `${firstViewport.width} / ${firstViewport.height}`;
		const editor = document.getElementById('editor');
		const placeholders: HTMLElement[] = [];
		const queued = new Set<number>();
		const rendered = new Set<number>();
		const pending: number[] = [];
		let running = 0;
		let observer: IntersectionObserver;

		const renderPage = async (number: number) => {
			const holder = placeholders[number - 1];
			try {
				const page = number === 1 ? firstPage : await pdf.getPage(number);
				if (!holder.isConnected) return;
				const baseViewport = page.getViewport({ scale: 1 });
				holder.style.aspectRatio = `${baseViewport.width} / ${baseViewport.height}`;
				const width = holder.clientWidth;
				if (width === 0) {
					queued.delete(number);
					return;
				}
				const viewport = page.getViewport({ scale: width / baseViewport.width });
				const ratio = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(16000000 / (viewport.width * viewport.height)));
				const canvas = document.createElement('canvas');
				canvas.width = Math.max(1, Math.floor(viewport.width * ratio));
				canvas.height = Math.max(1, Math.floor(viewport.height * ratio));
				canvas.setAttribute('aria-hidden', 'true');
				await page.render({ canvas, viewport, transform: [ratio, 0, 0, ratio, 0, 0] }).promise;
				if (!holder.isConnected) return;
				holder.replaceChildren(canvas);
				rendered.add(number);
				observer.unobserve(holder);
			} catch (error) {
				console.error(`PDF page ${number} could not be rendered`, error);
				holder.textContent = `第 ${number} 页加载失败，请使用上方链接打开 PDF。`;
				holder.classList.add('pdf-page-error');
				observer.unobserve(holder);
			}
		};

		const pump = () => {
			while (running < 2 && pending.length > 0) {
				const number = pending.shift()!;
				running += 1;
				void renderPage(number).finally(() => {
					running -= 1;
					pump();
				});
			}
		};

		observer = new IntersectionObserver((entries) => {
			for (const entry of entries) {
				if (!entry.isIntersecting) continue;
				const number = Number((entry.target as HTMLElement).dataset.page);
				if (queued.has(number) || rendered.has(number)) continue;
				queued.add(number);
				pending.push(number);
			}
			pump();
		}, { root: editor, rootMargin: '600px 0px', threshold: 0 });

		const fragment = document.createDocumentFragment();
		for (let number = 1; number <= pdf.numPages; number += 1) {
			const holder = document.createElement('figure');
			holder.className = 'pdf-page';
			holder.dataset.page = String(number);
			holder.style.aspectRatio = aspect;
			holder.setAttribute('aria-label', `PDF 第 ${number} 页，共 ${pdf.numPages} 页`);
			const loading = document.createElement('span');
			loading.className = 'pdf-page-loading';
			loading.textContent = `${number} / ${pdf.numPages}`;
			holder.append(loading);
			fragment.append(holder);
			placeholders.push(holder);
		}
		pages.append(fragment);
		status.textContent = `共 ${pdf.numPages} 页 · 向下滚动阅读`;
		placeholders.forEach((holder) => observer.observe(holder));
	} catch (error) {
		console.error('PDF could not be loaded', error);
		status.textContent = 'PDF 加载失败，请使用上方链接打开或下载文件。';
	}
}
