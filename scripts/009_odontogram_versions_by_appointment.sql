-- O histórico do odontograma representa atendimentos concluídos, nunca cliques isolados.
-- As versões já registradas são preservadas: as intermediárias passam a ser apenas
-- registros legados e deixam de ser exibidas na linha do tempo clínica.

ALTER TABLE public.dental_chart_versions
  ADD COLUMN IF NOT EXISTS snapshot_type TEXT NOT NULL DEFAULT 'legacy_change';

ALTER TABLE public.dental_chart_versions
  DROP CONSTRAINT IF EXISTS dental_chart_versions_snapshot_type_check;
ALTER TABLE public.dental_chart_versions
  ADD CONSTRAINT dental_chart_versions_snapshot_type_check
  CHECK (snapshot_type IN ('initial', 'appointment_closed', 'legacy_change'));

-- A primeira fotografia criada na migração anterior é o estado inicial do paciente.
UPDATE public.dental_chart_versions
   SET snapshot_type = 'initial'
 WHERE version_number = 1
   AND appointment_id IS NULL
   AND snapshot_type = 'legacy_change';

-- Impede a criação acidental de duas fotografias para o mesmo atendimento encerrado.
CREATE UNIQUE INDEX IF NOT EXISTS dental_chart_versions_closed_appointment_unique
  ON public.dental_chart_versions (user_id, patient_id, appointment_id)
  WHERE snapshot_type = 'appointment_closed';

-- Os gatilhos antigos registravam uma versão a cada alteração de dente ou tratamento.
-- Removemos apenas os gatilhos: nenhuma versão anterior é apagada.
DROP TRIGGER IF EXISTS dental_chart_version_after_change ON public.dental_charts;
DROP TRIGGER IF EXISTS treatment_version_after_change ON public.treatments;

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
  -- Uma versão clínica só nasce ao encerrar um atendimento identificado.
  IF p_appointment_id IS NULL THEN
    RETURN;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text), hashtext(p_patient_id::text));

  -- A alteração de status pode ser repetida pela interface; a fotografia continua única.
  IF EXISTS (
    SELECT 1
      FROM public.dental_chart_versions
     WHERE user_id = p_user_id
       AND patient_id = p_patient_id
       AND appointment_id = p_appointment_id
       AND snapshot_type = 'appointment_closed'
  ) THEN
    RETURN;
  END IF;

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

CREATE OR REPLACE FUNCTION public.capture_version_on_appointment_close()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'Concluída' AND OLD.status IS DISTINCT FROM 'Concluída' THEN
    PERFORM public.capture_dental_chart_version(
      NEW.user_id,
      NEW.patient_id,
      NEW.doctor_name,
      NEW.id,
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS dental_chart_version_on_appointment_close ON public.appointments;
CREATE TRIGGER dental_chart_version_on_appointment_close
  AFTER UPDATE OF status ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.capture_version_on_appointment_close();

REVOKE ALL ON FUNCTION public.capture_dental_chart_version(UUID, UUID, TEXT, UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.capture_version_on_appointment_close() FROM PUBLIC;

COMMENT ON TABLE public.dental_chart_versions IS
  'Histórico imutável do odontograma: estado inicial e uma fotografia para cada atendimento concluído.';
