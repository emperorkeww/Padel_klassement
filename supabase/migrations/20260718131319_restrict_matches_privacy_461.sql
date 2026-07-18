-- #461: ruwe matchrijen afschermen, globaal klassement globaal houden.
--
-- 1. public.matches: publieke select-policy vervangen door een gated policy
--    (niet-groepsmatches publiek; groepsmatches enkel voor leden/deelnemers/
--    aanmaker). De ruwe rij verraadt roster + uitslag en hoort even privé als
--    group_members/attendance.
-- 2. player_standings/standings → SECURITY DEFINER, zodat het GLOBALE aggregaat
--    globaal blijft ondanks de matches-RLS. group_player_standings en
--    group_prediction_standings blijven security_invoker (bewust gated).
-- 3. Nieuwe DEFINER-RPC's voor de seizoensstand + seizoenspicker-grens, die
--    voorheen client-side uit de ruwe rijen werden berekend.

drop policy "Matches zijn publiek leesbaar" on "public"."matches";

create policy "Matches: deelnemers, groepsleden en publiek (niet-groep)"
  on "public"."matches"
  as permissive
  for select
  to public
using (((group_id IS NULL) OR public.is_group_member(group_id, ( SELECT auth.uid() AS uid)) OR public.is_team_member(team_a_id, ( SELECT auth.uid() AS uid)) OR public.is_team_member(team_b_id, ( SELECT auth.uid() AS uid)) OR (created_by = ( SELECT auth.uid() AS uid))));

-- Globale aggregaat-views draaien voortaan als owner (bypassen de matches-RLS
-- en geven enkel het aggregaat terug). group_player_standings /
-- group_prediction_standings blijven bewust ongemoeid (security_invoker=true).
alter view "public"."player_standings" set (security_invoker = false);
alter view "public"."standings" set (security_invoker = false);

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.first_match_date()
 RETURNS timestamp with time zone
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select min(coalesce(played_at, created_at)) from public.matches;
$function$
;

CREATE OR REPLACE FUNCTION public.season_player_standings(p_start timestamp with time zone, p_end timestamp with time zone)
 RETURNS TABLE(player_id uuid, username text, full_name text, played bigint, won bigint, drawn bigint, lost bigint, points bigint, goal_diff bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.season_team_standings(p_start timestamp with time zone, p_end timestamp with time zone)
 RETURNS TABLE(team_id uuid, team_name text, played bigint, won bigint, drawn bigint, lost bigint, points bigint, goal_diff bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

grant execute on function public.season_player_standings(timestamptz, timestamptz) to authenticated, anon;
grant execute on function public.season_team_standings(timestamptz, timestamptz) to authenticated, anon;
grant execute on function public.first_match_date() to authenticated, anon;
