import React, { useEffect, useRef, useState } from 'react';
import { ViewerProps } from '../types';

// pdfjs-dist touches browser-only APIs (DOMMatrix, etc.) as soon as it's imported, which
// crashes Next.js SSR (these APIs don't exist on the server). We load it dynamically inside
// useEffect, which only ever runs in the browser, so the module is never evaluated server-side.
let pdfjsLibPromise: Promise<typeof import('pdfjs-dist')> | null = null;

async function loadPdfjs() {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = import('pdfjs-dist').then((pdfjsLib) => {
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url
      ).toString();
      return pdfjsLib;
    });
  }
  return pdfjsLibPromise;
}

export const DocumentViewer: React.FC<ViewerProps> = ({ source, onProgress, onReady, onError }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pageInfo, setPageInfo] = useState({ current: 1, total: 1 });
  const pdfDocRef = useRef<any>(null);

  const renderPage = async (pageNumber: number) => {
    const canvas = canvasRef.current;
    const pdfDoc = pdfDocRef.current;
    if (!canvas || !pdfDoc) return;

    const page = await pdfDoc.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1.4 });
    const context = canvas.getContext('2d');
    if (!context) return;

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({ canvas, canvasContext: context, viewport }).promise;
  };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      onProgress({ percent: 0, stage: 'Carregando visualizador de PDF' });

      try {
        const pdfjsLib = await loadPdfjs();
        if (cancelled) return;

        onProgress({ percent: 10, stage: 'Abrindo PDF' });

        const data =
          typeof source === 'string' ? { url: source } : { data: await source.arrayBuffer() };
        const loadingTask = pdfjsLib.getDocument(data as Parameters<typeof pdfjsLib.getDocument>[0]);

        loadingTask.onProgress = ({ loaded, total }: { loaded: number; total: number }) => {
          onProgress({
            percent: total ? (loaded / total) * 100 : -1,
            stage: 'Carregando PDF',
          });
        };

        const pdfDoc = await loadingTask.promise;
        if (cancelled) return;

        pdfDocRef.current = pdfDoc;
        setPageInfo({ current: 1, total: pdfDoc.numPages });
        await renderPage(1);

        onProgress({ percent: 100, stage: 'Concluído' });
        onReady();
      } catch (err) {
        onError(err instanceof Error ? err : new Error('Falha ao carregar PDF'));
      }
    };

    load();

    return () => {
      cancelled = true;
      (pdfDocRef.current as any)?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  const goToPage = async (delta: number) => {
    const next = Math.min(Math.max(pageInfo.current + delta, 1), pageInfo.total);
    if (next === pageInfo.current) return;
    setPageInfo((prev) => ({ ...prev, current: next }));
    await renderPage(next);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', alignItems: 'center' }}>
      <div style={{ flex: 1, overflow: 'auto', width: '100%', display: 'flex', justifyContent: 'center' }}>
        <canvas ref={canvasRef} style={{ maxWidth: '100%', boxShadow: '0 1px 4px rgba(0,0,0,0.15)' }} />
      </div>
      {pageInfo.total > 1 && (
        <div style={{ display: 'flex', gap: 12, padding: 8, alignItems: 'center', fontSize: 13 }}>
          <button onClick={() => goToPage(-1)} disabled={pageInfo.current === 1}>
            Anterior
          </button>
          <span>
            Página {pageInfo.current} de {pageInfo.total}
          </span>
          <button onClick={() => goToPage(1)} disabled={pageInfo.current === pageInfo.total}>
            Próxima
          </button>
        </div>
      )}
    </div>
  );
};
