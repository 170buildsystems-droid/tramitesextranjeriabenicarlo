-- Analítica propia sin cookies + pedidos + panel de administración.
-- Ejecutar después de 001_schema.sql y 002_seed_steps.sql.
--
-- Privacidad: no se guarda la IP ni ningún identificador persistente.
-- La Edge Function "track" calcula visitor_hash = sha256(sal_diaria + IP + user-agent)
-- y descarta la IP. La sal cambia cada día, así que un visitante no se puede seguir
-- de un día a otro (mismo enfoque que Plausible / Cloudflare Web Analytics).

create table if not exists public.events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  event text not null check (event in ('pageview','cta_click','bump_toggle','checkout_start','app_open','signup')),
  path text not null,
  referrer_host text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  lang text,
  device text check (device in ('mobile','tablet','desktop')),
  visitor_hash text not null,
  meta jsonb not null default '{}'::jsonb
);
create index if not exists events_created_idx on public.events (created_at);
create index if not exists events_event_idx on public.events (event, created_at);

-- Pedidos de la guía (Stripe Payment Links / Checkout en modo pago único).
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  stripe_session_id text unique not null,
  stripe_payment_intent text,
  email text,
  amount_cents integer not null,
  currency text not null default 'eur',
  includes_kit boolean not null default false,
  utm_source text,
  status text not null default 'paid' check (status in ('paid','refunded'))
);
create index if not exists orders_created_idx on public.orders (created_at);

-- Quién puede ver el panel.
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create or replace function public.is_admin(uid uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.admins a where a.user_id = uid); $$;

alter table public.events enable row level security;
alter table public.orders enable row level security;
alter table public.admins enable row level security;

-- Nadie lee eventos ni pedidos desde el cliente salvo un administrador.
-- La escritura solo la hacen las Edge Functions con service_role (que salta RLS).
create policy "events_admin_read" on public.events for select using (public.is_admin(auth.uid()));
create policy "orders_admin_read" on public.orders for select using (public.is_admin(auth.uid()));
create policy "admins_self_read" on public.admins for select using (auth.uid() = user_id);

-- Todas las métricas del panel en una sola llamada.
create or replace function public.admin_dashboard(p_from date, p_to date)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_from timestamptz := p_from::timestamptz;
  v_to   timestamptz := (p_to + 1)::timestamptz;
  v_len  int := (p_to - p_from) + 1;
  v_pfrom timestamptz := (p_from - v_len)::timestamptz;
  result jsonb;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  with
  ev as (select * from events where created_at >= v_from and created_at < v_to),
  pev as (select * from events where created_at >= v_pfrom and created_at < v_from),
  od as (select * from orders where created_at >= v_from and created_at < v_to),
  pod as (select * from orders where created_at >= v_pfrom and created_at < v_from),
  days as (select generate_series(p_from, p_to, interval '1 day')::date as d)
  select jsonb_build_object(
    'range', jsonb_build_object('from', p_from, 'to', p_to),
    'kpis', jsonb_build_object(
      'visitors',       (select count(distinct visitor_hash || created_at::date) from ev where event = 'pageview'),
      'visitors_prev',  (select count(distinct visitor_hash || created_at::date) from pev where event = 'pageview'),
      'pageviews',      (select count(*) from ev where event = 'pageview'),
      'pageviews_prev', (select count(*) from pev where event = 'pageview'),
      'orders',         (select count(*) from od where status = 'paid'),
      'orders_prev',    (select count(*) from pod where status = 'paid'),
      'revenue_cents',  (select coalesce(sum(amount_cents),0) from od where status = 'paid'),
      'revenue_prev_cents', (select coalesce(sum(amount_cents),0) from pod where status = 'paid'),
      'kit_orders',     (select count(*) from od where status = 'paid' and includes_kit),
      'refunds',        (select count(*) from od where status = 'refunded'),
      'active_subs',    (select count(*) from subscriptions where status in ('active','trialing')),
      'new_signups',    (select count(*) from ev where event = 'signup')
    ),
    'daily', (
      select jsonb_agg(jsonb_build_object(
        'date', d,
        'visitors', (select count(distinct visitor_hash) from ev where event='pageview' and created_at::date = d),
        'revenue_cents', (select coalesce(sum(amount_cents),0) from od where status='paid' and created_at::date = d),
        'orders', (select count(*) from od where status='paid' and created_at::date = d)
      ) order by d) from days
    ),
    'funnel', jsonb_build_array(
      jsonb_build_object('step','Visitas',            'n', (select count(distinct visitor_hash || created_at::date) from ev where event='pageview')),
      jsonb_build_object('step','Clic en «Comprar»',  'n', (select count(distinct visitor_hash || created_at::date) from ev where event='cta_click')),
      jsonb_build_object('step','Inicio de pago',     'n', (select count(distinct visitor_hash || created_at::date) from ev where event='checkout_start')),
      jsonb_build_object('step','Compra',             'n', (select count(*) from od where status='paid'))
    ),
    'sources', (
      select coalesce(jsonb_agg(jsonb_build_object('source', s, 'visitors', n) order by n desc), '[]'::jsonb) from (
        select coalesce(nullif(utm_source,''), nullif(referrer_host,''), 'Directo') as s,
               count(distinct visitor_hash || created_at::date) as n
        from ev where event='pageview' group by 1 order by 2 desc limit 8) t
    ),
    'pages', (
      select coalesce(jsonb_agg(jsonb_build_object('path', path, 'views', n) order by n desc), '[]'::jsonb) from (
        select path, count(*) as n from ev where event='pageview' group by 1 order by 2 desc limit 10) t
    ),
    'devices', (
      select coalesce(jsonb_agg(jsonb_build_object('device', device, 'visitors', n) order by n desc), '[]'::jsonb) from (
        select coalesce(device,'desconocido') as device, count(distinct visitor_hash || created_at::date) as n
        from ev where event='pageview' group by 1) t
    ),
    'langs', (
      select coalesce(jsonb_agg(jsonb_build_object('lang', lang, 'visitors', n) order by n desc), '[]'::jsonb) from (
        select coalesce(lang,'?') as lang, count(distinct visitor_hash || created_at::date) as n
        from ev where event='pageview' group by 1 order by 2 desc limit 6) t
    ),
    'recent_orders', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'created_at', created_at, 'amount_cents', amount_cents, 'includes_kit', includes_kit,
        'status', status, 'utm_source', utm_source) order by created_at desc), '[]'::jsonb)
      from (select * from od order by created_at desc limit 10) t
    )
  ) into result;

  return result;
end;
$$;

revoke all on function public.admin_dashboard(date, date) from public, anon;
grant execute on function public.admin_dashboard(date, date) to authenticated;

-- Para darte acceso al panel, después de registrarte en /cuenta/, ejecuta:
--   insert into public.admins (user_id)
--   select id from auth.users where email = 'TU_EMAIL';
