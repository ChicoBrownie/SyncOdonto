-- Atendimento móvel. Aplicar manualmente em ambiente fictício após backup.
-- Requer o esquema OPERACIONAL usado pelas APIs (não apenas o bootstrap 001).
BEGIN;
DO $$
BEGIN
  IF to_regclass('public.anamnesis_records') IS NULL
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='patients' AND column_name='date_of_birth')
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='appointments' AND column_name='date')
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='financial_transactions' AND column_name='type') THEN
    RAISE EXCEPTION '014 requer o esquema operacional documentado em docs/MOBILE_ATTENDANCE.md. Não aplicar sobre 001 isoladamente.';
  END IF;
END $$;

CREATE TABLE public.encounter_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_id uuid REFERENCES public.patients(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES public.appointments(id),
  step text NOT NULL DEFAULT 'patient' CHECK (step IN ('patient','anamnesis','chart','budget','signature','financial')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(payload)='object'),
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','discarded')),
  signed_document_id uuid REFERENCES public.documents(id),
  anamnesis_id uuid REFERENCES public.anamnesis_records(id),
  medical_record_id uuid REFERENCES public.medical_records(id),
  clinical_revision integer,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.encounter_drafts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.encounter_drafts FROM anon, authenticated;
GRANT ALL ON public.encounter_drafts TO service_role;
CREATE INDEX encounter_drafts_resume_idx ON public.encounter_drafts(clinic_id, actor_user_id, updated_at DESC) WHERE status='active';
CREATE UNIQUE INDEX encounter_one_active_patient_idx ON public.encounter_drafts(clinic_id, actor_user_id, patient_id) WHERE status='active' AND patient_id IS NOT NULL;

CREATE TABLE public.encounter_guide_visits (
  clinic_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  area text NOT NULL CHECK (length(area) BETWEEN 1 AND 80),
  visited_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (clinic_id, actor_user_id, area)
);
ALTER TABLE public.encounter_guide_visits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.encounter_guide_visits FROM anon, authenticated;
GRANT ALL ON public.encounter_guide_visits TO service_role;

ALTER TABLE public.documents ADD COLUMN encounter_id uuid REFERENCES public.encounter_drafts(id),
  ADD COLUMN encounter_revision integer, ADD COLUMN snapshot_hash text;
CREATE UNIQUE INDEX encounter_document_once_idx ON public.documents(encounter_id) WHERE encounter_id IS NOT NULL;
ALTER TABLE public.financial_transactions ADD COLUMN IF NOT EXISTS source_appointment_id uuid REFERENCES public.appointments(id);
-- Abort on historical duplicates; never delete or merge real financial records automatically.
CREATE UNIQUE INDEX IF NOT EXISTS financial_source_appointment_once_idx ON public.financial_transactions(user_id, source_appointment_id) WHERE source_appointment_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.guard_encounter_document() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF TG_OP='DELETE' AND OLD.encounter_id IS NOT NULL AND OLD.signed THEN
    RAISE EXCEPTION 'Documento assinado do atendimento deve ser preservado.';
  END IF;
  IF TG_OP='UPDATE' AND OLD.encounter_id IS NOT NULL AND OLD.signed AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'Esta versão assinada é imutável. Crie outro atendimento para uma nova proposta.';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER immutable_encounter_document BEFORE UPDATE OR DELETE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.guard_encounter_document();

CREATE OR REPLACE FUNCTION public.save_encounter_draft(p_id uuid,p_clinic uuid,p_actor uuid,p_revision integer,p_step text,p_payload jsonb)
RETURNS public.encounter_drafts LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d public.encounter_drafts;
BEGIN
  SELECT * INTO d FROM public.encounter_drafts WHERE id=p_id AND clinic_id=p_clinic AND actor_user_id=p_actor FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF d.status<>'active' OR d.revision<>p_revision THEN RAISE EXCEPTION USING ERRCODE='40001', MESSAGE='Este atendimento mudou em outra aba ou foi encerrado. Recarregue a versão salva antes de continuar.'; END IF;
  IF d.signed_document_id IS NOT NULL AND p_payload->'budget' IS DISTINCT FROM d.payload->'budget' THEN
    RAISE EXCEPTION 'O orçamento assinado não pode ser alterado.';
  END IF;
  UPDATE public.encounter_drafts SET payload=p_payload,step=p_step,revision=revision+1,updated_at=now() WHERE id=p_id RETURNING * INTO d;
  RETURN d;
END $$;

-- All appointment writers share this lock, including legacy APIs. This closes
-- the race between the existing read-before-insert check and a concurrent insert.
CREATE OR REPLACE FUNCTION public.guard_appointment_slot() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('appointment:'||NEW.user_id::text,0));
  IF TG_OP='UPDATE' AND OLD.status='Concluída' AND (NEW.cost IS DISTINCT FROM OLD.cost OR NEW.patient_id IS DISTINCT FROM OLD.patient_id OR NEW.status IS DISTINCT FROM OLD.status) THEN
    RAISE EXCEPTION 'Consulta já concluída. Preserve o vínculo e confira qualquer correção de cobrança no financeiro.';
  END IF;
  IF NEW.status NOT IN ('Cancelada','Concluída','Falta') AND EXISTS (
    SELECT 1 FROM public.appointments a WHERE a.user_id=NEW.user_id AND a.id<>NEW.id AND a.date=NEW.date
      AND a.status NOT IN ('Cancelada','Concluída','Falta')
      AND (a.patient_id=NEW.patient_id OR lower(trim(a.doctor_name))=lower(trim(NEW.doctor_name)))
      AND (extract(epoch FROM a.time::time)/60) < (extract(epoch FROM NEW.time::time)/60)+coalesce(NEW.duration_minutes,60)
      AND (extract(epoch FROM NEW.time::time)/60) < (extract(epoch FROM a.time::time)/60)+coalesce(a.duration_minutes,60)
  ) THEN RAISE EXCEPTION 'Conflito de horário do paciente ou profissional. Escolha a consulta já agendada ou outro horário.'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER appointment_slot_guard BEFORE INSERT OR UPDATE OF date,time,doctor_name,patient_id,duration_minutes,status,cost ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.guard_appointment_slot();

