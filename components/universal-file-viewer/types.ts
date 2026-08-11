export type MeshExtension = 'stl' | 'obj' | 'ply';
export type DicomExtension = 'dcm' | 'dicom';
export type DocumentExtension = 'pdf';
export type ImageExtension = 'jpg' | 'jpeg' | 'png' | 'webp';

export type SupportedExtension =
  | MeshExtension
  | DicomExtension
  | DocumentExtension
  | ImageExtension;

export type ViewerKind = 'mesh' | 'dicom' | 'document' | 'image' | 'unsupported';

export interface LoadProgress {
  /** 0 to 100. Use -1 for indeterminate progress (e.g. unknown content-length). */
  percent: number;
  stage: string;
}

export interface ViewerProps {
  /** Either a File picked by the user, or a URL/path already hosted somewhere. */
  source: File | string;
  fileName: string;
  onProgress: (progress: LoadProgress) => void;
  onReady: () => void;
  onError: (error: Error) => void;
}

export interface UniversalFileViewerProps {
  /** File object (from input/drag-drop) or a URL to an already-uploaded file. */
  file?: File | string;
  /** Explicit filename, required when `file` is a bare URL without a clear extension. */
  fileName?: string;
  /** Allow the built-in dropzone/file-picker when no file is supplied yet. Default: true. */
  allowUpload?: boolean;
  /** Restricts the file picker's `accept` attribute and drag validation. */
  acceptedExtensions?: SupportedExtension[];
  onFileSelected?: (file: File) => void;
  onError?: (error: Error) => void;
  className?: string;
}

export const EXTENSION_TO_KIND: Record<SupportedExtension, ViewerKind> = {
  stl: 'mesh',
  obj: 'mesh',
  ply: 'mesh',
  dcm: 'dicom',
  dicom: 'dicom',
  pdf: 'document',
  jpg: 'image',
  jpeg: 'image',
  png: 'image',
  webp: 'image',
};

export function getExtension(fileName: string): string {
  const parts = fileName.toLowerCase().split('.');
  return parts.length > 1 ? parts[parts.length - 1] : '';
}

export function resolveViewerKind(fileName: string): ViewerKind {
  const ext = getExtension(fileName) as SupportedExtension;
  return EXTENSION_TO_KIND[ext] ?? 'unsupported';
}
