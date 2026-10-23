-- Esquema Supabase (PostgreSQL) para tramitesextranjeriabenicarlo.com
-- El control de acceso premium se valida en servidor mediante RLS y la tabla subscriptions,
-- nunca en el cliente.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  preferred_lang text not null default 'es' check (preferred_lang in ('es','ar','ary','zgh')),
  created_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text unique,
  status text not null check (status in ('trialing','active','past_due','canceled','incomplete')),
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.user_situations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.procedure_steps (
  id uuid primary key default gen_random_uuid(),
  procedure_slug text not null,
  step_order int not null,
  title_es text not null,
  body_es text not null,
  official_source_url text not null,
  last_verified_at date not null,
  unique (procedure_slug, step_order)
);

-- Función que indica si el usuario tiene suscripción activa.
create or replace function public.is_premium(uid uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.subscriptions s
    where s.user_id = uid
      and s.status in ('active','trialing')
      and (s.current_period_end is null or s.current_period_end > now())
  );
$$;

-- RLS
alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.user_situations enable row level security;
alter table public.procedure_steps enable row level security;

create policy "profile_own" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "subscription_read_own" on public.subscriptions
  for select using (auth.uid() = user_id);
-- Escritura solo desde el webhook de Stripe (service_role), sin policy de insert/update para usuarios.

create policy "situation_own" on public.user_situations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Pasos de guía: lectura pública los básicos; los pasos completos solo si es premium.
create policy "steps_public_basic" on public.procedure_steps
  for select using (step_order <= 2 or public.is_premium(auth.uid()));
