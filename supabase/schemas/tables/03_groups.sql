-- Roast-intensiteit (#183): hoe hard het systeem de leden van deze groep roast.
-- Alleen de owner stelt dit in (bestaande update-policy dekt het).
create type public.roast_intensiteit as enum ('mild', 'gemeen', 'radioactief');

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
