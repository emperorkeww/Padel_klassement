-- ELO-rating per speler + historie.
--
-- De rating wordt berekend uit de afgeronde matches (zie
-- functions/09_ratings.sql: incrementeel voor nieuwe matches, volledige
-- recompute als fallback). Deze tabellen zijn dus afgeleide data: publiek
-- leesbaar, maar enkel de ratingfuncties (SECURITY DEFINER) schrijven erin.

-- Huidige rating per speler (start op 1000).
create table public.player_ratings (
  player_id uuid primary key references public.profiles (id) on delete cascade,
  rating int not null default 1000,
  games int not null default 0,
  updated_at timestamptz not null default now()
);

-- Rating na elke match — voedt de rating-over-tijd-grafiek.
create table public.rating_history (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.profiles (id) on delete cascade,
  match_id uuid not null references public.matches (id) on delete cascade,
  rating_before int not null,
  rating_after int not null,
  delta int not null,
  played_at timestamptz not null
);

create index rating_history_player_idx on public.rating_history (player_id, played_at);
-- Voor de dubbel-apply-guard in de ELO-trigger en de FK-cascade bij het
-- verwijderen van een match. Bewust géén unique (player_id, match_id):
-- één speler in beide teams is schema-technisch mogelijk en levert dan
-- legitiem twee history-rijen per match op.
create index rating_history_match_idx on public.rating_history (match_id);
