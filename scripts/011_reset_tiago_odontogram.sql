-- RESET DE DADOS DE TESTE — Thiago Assuncao
-- Execute uma única vez somente na base de testes atual.
-- O histórico de versões é preservado; apenas o estado atual e os procedimentos
-- do paciente são limpos para recomeçar o odontograma do zero.

DO $$
DECLARE
  target_patient_id UUID;
  matching_patients INTEGER;
BEGIN
  -- Aceita a grafia com ou sem acentos, mas nunca escolhe entre dois pacientes.
  SELECT COUNT(*)
    INTO matching_patients
    FROM public.patients
   WHERE full_name ILIKE 'Thiago%Assun%';

  IF matching_patients <> 1 THEN
    RAISE EXCEPTION 'Reset cancelado: esperado exatamente um paciente correspondente ao nome de Thiago Assuncao; encontrados %.', matching_patients;
  END IF;

  SELECT id
    INTO target_patient_id
    FROM public.patients
   WHERE full_name ILIKE 'Thiago%Assun%';

  DELETE FROM public.treatments
   WHERE patient_id = target_patient_id;

  DELETE FROM public.dental_charts
   WHERE patient_id = target_patient_id;
END;
$$;
