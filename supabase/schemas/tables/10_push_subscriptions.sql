-- Web-push-abonnementen: één rij per browser/apparaat.
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  -- Waarmee dit abonnement gemaakt is (#1273): de apparatenlijst in de
  -- instellingen heeft iets nodig om een naam mee te tonen — een endpoint is
  -- een capability-URL van tweehonderd tekens.
  user_agent text,
  created_at timestamptz not null default now()
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