CREATE OR REPLACE FUNCTION public.create_appointment_financial_pending() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.status='Concluída' AND OLD.status IS DISTINCT FROM 'Concluída' THEN
    IF OLD.status<>'Em Andamento' THEN RAISE EXCEPTION 'Somente uma consulta em andamento pode ser encerrada.'; END IF;
    IF NEW.cost IS NULL OR NEW.cost<=0 THEN RAISE EXCEPTION 'Confirme um valor positivo da consulta antes de encaminhar ao financeiro.'; END IF;
    INSERT INTO public.financial_transactions(user_id,patient_id,description,amount,payment_method,type,status,verification_status,source_appointment_id)
    VALUES(NEW.user_id,NEW.patient_id,'Consulta - '||coalesce(NEW.procedure_type,'Consulta'),NEW.cost,NULL,'income','pending','pending_verification',NEW.id)
    ON CONFLICT (user_id,source_appointment_id) WHERE source_appointment_id IS NOT NULL DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER appointment_financial_pending AFTER UPDATE OF status ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.create_appointment_financial_pending();

CREATE OR REPLACE FUNCTION public.perform_encounter_action(p_id uuid,p_clinic uuid,p_actor uuid,p_revision integer,p_action text,p_input jsonb DEFAULT '{}'::jsonb)
RETURNS public.encounter_drafts LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d public.encounter_drafts; a public.appointments; v_patient uuid; v_document uuid; v_anamnesis uuid; v_record uuid; v_item jsonb; v_treatment public.treatments;
BEGIN
  -- Always take the clinic slot lock BEFORE row locks to avoid reversed lock order.
  PERFORM pg_advisory_xact_lock(hashtextextended('appointment:'||p_clinic::text,0));
  SELECT * INTO d FROM public.encounter_drafts WHERE id=p_id AND clinic_id=p_clinic AND actor_user_id=p_actor FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  -- Retries after a lost response return the original artifact, never another one.
  IF p_action='sign' AND d.signed_document_id IS NOT NULL THEN RETURN d; END IF;
  IF p_action='complete' AND d.status='completed' THEN RETURN d; END IF;
  IF p_action='register' AND d.patient_id IS NOT NULL THEN RETURN d; END IF;
  IF p_action='schedule' AND d.appointment_id IS NOT NULL THEN RETURN d; END IF;
  IF p_action='discard' AND d.status='discarded' THEN RETURN d; END IF;
  IF d.status<>'active' OR d.revision<>p_revision THEN RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='Este atendimento mudou em outra aba. Recarregue a versão salva.'; END IF;
  IF d.patient_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.patients WHERE id=d.patient_id AND user_id=p_clinic) THEN RAISE EXCEPTION 'Paciente indisponível nesta clínica.'; END IF;

  IF p_action='choose_patient' THEN
    IF d.patient_id IS NOT NULL THEN RAISE EXCEPTION 'Paciente já definido. Inicie outro atendimento para trocar de paciente.'; END IF;
    v_patient := (p_input->>'patient_id')::uuid;
    IF NOT EXISTS(SELECT 1 FROM public.patients WHERE id=v_patient AND user_id=p_clinic) THEN RAISE EXCEPTION 'Paciente indisponível nesta clínica.'; END IF;
    UPDATE public.encounter_drafts SET patient_id=v_patient WHERE id=p_id;
  ELSIF p_action='register' THEN
    SELECT id INTO v_patient FROM public.patients WHERE user_id=p_clinic AND regexp_replace(cpf,'\D','','g')=regexp_replace(d.payload->'registration'->>'cpf','\D','','g') LIMIT 1;
    IF v_patient IS NULL THEN
      INSERT INTO public.patients(user_id,full_name,date_of_birth,cpf,phone)
      VALUES(p_clinic,d.payload->'registration'->>'full_name',(d.payload->'registration'->>'date_of_birth')::date,d.payload->'registration'->>'cpf',nullif(d.payload->'registration'->>'phone','')) RETURNING id INTO v_patient;
    END IF;
    UPDATE public.encounter_drafts SET patient_id=v_patient WHERE id=p_id;
  ELSIF p_action IN ('start','schedule') THEN
    IF d.patient_id IS NULL THEN RAISE EXCEPTION 'Selecione um paciente.'; END IF;
    IF d.appointment_id IS NOT NULL THEN
      SELECT * INTO a FROM public.appointments WHERE id=d.appointment_id AND user_id=p_clinic AND patient_id=d.patient_id FOR UPDATE;
    ELSIF p_input->>'appointment_id' IS NOT NULL THEN
      SELECT * INTO a FROM public.appointments WHERE id=(p_input->>'appointment_id')::uuid AND user_id=p_clinic AND patient_id=d.patient_id FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Consulta indisponível nesta clínica.'; END IF;
    ELSE
      SELECT * INTO a FROM public.appointments WHERE user_id=p_clinic AND patient_id=d.patient_id AND
        (status='Em Andamento' OR (date=(d.payload->'appointment'->>'date')::date AND time::time=(d.payload->'appointment'->>'time')::time AND status IN ('Pendente','Confirmada','Aguardando')))
        ORDER BY (status='Em Andamento') DESC LIMIT 1 FOR UPDATE;
    END IF;
    IF a.id IS NULL THEN
      INSERT INTO public.appointments(user_id,patient_id,date,time,duration_minutes,doctor_name,procedure_type,status)
      VALUES(p_clinic,d.patient_id,(d.payload->'appointment'->>'date')::date,(d.payload->'appointment'->>'time')::time,(d.payload->'appointment'->>'duration_minutes')::integer,d.payload->'appointment'->>'doctor_name','Consulta',CASE WHEN p_action='start' THEN 'Em Andamento' ELSE 'Pendente' END) RETURNING * INTO a;
    ELSIF p_action='start' THEN
      IF a.status NOT IN ('Pendente','Confirmada','Aguardando','Em Andamento') THEN RAISE EXCEPTION 'Esta consulta não está disponível para início.'; END IF;
      UPDATE public.appointments SET status='Em Andamento' WHERE id=a.id RETURNING * INTO a;
    END IF;
    UPDATE public.encounter_drafts SET appointment_id=a.id,step=CASE WHEN p_action='start' THEN 'anamnesis' ELSE 'patient' END,
      payload=jsonb_set(payload,'{appointment}',jsonb_build_object('doctor_name',a.doctor_name,'date',a.date,'time',left(a.time::text,5),'duration_minutes',coalesce(a.duration_minutes,60))) WHERE id=p_id;
  ELSIF p_action='sign' THEN
    IF d.patient_id IS NULL THEN RAISE EXCEPTION 'Selecione um paciente.'; END IF;
    IF d.appointment_id IS NULL THEN RAISE EXCEPTION 'Inicie a consulta antes de assinar a proposta.'; END IF;
    SELECT * INTO a FROM public.appointments WHERE id=d.appointment_id AND user_id=p_clinic AND patient_id=d.patient_id FOR UPDATE;
    IF a.status<>'Em Andamento' THEN RAISE EXCEPTION 'A consulta precisa estar em andamento para assinar a proposta.'; END IF;
    -- Imported plans become part of this encounter. A treatment already billed
    -- independently must never also enter the appointment's charge unnoticed.
    FOR v_item IN SELECT value FROM jsonb_array_elements(d.payload->'budget'->'items') LOOP
      IF v_item->>'source_id' IS NOT NULL THEN
        SELECT * INTO v_treatment FROM public.treatments WHERE id=(v_item->>'source_id')::uuid AND user_id=p_clinic AND patient_id=d.patient_id FOR UPDATE;
        IF NOT FOUND OR v_treatment.status='cancelled' OR (v_treatment.appointment_id IS NOT NULL AND v_treatment.appointment_id<>d.appointment_id) THEN RAISE EXCEPTION 'Procedimento mudou ou pertence a outra consulta. Revise a proposta.'; END IF;
        IF EXISTS(SELECT 1 FROM public.financial_transactions WHERE user_id=p_clinic AND treatment_id=v_treatment.id AND status<>'cancelled') THEN RAISE EXCEPTION 'Este procedimento já possui cobrança própria. Confira o financeiro antes de incluí-lo nesta consulta.'; END IF;
        IF v_treatment.appointment_id IS NULL THEN UPDATE public.treatments SET appointment_id=d.appointment_id WHERE id=v_treatment.id; END IF;
      END IF;
    END LOOP;
    INSERT INTO public.documents(user_id,patient_id,title,document_type,content,items,total_amount,payment_method,status,signed,signed_at,signature_data,encounter_id,encounter_revision,snapshot_hash)
    VALUES(p_clinic,d.patient_id,p_input->>'title','budget',p_input->>'content',d.payload->'budget'->'items',(p_input->>'total')::numeric,d.payload->'budget'->>'payment_method','signed',true,now(),p_input->>'signature',d.id,d.revision,p_input->>'hash') RETURNING id INTO v_document;
    UPDATE public.encounter_drafts SET signed_document_id=v_document,step='financial',payload=jsonb_set(payload,'{settlement_amount}',to_jsonb((p_input->>'total')::numeric)) WHERE id=p_id;
  ELSIF p_action IN ('publish','complete') THEN
    IF d.patient_id IS NULL THEN RAISE EXCEPTION 'Selecione um paciente.'; END IF;
    v_anamnesis:=coalesce(d.anamnesis_id,gen_random_uuid()); v_record:=coalesce(d.medical_record_id,gen_random_uuid());
    INSERT INTO public.anamnesis_records(id,user_id,patient_id,chief_complaint,dentist_name,answers,additional_notes,diagnosis,treatment_plan)
    VALUES(v_anamnesis,p_clinic,d.patient_id,d.payload->'anamnesis'->>'chief_complaint',d.payload->'appointment'->>'doctor_name',coalesce((SELECT jsonb_agg(value) FROM jsonb_array_elements(d.payload->'anamnesis'->'answers') WHERE value->>'answer' IS NOT NULL),'[]'::jsonb),d.payload->'anamnesis'->>'additional_notes',d.payload->'anamnesis'->>'diagnosis',d.payload->'anamnesis'->>'treatment_plan')
    ON CONFLICT(id) DO UPDATE SET chief_complaint=excluded.chief_complaint,answers=excluded.answers,additional_notes=excluded.additional_notes,diagnosis=excluded.diagnosis,treatment_plan=excluded.treatment_plan,dentist_name=excluded.dentist_name;
    INSERT INTO public.medical_records(id,user_id,patient_id,appointment_id,record_type,title,content)
    VALUES(v_record,p_clinic,d.patient_id,d.appointment_id,'evolution','Atendimento odontológico',concat_ws(E'\n',d.payload->>'clinical_notes',d.payload->>'planning'))
    ON CONFLICT(id) DO UPDATE SET content=excluded.content,appointment_id=excluded.appointment_id;
    UPDATE public.encounter_drafts SET anamnesis_id=v_anamnesis,medical_record_id=v_record,clinical_revision=d.revision WHERE id=p_id;
    IF p_action='complete' THEN
      IF d.signed_document_id IS NULL OR d.appointment_id IS NULL THEN RAISE EXCEPTION 'Assine a proposta e inicie a consulta antes de concluir.'; END IF;
      SELECT * INTO a FROM public.appointments WHERE id=d.appointment_id AND user_id=p_clinic AND patient_id=d.patient_id FOR UPDATE;
      IF a.status='Concluída' THEN
        -- Another authorized user may have concluded it; never silently change the charge.
        IF NOT EXISTS(SELECT 1 FROM public.financial_transactions WHERE user_id=p_clinic AND source_appointment_id=a.id AND amount=(d.payload->>'settlement_amount')::numeric) THEN RAISE EXCEPTION 'Consulta já encerrada com outro valor. Confira no financeiro.'; END IF;
      ELSE
        IF a.status<>'Em Andamento' THEN RAISE EXCEPTION 'Inicie a consulta antes de concluir.'; END IF;
        UPDATE public.appointments SET cost=(d.payload->>'settlement_amount')::numeric,status='Concluída' WHERE id=a.id;
      END IF;
      UPDATE public.encounter_drafts SET status='completed',step='financial' WHERE id=p_id;
    END IF;
  ELSIF p_action='discard' THEN
    IF d.signed_document_id IS NOT NULL THEN RAISE EXCEPTION 'Atendimento com documento assinado deve ser concluído; preserve o registro.'; END IF;
    UPDATE public.encounter_drafts SET status='discarded',payload='{}'::jsonb WHERE id=p_id;
  ELSE RAISE EXCEPTION 'Ação inválida.';
  END IF;
  UPDATE public.encounter_drafts SET revision=revision+1,updated_at=now() WHERE id=p_id RETURNING * INTO d;
  RETURN d;
END $$;

REVOKE ALL ON FUNCTION public.save_encounter_draft(uuid,uuid,uuid,integer,text,jsonb),public.perform_encounter_action(uuid,uuid,uuid,integer,text,jsonb),public.guard_appointment_slot(),public.create_appointment_financial_pending(),public.guard_encounter_document() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_encounter_draft(uuid,uuid,uuid,integer,text,jsonb),public.perform_encounter_action(uuid,uuid,uuid,integer,text,jsonb) TO service_role;
COMMIT;
