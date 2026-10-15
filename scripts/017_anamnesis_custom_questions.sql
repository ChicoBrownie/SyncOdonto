BEGIN;

CREATE TABLE IF NOT EXISTS public.anamnesis_custom_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question text NOT NULL CHECK (length(trim(question)) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, actor_user_id, question)
);

CREATE INDEX IF NOT EXISTS anamnesis_custom_questions_actor_idx
  ON public.anamnesis_custom_questions (clinic_id, actor_user_id, created_at);

ALTER TABLE public.anamnesis_custom_questions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.anamnesis_custom_questions FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.anamnesis_custom_questions TO service_role;

COMMIT;
