-- Planejamento de abastecimento para clínicas odontológicas.
-- Aplicar após as migrações anteriores, primeiro em ambiente de teste.

CREATE TABLE IF NOT EXISTS public.supply_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 160),
  unit TEXT NOT NULL CHECK (length(trim(unit)) BETWEEN 1 AND 40),
  is_critical BOOLEAN NOT NULL DEFAULT FALSE,
  usable_quantity NUMERIC(12, 3) NOT NULL DEFAULT 0 CHECK (usable_quantity >= 0),
  minimum_quantity NUMERIC(12, 3) NOT NULL DEFAULT 0 CHECK (minimum_quantity >= 0),
  primary_supplier TEXT,
  primary_lead_days INTEGER CHECK (primary_lead_days BETWEEN 0 AND 365),
  backup_supplier TEXT,
  backup_lead_days INTEGER CHECK (backup_lead_days BETWEEN 0 AND 365),
  last_counted_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, id),
  UNIQUE (user_id, name)
);

CREATE TABLE IF NOT EXISTS public.supply_usage_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id UUID NOT NULL,
  procedure_type TEXT NOT NULL CHECK (length(trim(procedure_type)) BETWEEN 1 AND 200),
  quantity_per_appointment NUMERIC(12, 3) NOT NULL CHECK (quantity_per_appointment > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, item_id, procedure_type),
  FOREIGN KEY (user_id, item_id) REFERENCES public.supply_items (user_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.supply_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id UUID NOT NULL,
  supplier_name TEXT NOT NULL CHECK (length(trim(supplier_name)) BETWEEN 2 AND 160),
  quantity NUMERIC(12, 3) NOT NULL CHECK (quantity > 0),
  ordered_on DATE NOT NULL,
  promised_on DATE NOT NULL,
  received_on DATE,
  status TEXT NOT NULL DEFAULT 'ordered' CHECK (status IN ('ordered', 'received', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (user_id, item_id) REFERENCES public.supply_items (user_id, id) ON DELETE RESTRICT,
  CHECK (promised_on >= ordered_on),
  CHECK (received_on IS NULL OR received_on >= ordered_on)
);

CREATE INDEX IF NOT EXISTS supply_items_user_active_idx ON public.supply_items (user_id, is_active, name);
CREATE INDEX IF NOT EXISTS supply_usage_rules_user_item_idx ON public.supply_usage_rules (user_id, item_id);
CREATE UNIQUE INDEX IF NOT EXISTS supply_usage_rules_normalized_idx
  ON public.supply_usage_rules (user_id, item_id, lower(procedure_type));
CREATE INDEX IF NOT EXISTS supply_orders_user_status_idx ON public.supply_orders (user_id, status, promised_on);

ALTER TABLE public.supply_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supply_usage_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supply_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "supply_items_owner" ON public.supply_items FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "supply_usage_rules_owner" ON public.supply_usage_rules FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "supply_orders_owner" ON public.supply_orders FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
