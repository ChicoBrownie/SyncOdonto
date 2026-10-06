-- Correção para bancos que já receberam a migração 014.
-- Converte explicitamente o horário da consulta de JSON/texto para TIME.
-- Substitui apenas a função; preserva tabelas, rascunhos e registros existentes.
BEGIN;

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

REVOKE ALL ON FUNCTION public.perform_encounter_action(uuid,uuid,uuid,integer,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.perform_encounter_action(uuid,uuid,uuid,integer,text,jsonb) TO service_role;
COMMIT;
