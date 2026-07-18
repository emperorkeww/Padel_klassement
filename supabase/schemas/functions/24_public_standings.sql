-- Globale klassement-aggregaten als SECURITY DEFINER RPC's (#461).
--
-- Sinds #461 is public.matches niet meer publiek leesbaar (groepsmatches enkel
-- voor leden/deelnemers). De all-time stand blijft globaal via de DEFINER-views
-- player_standings/standings, maar de SEIZOENSstand en de seizoenspicker-grens
-- werden client-side uit de ruwe matchrijen berekend en zouden dus per-kijker
-- worden. Deze functies draaien als owner (bypassen matches-RLS) en geven enkel
-- het AGGREGAAT terug — nooit individuele matchrijen — zodat het globale
-- karakter behouden blijft zonder de rosters/uitslagen te lekken.
--
-- De aggregatielogica is bewust 1-op-1 gelijk aan de views (winst 3 / gelijk 1 /
-- verlies 0, saldo als tie-breaker), met enkel een datumvenster erbij.

-- Seizoensstand per speler binnen [p_start, p_end) op basis van de speeldatum
-- (played_at, met created_at als terugval) — zelfde venster als de client
-- (matchesInSeason: start inclusief, einde exclusief).
create or replace function public.season_player_standings(
  p_start timestamptz,
  p_end timestamptz
)
returns table (
  player_id uuid,
  username text,
  full_name text,
  played bigint,
  won bigint,
  drawn bigint,
  lost bigint,
  points bigint,
  goal_diff bigint
)
language sql
security definer
set search_path = ''
stable
as $$
  with team_results as (
    select team_a_id as team_id, winner_team_id,
           score_a as scored_for, score_b as scored_against
    from public.matches
    where status = 'completed'
      and coalesce(played_at, created_at) >= p_start
      and coalesce(played_at, created_at) < p_end
    union all
    select team_b_id as team_id, winner_team_id,
           score_b as scored_for, score_a as scored_against
    from public.matches
    where status = 'completed'
      and coalesce(played_at, created_at) >= p_start
      and coalesce(played_at, created_at) < p_end
  ),
  player_team as (
    select id as team_id, player1_id as player_id from public.teams
    union all
    select id as team_id, player2_id as player_id from public.teams
    where player2_id is not null
  )
  select
    p.id                                                        as player_id,
    p.username,
    p.full_name,
    count(*)                                                    as played,
    count(*) filter (where tr.winner_team_id = tr.team_id)      as won,
    count(*) filter (where tr.winner_team_id is null)           as drawn,
    count(*) filter (where tr.winner_team_id is not null
                       and tr.winner_team_id <> tr.team_id)     as lost,
    count(*) filter (where tr.winner_team_id = tr.team_id) * 3
      + count(*) filter (where tr.winner_team_id is null)       as points,
    coalesce(sum(coalesce(tr.scored_for, 0)
               - coalesce(tr.scored_against, 0)), 0)            as goal_diff
  from team_results tr
  join player_team pt on pt.team_id = tr.team_id
  join public.profiles p on p.id = pt.player_id
  where not p.is_guest
  group by p.id, p.username, p.full_name;
$$;

-- Seizoensstand per team binnen [p_start, p_end).
create or replace function public.season_team_standings(
  p_start timestamptz,
  p_end timestamptz
)
returns table (
  team_id uuid,
  team_name text,
  played bigint,
  won bigint,
  drawn bigint,
  lost bigint,
  points bigint,
  goal_diff bigint
)
language sql
security definer
set search_path = ''
stable
as $$
  with results as (
    select team_a_id as team_id, winner_team_id,
           score_a as scored_for, score_b as scored_against
    from public.matches
    where status = 'completed'
      and coalesce(played_at, created_at) >= p_start
      and coalesce(played_at, created_at) < p_end
    union all
    select team_b_id as team_id, winner_team_id,
           score_b as scored_for, score_a as scored_against
    from public.matches
    where status = 'completed'
      and coalesce(played_at, created_at) >= p_start
      and coalesce(played_at, created_at) < p_end
  )
  select
    t.id                                                     as team_id,
    t.name                                                   as team_name,
    count(*)                                                 as played,
    count(*) filter (where r.winner_team_id = r.team_id)     as won,
    count(*) filter (where r.winner_team_id is null)         as drawn,
    count(*) filter (where r.winner_team_id is not null
                       and r.winner_team_id <> r.team_id)    as lost,
    count(*) filter (where r.winner_team_id = r.team_id) * 3
      + count(*) filter (where r.winner_team_id is null)     as points,
    coalesce(sum(coalesce(r.scored_for, 0)
               - coalesce(r.scored_against, 0)), 0)          as goal_diff
  from results r
  join public.teams t on t.id = r.team_id
  group by t.id, t.name;
$$;

-- Datum van de allereerste match — bepaalt de seizoenslijst (kwartalen) in de
-- leaderboard. Enkel een datum, geen rij-detail; DEFINER zodat de picker-grens
-- globaal blijft ongeacht welke groepsmatches de kijker mag zien (#461).
create or replace function public.first_match_date()
returns timestamptz
language sql
security definer
set search_path = ''
stable
as $$
  select min(coalesce(played_at, created_at)) from public.matches;
$$;

grant execute on function public.season_player_standings(timestamptz, timestamptz) to authenticated, anon;
grant execute on function public.season_team_standings(timestamptz, timestamptz) to authenticated, anon;
grant execute on function public.first_match_date() to authenticated, anon;
