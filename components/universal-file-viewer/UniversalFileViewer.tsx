import React, { useCallback, useState } from 'react';
import { useFileSource } from '@/hooks/use-file-source';
import { MeshViewer } from './viewers/MeshViewer';
import { DicomViewer } from './viewers/DicomViewer';
import { DocumentViewer } from './viewers/DocumentViewer';
import { ImageViewer } from './viewers/ImageViewer';
import { LoadProgress, UniversalFileViewerProps, ViewerProps } from './types';

const ACCEPT_ALL = '.stl,.obj,.ply,.dcm,.dicom,.pdf,.jpg,.jpeg,.png,.webp';

/**
 * UniversalFileViewer
 *
 * Detects the type of an odontological file (3D mesh, DICOM exam, PDF, or image)
 * by extension, and renders the correct specialized viewer. Handles drag-and-drop /
 * manual upload when no file is supplied, plus a shared loading state.
 */
export const UniversalFileViewer: React.FC<UniversalFileViewerProps> = ({
  file,
  fileName,
  allowUpload = true,
  acceptedExtensions,
  onFileSelected,
  onError,
  className,
}) => {
  const [internalFile, setInternalFile] = useState<File | string | undefined>(file);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [progress, setProgress] = useState<LoadProgress | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [ready, setReady] = useState(false);

  const activeSource = file ?? internalFile;
  const { kind, fileName: resolvedFileName } = useFileSource(activeSource, fileName);

  const acceptAttr = acceptedExtensions ? acceptedExtensions.map((ext) => `.${ext}`).join(',') : ACCEPT_ALL;

  const handleFile = useCallback(
    (nextFile: File) => {
      setError(null);
      setReady(false);
      setProgress(null);
      setInternalFile(nextFile);
      onFileSelected?.(nextFile);
    },
    [onFileSelected]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    if (picked) handleFile(picked);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) handleFile(dropped);
  };

  const handleViewerError = useCallback(
    (err: Error) => {
      setError(err);
      onError?.(err);
    },
    [onError]
  );

  const handleViewerReady = useCallback(() => {
    setReady(true);
    setProgress({ percent: 100, stage: 'Concluído' });
  }, []);

  const handleViewerProgress = useCallback((p: LoadProgress) => {
    setProgress(p);
  }, []);

  // Nothing loaded yet: show dropzone (if allowed) or an empty state.
  if (!activeSource) {
    if (!allowUpload) {
      return <div className={className}>Nenhum arquivo selecionado.</div>;
    }
    return (
      <div
        className={className}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDraggingOver(true);
        }}
        onDragLeave={() => setIsDraggingOver(false)}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${isDraggingOver ? '#4a90d9' : '#ccc'}`,
          borderRadius: 8,
          padding: 32,
          textAlign: 'center',
          backgroundColor: isDraggingOver ? '#f0f6fc' : 'transparent',
        }}
      >
        <p style={{ marginBottom: 12 }}>
          Arraste um arquivo (.stl, .obj, .ply, .dcm, .pdf, .jpg, .png, .webp) ou
        </p>
        <label style={{ cursor: 'pointer', color: '#4a90d9', textDecoration: 'underline' }}>
          selecione do computador
          <input type="file" accept={acceptAttr} onChange={handleInputChange} style={{ display: 'none' }} />
        </label>
      </div>
    );
  }

  const viewerProps: ViewerProps = {
    source: activeSource,
    fileName: resolvedFileName,
    onProgress: handleViewerProgress,
    onReady: handleViewerReady,
    onError: handleViewerError,
  };

  return (
    <div className={className} style={{ position: 'relative', width: '100%', height: '100%' }}>
      {!ready && !error && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            backgroundColor: 'rgba(255,255,255,0.85)',
            zIndex: 10,
          }}
        >
          <div style={{ width: 160, height: 4, backgroundColor: '#eee', borderRadius: 2, overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                backgroundColor: '#4a90d9',
                width: progress && progress.percent >= 0 ? `${progress.percent}%` : '40%',
                transition: 'width 0.2s ease',
              }}
            />
          </div>
          <span style={{ fontSize: 12, color: '#666' }}>{progress?.stage ?? 'Preparando'}</span>
        </div>
      )}

      {error && (
        <div style={{ padding: 24, color: '#c0392b' }}>
          <strong>Não foi possível carregar o arquivo.</strong>
          <p style={{ fontSize: 13 }}>{error.message}</p>
        </div>
      )}

      {!error && renderViewerForKind(kind, viewerProps)}
    </div>
  );
};

function renderViewerForKind(kind: ReturnType<typeof useFileSource>['kind'], viewerProps: ViewerProps) {
  switch (kind) {
    case 'mesh':
      return <MeshViewer {...viewerProps} />;
    case 'dicom':
      return <DicomViewer {...viewerProps} />;
    case 'document':
      return <DocumentViewer {...viewerProps} />;
    case 'image':
      return <ImageViewer {...viewerProps} />;
    default:
      return (
        <div style={{ padding: 24, color: '#666' }}>
          Formato de arquivo não suportado: <strong>{viewerProps.fileName}</strong>
        </div>
      );
  }
}

export default UniversalFileViewer;
