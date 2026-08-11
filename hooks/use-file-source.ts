import { useEffect, useMemo, useState } from 'react';
import { resolveViewerKind, ViewerKind } from '@/components/universal-file-viewer/types';

interface UseFileSourceResult {
  kind: ViewerKind;
  fileName: string;
  /** Object URL when `source` is a File, otherwise the original URL string. */
  resolvedUrl: string | null;
}

/**
 * Normalizes a `File | string` source into a resolved URL + detected viewer kind.
 * Handles creation/cleanup of object URLs for in-memory File objects.
 */
export function useFileSource(
  source: File | string | undefined,
  explicitFileName?: string
): UseFileSourceResult {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);

  const fileName = useMemo(() => {
    if (!source) return explicitFileName ?? '';
    if (typeof source === 'string') {
      return explicitFileName ?? source.split('/').pop() ?? source;
    }
    return source.name;
  }, [source, explicitFileName]);

  const kind = useMemo(() => resolveViewerKind(fileName), [fileName]);

  useEffect(() => {
    if (!source) {
      setResolvedUrl(null);
      return;
    }

    if (typeof source === 'string') {
      setResolvedUrl(source);
      return;
    }

    const objectUrl = URL.createObjectURL(source);
    setResolvedUrl(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [source]);

  return { kind, fileName, resolvedUrl };
}
