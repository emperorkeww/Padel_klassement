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
  played_at timestamptz not null,
  -- Lef-tip-multiplier (#804) die al in delta verwerkt zit: 2.00 als deze
  -- speler op deze match had ingezet, anders 1.00. Puur voor uitleg achteraf
  -- ("+24, lef ×2"); de rating zelf zit al in delta.
  stake_factor numeric(3, 2) not null default 1.0,
  -- Bounty-verschuiving (#805) die eveneens al in delta verwerkt zit: positief
  -- voor wie een bounty claimde, negatief voor de verslagen drager, 0 voor
  -- iedereen anders. Ook dit is enkel uitleg achteraf ("+31, waarvan +18
  -- bounty") — en tegelijk de bron waaruit de feed de claim-kaart opbouwt.
  bounty_delta int not null default 0,
  -- Troostdemper van de Pechvogel-meter (#1005) die eveneens al in delta
  -- verwerkt zit: positief bij de derde nipte nederlaag op rij, anders 0.
  -- Verzacht dus een verlies ("−9, waarvan +4 troost"). Ook dit is uitleg
  -- achteraf én de bron waaruit de feed de pechvogel-kaart opbouwt.
  troost_delta int not null default 0
);

create index rating_history_player_idx on public.rating_history (player_id, played_at);
-- Voor de dubbel-apply-guard in de ELO-trigger en de FK-cascade bij het
-- verwijderen van een match. Bewust géén unique (player_id, match_id):
-- één speler in beide teams is schema-technisch mogelijk en levert dan
-- legitiem twee history-rijen per match op.
create index rating_history_match_idx on public.rating_history (match_id);
