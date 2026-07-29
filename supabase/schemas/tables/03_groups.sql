-- Groepen: een verzameling spelers die samen matches spelen (bv. Americano)
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references public.profiles (id) on delete set null,
  -- Toon van de roast in deze groep; default 'gemeen' = meteen levendig, de
  -- owner draait naar 'mild' of 'radioactief'.
  roast_intensiteit public.roast_intensiteit not null default 'gemeen',
  -- Zet de cron rondes klaar als er bij de start van de speeldag nog geen zijn
  -- (#827)? Aan by default; groepen die liever zelf indelen zetten hem uit.
  auto_rondes boolean not null default true,
  created_at timestamptz not null default now()
);
