-- Odontograma por faces. Preserva integralmente os registros antigos.
ALTER TABLE public.dental_charts
  ADD COLUMN IF NOT EXISTS surface_conditions JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.dental_charts
  DROP CONSTRAINT IF EXISTS dental_charts_surface_conditions_object;

ALTER TABLE public.dental_charts
  ADD CONSTRAINT dental_charts_surface_conditions_object
  CHECK (jsonb_typeof(surface_conditions) = 'object');

-- Registros antigos continuam como condição do dente inteiro. As novas
-- marcações podem guardar condições independentes em cada uma das cinco faces.
COMMENT ON COLUMN public.dental_charts.surface_conditions IS
  'Condições por face: vestibular, lingual, mesial, distal e occlusal.';
