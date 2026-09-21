-- Fluxo completo do odontograma: raiz, catálogo, orçamento e histórico imutável.
-- Execute depois de 007_dental_chart_surfaces.sql.

ALTER TABLE public.dental_charts
  ADD COLUMN IF NOT EXISTS last_appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_professional_name TEXT;

COMMENT ON COLUMN public.dental_charts.surface_conditions IS
  'Condições por região: vestibular, lingual, mesial, distal, occlusal e root.';

CREATE UNIQUE INDEX IF NOT EXISTS dental_charts_clinic_patient_tooth_idx
  ON public.dental_charts (user_id, patient_id, tooth_number);

CREATE TABLE IF NOT EXISTS public.procedure_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  default_price NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (default_price >= 0),
  is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, name)
);

ALTER TABLE public.procedure_catalog ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "procedure_catalog_select" ON public.procedure_catalog;
DROP POLICY IF EXISTS "procedure_catalog_insert" ON public.procedure_catalog;
DROP POLICY IF EXISTS "procedure_catalog_update" ON public.procedure_catalog;
DROP POLICY IF EXISTS "procedure_catalog_delete" ON public.procedure_catalog;
CREATE POLICY "procedure_catalog_select" ON public.procedure_catalog FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "procedure_catalog_insert" ON public.procedure_catalog FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "procedure_catalog_update" ON public.procedure_catalog FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "procedure_catalog_delete" ON public.procedure_catalog FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS procedure_catalog_user_active_idx
  ON public.procedure_catalog (user_id, is_active, is_favorite DESC, name);

DROP TRIGGER IF EXISTS update_procedure_catalog_updated_at ON public.procedure_catalog;
CREATE TRIGGER update_procedure_catalog_updated_at
  BEFORE UPDATE ON public.procedure_catalog
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.treatments
  ADD COLUMN IF NOT EXISTS procedure_id UUID REFERENCES public.procedure_catalog(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tooth_area TEXT,
  ADD COLUMN IF NOT EXISTS problem TEXT,
  ADD COLUMN IF NOT EXISTS cost NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS scheduled_date DATE,
  ADD COLUMN IF NOT EXISTS completed_date DATE,
  ADD COLUMN IF NOT EXISTS result_condition TEXT,
  ADD COLUMN IF NOT EXISTS professional_name TEXT;

UPDATE public.treatments
SET cost = COALESCE(cost, price)
WHERE cost IS NULL;

UPDATE public.treatments
SET scheduled_date = COALESCE(scheduled_date, start_date),
    completed_date = COALESCE(completed_date, end_date)
WHERE scheduled_date IS NULL OR completed_date IS NULL;

ALTER TABLE public.treatments DROP CONSTRAINT IF EXISTS treatments_tooth_area_check;
ALTER TABLE public.treatments ADD CONSTRAINT treatments_tooth_area_check
  CHECK (tooth_area IS NULL OR tooth_area IN ('vestibular', 'lingual', 'mesial', 'distal', 'occlusal', 'root', 'whole'));

CREATE INDEX IF NOT EXISTS treatments_appointment_idx ON public.treatments (appointment_id);
CREATE INDEX IF NOT EXISTS treatments_procedure_idx ON public.treatments (procedure_id);

CREATE TABLE IF NOT EXISTS public.dental_chart_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL CHECK (version_number > 0),
  snapshot JSONB NOT NULL,
  professional_name TEXT NOT NULL DEFAULT 'Profissional não informado',
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (patient_id, version_number)
);

ALTER TABLE public.dental_chart_versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "dental_chart_versions_select" ON public.dental_chart_versions;
DROP POLICY IF EXISTS "dental_chart_versions_insert" ON public.dental_chart_versions;
CREATE POLICY "dental_chart_versions_select" ON public.dental_chart_versions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "dental_chart_versions_insert" ON public.dental_chart_versions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS dental_chart_versions_patient_created_idx
  ON public.dental_chart_versions (user_id, patient_id, version_number DESC);

