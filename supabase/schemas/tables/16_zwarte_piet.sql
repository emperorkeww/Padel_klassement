-- De Zwarte Piet (#185): één rondgaand schande-token per groep. Precies één rij
-- per groep (de huidige drager); geen rij = de Piet is even vrij. Telkens de
-- laatste sukkel draagt 'm (recency); wint de drager, dan gaat 'm naar de
-- eerstvolgende flopper.
--
-- Afgeleide data, zelfde model als pias_of_week: leesbaar voor groepsleden, maar
-- enkel de SECURITY DEFINER recompute-functie (functions/21_zwarte_piet.sql)
-- schrijft erin — vandaar geen write-policies. De drager wordt bepaald door een
-- volledige chronologische replay van de matchhistorie (volgorde-afhankelijk).
create table public.zwarte_piet (
  group_id  uuid primary key references public.groups (id)   on delete cascade,
  holder_id uuid not null      references public.profiles (id) on delete cascade,
  -- Van wie de drager 'm afpakte; null als de Piet daarvoor vrij was.
  from_id   uuid               references public.profiles (id) on delete set null,
  -- Reden + ernst van de overname-afgang (zelfde set als de pias van de maand).
  reden     text not null check (reden in ('bagel', 'afdroging', 'zwarte-reeks', 'choke')),
  ernst     int  not null,
  -- Ludieke omschrijving zónder naam (bv. "verloor 5× op rij"); UI plakt de naam ervoor.
  detail    text not null,
  match_id  uuid not null      references public.matches (id)  on delete cascade,
  -- Speeldatum van de overname-match; voedt "draagt 'm sinds N dagen".
  since     date not null,
  created_at timestamptz not null default now()
);

alter table public.zwarte_piet enable row level security;
