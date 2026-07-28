-- Begrensde lees-RPC's op rating_history (#731).
--
-- De client haalde de vólledige rating_history op om er sparklines van te
-- tekenen. PostgREST kapt zo'n resultaat stil af op max_rows (1000), en
-- rating_history groeit met ~4 rijen per match — dus rond de 250 matches zou de
-- app ongemerkt met halve data gaan renderen. De payload moet daarom schalen
-- met het aantal spelers, niet met het aantal matches.
--
-- De app stelt drie verschillende vragen aan deze tabel; twee daarvan worden
-- hier beantwoord:
--
--   1. "Hoe liep het recent, per speler?" — sparkline, In-Form (#497),
--      On-Fire (#632), de rangverschuivings-pijltjes.
--      → recent_rating_history: de laatste N punten per speler.
--   2. "Wat was de rating op datum X?" — de tijdmachine in het klassement.
--      → ratings_as_of: één rij per speler.
--
-- De derde vraag — "wat waren de pre-match ratings van déze matches?" (upsets,
-- pias-choke) — blijft een gewone .in("match_id", …)-query in de client: die is
-- al begrensd door de matches die het scherm toont, en moet exact zijn tot
-- willekeurig ver terug.
--
-- Beide functies draaien als security invoker (de default): rating_history is
-- publiek leesbaar (policies/ratings.sql), dus er valt hier niets op te rekken.
--
-- Let op: ook een RPC-resultaat gaat door max_rows heen. p_limit wordt daarom
-- geklemd — spelers × p_limit moet ruim onder de 1000 blijven.

-- Laatste N rating-punten per speler, chronologisch per speler (oud → nieuw),
-- zodat de client ze zo in de grafiek kan hangen.
create or replace function public.recent_rating_history(p_limit int default 20)
returns table (
  player_id uuid,
  match_id uuid,
  rating_before int,
  rating_after int,
  delta int,
  played_at timestamptz,
  -- Lef-tip-multiplier (#804): 2.00 als deze speler op deze match ingezet had.
  -- Zit al in delta verwerkt; de feed gebruikt hem alleen om een verdubbelde
  -- mutatie uit te leggen.
  stake_factor numeric,
  -- Bounty-verschuiving (#805): positief voor wie een bounty claimde, negatief
  -- voor de verslagen drager. Zit eveneens al in delta verwerkt; hieruit
  -- reconstrueert de feed wie de reeks brak en voor hoeveel.
  bounty_delta int
)
language sql
stable
set search_path = ''
as $$
  select h.player_id, h.match_id, h.rating_before, h.rating_after, h.delta,
    h.played_at, h.stake_factor, h.bounty_delta
  from (
    select r.player_id, r.match_id, r.rating_before, r.rating_after, r.delta,
      r.played_at, r.stake_factor, r.bounty_delta,
      row_number() over (
        partition by r.player_id
        order by r.played_at desc, r.id desc
      ) as rn
    from public.rating_history r
  ) h
  where h.rn <= least(greatest(coalesce(p_limit, 20), 1), 50)
  order by h.player_id, h.played_at, h.match_id
$$;

-- Rating per speler zoals die was aan het eind van dag p_date: het laatste
-- rating_after t/m die dag. Spelers zonder punt t/m die dag komen niet voor.
--
-- De daggrens ligt in UTC, net als de client-side voorganger (die op de eerste
-- tien tekens van de ISO-string vergeleek). Voor een Belgische avondmatch maakt
-- dat geen verschil; alleen een match ná middernacht lokale tijd valt op de
-- vorige UTC-dag — dezelfde (bekende) scheefheid als voorheen, niet nieuw.
create or replace function public.ratings_as_of(p_date date)
returns table (
  player_id uuid,
  rating int,
  played_at timestamptz
)
language sql
stable
set search_path = ''
as $$
  select distinct on (r.player_id) r.player_id, r.rating_after as rating,
    r.played_at
  from public.rating_history r
  where r.played_at < ((p_date + 1)::timestamp at time zone 'UTC')
  order by r.player_id, r.played_at desc, r.id desc
$$;

grant execute on function public.recent_rating_history(int) to authenticated, anon;
grant execute on function public.ratings_as_of(date) to authenticated, anon;
