-- Bloqueios de horários e compromissos pessoais na agenda da clínica.
create table if not exists public.agenda_blocks (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(trim(title)) between 2 and 160),
  scope text not null check (scope in ('dentist', 'clinic')),
  doctor_name text,
  resource_name text,
  notes text,
  date date not null,
  start_time time,
  end_time time,
  all_day boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agenda_blocks_time_range check (
    (all_day and start_time is null and end_time is null)
    or (not all_day and start_time is not null and end_time is not null and end_time > start_time)
  ),
  constraint agenda_blocks_dentist check (scope <> 'dentist' or nullif(trim(doctor_name), '') is not null)
);

alter table public.agenda_blocks enable row level security;
drop policy if exists agenda_blocks_clinic_access on public.agenda_blocks;
create policy agenda_blocks_clinic_access on public.agenda_blocks
  for all to authenticated
  using (clinic_id = (select auth.uid()))
  with check (clinic_id = (select auth.uid()));
grant select, insert, update, delete on public.agenda_blocks to authenticated, service_role;
create index if not exists agenda_blocks_clinic_date_idx on public.agenda_blocks (clinic_id, date, start_time);
