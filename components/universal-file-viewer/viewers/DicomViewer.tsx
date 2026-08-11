import React, { useEffect, useRef, useState } from 'react';
import { ViewerProps } from '../types';

let isConfigured = false;

// cornerstone-core and its loaders touch `window` as soon as they're imported, which crashes
// Next.js SSR (there is no `window` on the server). We load them dynamically inside useEffect,
// which only ever runs in the browser, so the modules are never evaluated server-side.
async function loadCornerstoneModules() {
  const [cornerstone, cornerstoneWADOImageLoader, dicomParser] = await Promise.all([
    import('cornerstone-core'),
    import('cornerstone-wado-image-loader'),
    import('dicom-parser'),
  ]);

  if (!isConfigured) {
    cornerstoneWADOImageLoader.external.cornerstone = cornerstone;
    cornerstoneWADOImageLoader.external.dicomParser = dicomParser;
    cornerstoneWADOImageLoader.configure({ useWebWorkers: true });
    isConfigured = true;
  }

  return { cornerstone, cornerstoneWADOImageLoader };
}

interface WindowLevel {
  windowWidth: number;
  windowCenter: number;
}

export const DicomViewer: React.FC<ViewerProps> = ({ source, onProgress, onReady, onError }) => {
  const elementRef = useRef<HTMLDivElement>(null);
  const [windowLevel, setWindowLevel] = useState<WindowLevel | null>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    let cancelled = false;
    let cleanupListeners: (() => void) | undefined;

    const run = async () => {
      onProgress({ percent: 0, stage: 'Carregando visualizador DICOM' });

      const { cornerstone, cornerstoneWADOImageLoader } = await loadCornerstoneModules();
      if (cancelled) return;

      cornerstone.enable(element);

      onProgress({ percent: 30, stage: 'Lendo cabeçalho DICOM' });

      try {
        const imageId =
          typeof source === 'string'
            ? `wadouri:${source}`
            : `wadouri:${cornerstoneWADOImageLoader.wadouri.fileManager.add(source)}`;

        const image = await cornerstone.loadAndCacheImage(imageId);
        if (cancelled) return;

        cornerstone.displayImage(element, image);
        setWindowLevel({
          windowWidth: image.windowWidth as number,
          windowCenter: image.windowCenter as number,
        });

        onProgress({ percent: 100, stage: 'Concluído' });
        onReady();
      } catch (err) {
        onError(err instanceof Error ? err : new Error('Falha ao carregar arquivo DICOM'));
        return;
      }

      // Pan + zoom via cornerstone-tools would normally be wired here; kept minimal/manual below
      // for zero extra dependency beyond cornerstone-core.
      let isDragging = false;
      let lastX = 0;
      let lastY = 0;

      const handleMouseDown = (e: MouseEvent) => {
        isDragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
      };
      const handleMouseUp = () => {
        isDragging = false;
      };
      const handleMouseMove = (e: MouseEvent) => {
        if (!isDragging) return;
        const viewport = cornerstone.getViewport(element);
        if (!viewport) return;

        if (e.shiftKey) {
          // Shift + drag = pan
          viewport.translation.x += (e.clientX - lastX) / viewport.scale;
          viewport.translation.y += (e.clientY - lastY) / viewport.scale;
        } else {
          // Drag = window/level adjustment
          viewport.voi.windowWidth += (e.clientX - lastX) * 2;
          viewport.voi.windowCenter += (e.clientY - lastY) * 2;
          setWindowLevel({
            windowWidth: viewport.voi.windowWidth,
            windowCenter: viewport.voi.windowCenter,
          });
        }
        cornerstone.setViewport(element, viewport);
        lastX = e.clientX;
        lastY = e.clientY;
      };
      const handleWheel = (e: WheelEvent) => {
        e.preventDefault();
        const viewport = cornerstone.getViewport(element);
        if (!viewport) return;
        viewport.scale += e.deltaY > 0 ? -0.1 : 0.1;
        viewport.scale = Math.max(0.1, viewport.scale);
        cornerstone.setViewport(element, viewport);
      };

      element.addEventListener('mousedown', handleMouseDown);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('mousemove', handleMouseMove);
      element.addEventListener('wheel', handleWheel, { passive: false });

      cleanupListeners = () => {
        element.removeEventListener('mousedown', handleMouseDown);
        window.removeEventListener('mouseup', handleMouseUp);
        window.removeEventListener('mousemove', handleMouseMove);
        element.removeEventListener('wheel', handleWheel);
        cornerstone.disable(element);
      };
    };

    run();

    return () => {
      cancelled = true;
      cleanupListeners?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 400 }}>
      <div
        ref={elementRef}
        style={{ flex: 1, backgroundColor: '#000', minHeight: 360 }}
        onContextMenu={(e) => e.preventDefault()}
      />
      {windowLevel && (
        <div style={{ padding: '4px 8px', fontSize: 12, color: '#666' }}>
          W: {Math.round(windowLevel.windowWidth)} · L: {Math.round(windowLevel.windowCenter)}
          <span style={{ marginLeft: 12, opacity: 0.7 }}>
            Arraste: ajustar brilho/contraste · Shift+arraste: mover · Scroll: zoom
          </span>
        </div>
      )}
    </div>
  );
};
