-- Execute no SQL Editor do Supabase antes de habilitar a troca de telefone.
create table if not exists public.phone_change_otps (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  new_phone text not null check (new_phone ~ '^[0-9]{10,11}$'),
  token_hash text not null,
  expires_at timestamptz not null,
  requester_ip text not null,
  attempts smallint not null default 0 check (attempts between 0 and 5),
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.phone_change_otps enable row level security;
-- Sem policies: somente as API Routes, usando service role após autenticar o usuário,
-- acessam os hashes. O navegador não possui acesso direto à tabela.

create index if not exists phone_change_otps_user_created_idx
  on public.phone_change_otps (user_id, created_at desc);
create index if not exists phone_change_otps_ip_created_idx
  on public.phone_change_otps (requester_ip, created_at desc);
create index if not exists phone_change_otps_expiry_idx
  on public.phone_change_otps (expires_at) where consumed_at is null;

-- Verifica o limite e insere no mesmo lock/transação, impedindo corrida entre
-- requisições simultâneas de um mesmo usuário/IP.
create or replace function public.create_phone_change_otp(
  p_id uuid, p_user_id uuid, p_new_phone text, p_token_hash text,
  p_expires_at timestamptz, p_requester_ip text
) returns boolean
language plpgsql security definer set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_requester_ip, 0));
  if (select count(*) from public.phone_change_otps
      where created_at >= now() - interval '5 minutes'
        and (user_id = p_user_id or requester_ip = p_requester_ip)) >= 3 then
    return false;
  end if;
  insert into public.phone_change_otps(id, user_id, new_phone, token_hash, expires_at, requester_ip)
  values (p_id, p_user_id, p_new_phone, p_token_hash, p_expires_at, p_requester_ip);
  return true;
end;
$$;

revoke all on function public.create_phone_change_otp(uuid, uuid, text, text, timestamptz, text) from public, anon, authenticated;
grant execute on function public.create_phone_change_otp(uuid, uuid, text, text, timestamptz, text) to service_role;
