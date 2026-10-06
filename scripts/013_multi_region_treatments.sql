-- Um procedimento pode abranger várias regiões do mesmo dente.
ALTER TABLE public.treatments
  ADD COLUMN IF NOT EXISTS tooth_areas TEXT[];

ALTER TABLE public.treatments
  DROP CONSTRAINT IF EXISTS treatments_tooth_areas_check;

ALTER TABLE public.treatments
  ADD CONSTRAINT treatments_tooth_areas_check
  CHECK (
    tooth_areas IS NULL OR (
      cardinality(tooth_areas) BETWEEN 1 AND 6 AND
      tooth_areas <@ ARRAY['vestibular', 'lingual', 'mesial', 'distal', 'occlusal', 'root', 'whole']::TEXT[] AND
      (NOT ('whole' = ANY(tooth_areas)) OR cardinality(tooth_areas) = 1)
    )
  );

COMMENT ON COLUMN public.treatments.tooth_areas IS
  'Regiões do dente cobertas por um único procedimento e valor. tooth_area permanece como região primária para compatibilidade.';

-- Mantém as regiões selecionadas nas fotografias históricas do odontograma.
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
  IF p_appointment_id IS NULL THEN
    RETURN;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text), hashtext(p_patient_id::text));

  IF EXISTS (
    SELECT 1 FROM public.dental_chart_versions
     WHERE user_id = p_user_id AND patient_id = p_patient_id
       AND appointment_id = p_appointment_id AND snapshot_type = 'appointment_closed'
  ) THEN
    RETURN;
  END IF;

  SELECT COALESCE(MAX(version_number), 0) + 1 INTO next_version
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
      'tooth_areas', tooth_areas,
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
    user_id, patient_id, version_number, snapshot, snapshot_type,
    professional_name, appointment_id, created_by
  ) VALUES (
    p_user_id,
    p_patient_id,
    next_version,
    jsonb_build_object('teeth', teeth_snapshot, 'treatments', treatments_snapshot),
    'appointment_closed',
    COALESCE(NULLIF(trim(p_professional_name), ''), 'Profissional não informado'),
    p_appointment_id,
    p_created_by
  );
END;
$$;