-- Gera uma fotografia completa: estado dos dentes e itens do plano/orçamento.
CREATE OR REPLACE FUNCTION public.capture_dental_chart_version(
  p_user_id UUID,
  p_patient_id UUID,
  p_professional_name TEXT,
  p_appointment_id UUID,
  p_created_by UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_version INTEGER;
  teeth_snapshot JSONB;
  treatments_snapshot JSONB;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text), hashtext(p_patient_id::text));

  SELECT COALESCE(MAX(version_number), 0) + 1
    INTO next_version
    FROM public.dental_chart_versions
   WHERE user_id = p_user_id AND patient_id = p_patient_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'tooth_number', tooth_number,
      'condition', condition,
      'surface_conditions', surface_conditions,
      'notes', notes,
      'updated_at', updated_at
    ) ORDER BY tooth_number), '[]'::jsonb)
    INTO teeth_snapshot
    FROM public.dental_charts
   WHERE user_id = p_user_id AND patient_id = p_patient_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', id,
      'tooth_number', tooth_number,
      'tooth_area', tooth_area,
      'problem', problem,
      'treatment_type', treatment_type,
      'status', status,
      'cost', cost,
      'notes', notes,
      'appointment_id', appointment_id,
      'result_condition', result_condition,
      'created_at', created_at,
      'updated_at', updated_at
    ) ORDER BY created_at, id), '[]'::jsonb)
    INTO treatments_snapshot
    FROM public.treatments
   WHERE user_id = p_user_id AND patient_id = p_patient_id;

  INSERT INTO public.dental_chart_versions (
    user_id, patient_id, version_number, snapshot,
    professional_name, appointment_id, created_by
  ) VALUES (
    p_user_id,
    p_patient_id,
    next_version,
    jsonb_build_object('teeth', teeth_snapshot, 'treatments', treatments_snapshot),
    COALESCE(NULLIF(trim(p_professional_name), ''), 'Profissional não informado'),
    p_appointment_id,
    p_created_by
  );
END;
$$;

-- Preserva o estado existente como a primeira versão antes de ativar os gatilhos.
INSERT INTO public.dental_chart_versions (
  user_id, patient_id, version_number, snapshot, professional_name, created_at
)
SELECT scope.user_id,
       scope.patient_id,
       1,
       jsonb_build_object(
         'teeth', COALESCE((
           SELECT jsonb_agg(jsonb_build_object(
             'tooth_number', dc.tooth_number,
             'condition', dc.condition,
             'surface_conditions', dc.surface_conditions,
             'notes', dc.notes,
             'updated_at', dc.updated_at
           ) ORDER BY dc.tooth_number)
           FROM public.dental_charts dc
           WHERE dc.user_id = scope.user_id AND dc.patient_id = scope.patient_id
         ), '[]'::jsonb),
         'treatments', COALESCE((
           SELECT jsonb_agg(jsonb_build_object(
             'id', t.id,
             'tooth_number', t.tooth_number,
             'tooth_area', t.tooth_area,
             'problem', t.problem,
             'treatment_type', t.treatment_type,
             'status', t.status,
             'cost', t.cost,
             'notes', t.notes,
             'appointment_id', t.appointment_id,
             'result_condition', t.result_condition,
             'created_at', t.created_at,
             'updated_at', t.updated_at
           ) ORDER BY t.created_at, t.id)
           FROM public.treatments t
           WHERE t.user_id = scope.user_id AND t.patient_id = scope.patient_id
         ), '[]'::jsonb)
       ),
       'Estado anterior à atualização do odontograma',
       NOW()
FROM (
  SELECT user_id, patient_id FROM public.dental_charts
  UNION
  SELECT user_id, patient_id FROM public.treatments
) scope
WHERE NOT EXISTS (
  SELECT 1 FROM public.dental_chart_versions v
  WHERE v.user_id = scope.user_id AND v.patient_id = scope.patient_id
);

CREATE OR REPLACE FUNCTION public.capture_version_from_dental_chart()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  source_row public.dental_charts%ROWTYPE;
BEGIN
  source_row := COALESCE(NEW, OLD);
  PERFORM public.capture_dental_chart_version(
    source_row.user_id,
    source_row.patient_id,
    source_row.last_professional_name,
    source_row.last_appointment_id,
    auth.uid()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.capture_version_from_treatment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  source_row public.treatments%ROWTYPE;
BEGIN
  source_row := COALESCE(NEW, OLD);
  PERFORM public.capture_dental_chart_version(
    source_row.user_id,
    source_row.patient_id,
    source_row.professional_name,
    source_row.appointment_id,
    auth.uid()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION public.capture_dental_chart_version(UUID, UUID, TEXT, UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.capture_version_from_dental_chart() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.capture_version_from_treatment() FROM PUBLIC;

DROP TRIGGER IF EXISTS dental_chart_version_after_change ON public.dental_charts;
CREATE TRIGGER dental_chart_version_after_change
  AFTER INSERT OR UPDATE OR DELETE ON public.dental_charts
  FOR EACH ROW EXECUTE FUNCTION public.capture_version_from_dental_chart();

DROP TRIGGER IF EXISTS treatment_version_after_change ON public.treatments;
CREATE TRIGGER treatment_version_after_change
  AFTER INSERT OR UPDATE OR DELETE ON public.treatments
  FOR EACH ROW EXECUTE FUNCTION public.capture_version_from_treatment();

COMMENT ON TABLE public.dental_chart_versions IS
  'Histórico imutável do odontograma. Não expor operações de atualização ou exclusão.';
