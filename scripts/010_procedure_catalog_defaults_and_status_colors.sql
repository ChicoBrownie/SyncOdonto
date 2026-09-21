-- Catálogo inicial por clínica e limite de opções rápidas no odontograma.
-- As opções rápidas são sempre uma escolha explícita da clínica.

UPDATE public.procedure_catalog
   SET is_favorite = FALSE
 WHERE is_favorite = TRUE;

INSERT INTO public.procedure_catalog (user_id, name, description, default_price, is_favorite, is_active)
SELECT users.id, defaults.name, defaults.description, 50.00, FALSE, TRUE
  FROM auth.users AS users
 CROSS JOIN (
   VALUES
     ('Consulta odontológica', 'Avaliação clínica inicial e orientação ao paciente.'),
     ('Limpeza e profilaxia', 'Remoção de placa e tártaro, seguida de orientação de higiene bucal.'),
     ('Restauração em resina', 'Reconstrução dental indicada, por exemplo, após a identificação de cárie.'),
     ('Tratamento de canal', 'Procedimento endodôntico para tratamento da polpa dental.'),
     ('Extração dentária', 'Remoção do dente quando houver indicação clínica.')
 ) AS defaults(name, description)
ON CONFLICT (user_id, name) DO NOTHING;

CREATE OR REPLACE FUNCTION public.enforce_procedure_catalog_favorite_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  favorite_count INTEGER;
BEGIN
  IF NEW.is_favorite AND (TG_OP = 'INSERT' OR NOT COALESCE(OLD.is_favorite, FALSE)) THEN
    PERFORM pg_advisory_xact_lock(hashtext(NEW.user_id::text));
    SELECT COUNT(*)
      INTO favorite_count
      FROM public.procedure_catalog
     WHERE user_id = NEW.user_id
       AND is_favorite = TRUE;

    IF favorite_count >= 5 THEN
      RAISE EXCEPTION 'A clínica pode ter no máximo cinco opções rápidas no odontograma.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS procedure_catalog_favorite_limit ON public.procedure_catalog;
CREATE TRIGGER procedure_catalog_favorite_limit
  BEFORE INSERT OR UPDATE OF is_favorite ON public.procedure_catalog
  FOR EACH ROW EXECUTE FUNCTION public.enforce_procedure_catalog_favorite_limit();

REVOKE ALL ON FUNCTION public.enforce_procedure_catalog_favorite_limit() FROM PUBLIC;

COMMENT ON TABLE public.procedure_catalog IS
  'Catálogo por clínica. Até cinco procedimentos podem ser explicitamente marcados como opções rápidas.';
