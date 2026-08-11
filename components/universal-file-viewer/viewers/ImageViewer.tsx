import React, { useEffect, useRef, useState } from 'react';
import { useFileSource } from '@/hooks/use-file-source';
import { ViewerProps } from '../types';

export const ImageViewer: React.FC<ViewerProps> = ({ source, fileName, onProgress, onReady, onError }) => {
  const { resolvedUrl } = useFileSource(source, fileName);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragState = useRef<{ dragging: boolean; lastX: number; lastY: number }>({
    dragging: false,
    lastX: 0,
    lastY: 0,
  });

  useEffect(() => {
    if (!resolvedUrl) return;
    onProgress({ percent: 0, stage: 'Carregando imagem' });
  }, [resolvedUrl, onProgress]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((prev) => Math.min(Math.max(prev + (e.deltaY > 0 ? -0.1 : 0.1), 0.2), 6));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    dragState.current = { dragging: true, lastX: e.clientX, lastY: e.clientY };
  };
  const handleMouseUp = () => {
    dragState.current.dragging = false;
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragState.current.dragging) return;
    const dx = e.clientX - dragState.current.lastX;
    const dy = e.clientY - dragState.current.lastY;
    setPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
    dragState.current.lastX = e.clientX;
    dragState.current.lastY = e.clientY;
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  if (!resolvedUrl) return null;

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onMouseMove={handleMouseMove}
      onDoubleClick={resetView}
      style={{
        width: '100%',
        height: '100%',
        minHeight: 400,
        overflow: 'hidden',
        cursor: dragState.current.dragging ? 'grabbing' : 'grab',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#111',
      }}
    >
      <img
        src={resolvedUrl}
        alt={fileName}
        draggable={false}
        onLoad={() => {
          onProgress({ percent: 100, stage: 'Concluído' });
          onReady();
        }}
        onError={() => onError(new Error('Falha ao carregar imagem'))}
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transition: dragState.current.dragging ? 'none' : 'transform 0.05s linear',
          maxWidth: '100%',
          maxHeight: '100%',
          userSelect: 'none',
        }}
      />
    </div>
  );
};
