-- Pias van de week (#127-easter egg, nu echt): per groep, per ISO-week één
-- speler aangeduid als "pias" — de grootste choke, d.w.z. de speler die als
-- duidelijke favoriet toch verloor.
--
-- Afgeleide data, zelfde model als player_ratings/rating_history: leesbaar voor
-- groepsleden, maar enkel de SECURITY DEFINER recompute-functie
-- (functions/20_pias_of_week.sql) schrijft erin — vandaar geen write-policies.
create table public.pias_of_week (
  group_id   uuid not null references public.groups (id)   on delete cascade,
  iso_year   smallint not null,
  iso_week   smallint not null,
  player_id  uuid not null references public.profiles (id) on delete cascade,
  match_id   uuid not null references public.matches (id)  on delete cascade,
  -- Pre-match winkans van het VERLIEZENDE favorietenteam (de choke-maat):
  -- hoe hoger, hoe pijnlijker de flop. Uit rating_history.rating_before.
  win_chance numeric not null check (win_chance > 0 and win_chance < 1),
  -- Maandag van de ISO-week; puur voor weergave en sortering.
  week_start date not null,
  created_at timestamptz not null default now(),
  primary key (group_id, iso_year, iso_week)
);

create index pias_of_week_group_idx on public.pias_of_week (group_id);
