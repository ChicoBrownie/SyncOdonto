-- Segurança operacional, administração persistida, rate limits e auditoria.
-- Execute no SQL Editor do Supabase antes de publicar o código correspondente.

create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
alter table public.platform_admins enable row level security;
-- Sem policies: acesso exclusivo via service_role.

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  clinic_id uuid not null references auth.users(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null check (length(action) between 3 and 100),
  entity_type text not null check (length(entity_type) between 2 and 80),
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.audit_logs enable row level security;
create index if not exists audit_logs_clinic_created_idx on public.audit_logs (clinic_id, created_at desc);
create index if not exists audit_logs_entity_idx on public.audit_logs (clinic_id, entity_type, entity_id);

create table if not exists public.security_rate_limits (
  key_hash text primary key,
  window_started_at timestamptz not null,
  request_count integer not null check (request_count > 0),
  expires_at timestamptz not null
);
alter table public.security_rate_limits enable row level security;
create index if not exists security_rate_limits_expiry_idx on public.security_rate_limits (expires_at);

create or replace function public.consume_rate_limit(
  p_key_hash text,
  p_limit integer,
  p_window_seconds integer
) returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_count integer;
begin
  if p_limit < 1 or p_window_seconds < 1 then return false; end if;
  insert into public.security_rate_limits(key_hash, window_started_at, request_count, expires_at)
  values (p_key_hash, v_now, 1, v_now + make_interval(secs => p_window_seconds))
  on conflict (key_hash) do update set
    window_started_at = case when security_rate_limits.expires_at <= v_now then v_now else security_rate_limits.window_started_at end,
    request_count = case when security_rate_limits.expires_at <= v_now then 1 else security_rate_limits.request_count + 1 end,
    expires_at = case when security_rate_limits.expires_at <= v_now then v_now + make_interval(secs => p_window_seconds) else security_rate_limits.expires_at end
  returning request_count into v_count;
  return v_count <= p_limit;
end;
$$;
revoke all on function public.consume_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;

create table if not exists public.data_subject_requests (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references auth.users(id) on delete cascade,
  requested_by uuid not null references auth.users(id),
  request_type text not null check (request_type in ('export', 'deletion')),
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'rejected')),
  reason text,
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  result_storage_path text
);
alter table public.data_subject_requests enable row level security;
create index if not exists data_subject_requests_clinic_idx on public.data_subject_requests (clinic_id, requested_at desc);

drop policy if exists "paperless_select_own_folder" on storage.objects;
create policy "paperless_select_own_folder" on storage.objects for select to authenticated
using (bucket_id = 'documentos-clinica' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "paperless_update_own_folder" on storage.objects;
create policy "paperless_update_own_folder" on storage.objects for update to authenticated
using (bucket_id = 'documentos-clinica' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'documentos-clinica' and (storage.foldername(name))[1] = auth.uid()::text);

-- Limpeza operacional. Agende estas instruções diariamente com pg_cron, se disponível.
delete from public.security_rate_limits where expires_at < now() - interval '1 day';
delete from public.phone_change_otps where created_at < now() - interval '7 days';

-- Após a migração, cadastre o primeiro administrador explicitamente:
-- insert into public.platform_admins(user_id) values ('UUID_DO_USUARIO') on conflict (user_id) do update set is_active = true;
