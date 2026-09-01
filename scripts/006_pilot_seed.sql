-- Execute somente no projeto Supabase separado do piloto.
-- Substitua o UUID abaixo pelo ID do gestor fictício criado no Auth.
DO $$
DECLARE
  pilot_owner UUID := '00000000-0000-0000-0000-000000000000';
  pilot_patient UUID;
BEGIN
  IF pilot_owner = '00000000-0000-0000-0000-000000000000' THEN
    RAISE EXCEPTION 'Defina pilot_owner com o UUID do gestor fictício antes de executar';
  END IF;

  INSERT INTO public.clinic_settings (user_id, clinic_name, phone, email, address, working_hours)
  VALUES (pilot_owner, 'Clínica Piloto Fictícia', '(85) 99999-0000', 'piloto@example.test', 'Rua de Teste, 100', '{"start":"08:00","end":"18:00"}'::jsonb)
  ON CONFLICT (user_id) DO UPDATE SET clinic_name = EXCLUDED.clinic_name;

  INSERT INTO public.patients (user_id, full_name, email, phone, status, notes)
  VALUES (pilot_owner, 'Maria Paciente Fictícia', 'maria.paciente@example.test', '(85) 98888-0000', 'Ativo', 'DADO FICTÍCIO — PILOTO')
  RETURNING id INTO pilot_patient;

  INSERT INTO public.appointments (user_id, patient_id, date, time, procedure_type, doctor_name, status, cost, notes)
  VALUES (pilot_owner, pilot_patient, CURRENT_DATE + 1, '09:00', 'Avaliação fictícia', 'Dra. Teste', 'Pendente', 150, 'DADO FICTÍCIO — PILOTO');
END $$;
