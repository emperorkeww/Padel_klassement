-- Groepen: een verzameling spelers die samen matches spelen (bv. Americano)
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references public.profiles (id) on delete set null,
  -- Toon van de roast in deze groep; default 'gemeen' = meteen levendig, de
  -- owner draait naar 'mild' of 'radioactief'.
  roast_intensiteit public.roast_intensiteit not null default 'gemeen',
  created_at timestamptz not null default now()
);
