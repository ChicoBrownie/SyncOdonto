-- Biblioteca simples de modelos odontológicos personalizados por clínica.
CREATE TABLE IF NOT EXISTS public.paperless_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_type TEXT NOT NULL CHECK (template_type IN ('dental_certificate', 'dental_prescription', 'anamnesis')),
  content TEXT NOT NULL,
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, template_type)
);

ALTER TABLE public.paperless_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "paperless_templates_select" ON public.paperless_templates;
DROP POLICY IF EXISTS "paperless_templates_insert" ON public.paperless_templates;
DROP POLICY IF EXISTS "paperless_templates_update" ON public.paperless_templates;
DROP POLICY IF EXISTS "paperless_templates_delete" ON public.paperless_templates;
CREATE POLICY "paperless_templates_select" ON public.paperless_templates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "paperless_templates_insert" ON public.paperless_templates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "paperless_templates_update" ON public.paperless_templates FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "paperless_templates_delete" ON public.paperless_templates FOR DELETE USING (auth.uid() = user_id);
