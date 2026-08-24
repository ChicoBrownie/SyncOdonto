-- Gestão Paperless centralizada
-- Execute no SQL Editor do Supabase. A migração preserva registros existentes.

ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_document_type_check;

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS procedure TEXT,
  ADD COLUMN IF NOT EXISTS content TEXT,
  ADD COLUMN IF NOT EXISTS storage_path TEXT,
  ADD COLUMN IF NOT EXISTS lead_name TEXT,
  ADD COLUMN IF NOT EXISTS lead_phone TEXT,
  ADD COLUMN IF NOT EXISTS items JSONB,
  ADD COLUMN IF NOT EXISTS total_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS payment_method TEXT;

UPDATE public.documents
SET status = CASE WHEN signed IS TRUE THEN 'signed' ELSE 'pending' END
WHERE status IS NULL OR status NOT IN ('signed', 'pending', 'draft', 'archived');

ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_status_check;
ALTER TABLE public.documents ADD CONSTRAINT documents_status_check
  CHECK (status IN ('signed', 'pending', 'draft', 'archived'));

CREATE INDEX IF NOT EXISTS documents_user_created_idx ON public.documents (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS documents_user_status_idx ON public.documents (user_id, status);
CREATE INDEX IF NOT EXISTS documents_patient_idx ON public.documents (patient_id);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documentos-clinica',
  'documentos-clinica',
  FALSE,
  15728640,
  ARRAY['application/pdf', 'image/png', 'image/jpeg']
)
ON CONFLICT (id) DO UPDATE SET
  public = FALSE,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "paperless_upload_own_folder" ON storage.objects;
CREATE POLICY "paperless_upload_own_folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'documentos-clinica'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "paperless_delete_own_folder" ON storage.objects;
CREATE POLICY "paperless_delete_own_folder"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'documentos-clinica'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
