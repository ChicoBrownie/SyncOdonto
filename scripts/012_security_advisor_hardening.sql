-- Corrige os alertas do Security Advisor sem expor dados clínicos ao navegador.
-- Execute depois de 010 em uma base existente, após backup e validação em piloto.

-- Nenhuma tabela clínica deve ser consultável com a chave pública anon.
-- O backend usa service_role para as rotas protegidas; clinic_staff permanece
-- disponível para authenticated porque o middleware consulta seu escopo de acesso.
DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'activity_logs',
    'ai_analyses',
    'anamnesis_records',
    'appointments',
    'audit_logs',
    'clinic_settings',
    'clinic_staff',
    'data_subject_requests',
    'dental_chart_versions',
    'dental_charts',
    'documents',
    'financial_transactions',
    'medical_records',
    'paperless_templates',
    'patients',
    'phone_change_otps',
    'platform_admins',
    'procedure_catalog',
    'profiles',
    'security_rate_limits',
    'treatments',
    'user_sessions'
  ] LOOP
    IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', table_name);

      IF table_name <> 'clinic_staff' THEN
        EXECUTE format('REVOKE ALL ON TABLE public.%I FROM authenticated', table_name);
      END IF;
    END IF;
  END LOOP;
END;
$$;

-- Funções internas são chamadas por triggers ou pelo backend protegido; elas
-- não devem ficar disponíveis como RPC para anon/authenticated.
DO $$
DECLARE
  function_signature TEXT;
BEGIN
  FOR function_signature IN
    SELECT p.oid::regprocedure::TEXT
      FROM pg_proc AS p
      JOIN pg_namespace AS n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN (
         'capture_dental_chart_version',
         'capture_version_from_dental_chart',
         'capture_version_from_treatment',
         'capture_version_on_appointment_close',
         'enforce_procedure_catalog_favorite_limit',
         'get_clinic_owner_id',
         'get_user_stats',
         'handle_new_user',
         'is_clinic_manager',
         'update_updated_at_column'
       )
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated',
      function_signature
    );
  END LOOP;
END;
$$;

-- Mesmo com a função já criada em uma base existente, fixa o caminho de
-- resolução de nomes para impedir shadowing por objetos temporários.
DO $$
BEGIN
  IF to_regprocedure('public.update_updated_at_column()') IS NOT NULL THEN
    ALTER FUNCTION public.update_updated_at_column()
      SET search_path = public, pg_temp;
  END IF;
END;
$$;
