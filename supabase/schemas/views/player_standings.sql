-- Spelerklassement: globaal, live berekend uit afgeronde matches.
-- Puntensysteem: winst = 3, gelijkspel = 1, verlies = 0.
-- goal_diff (scoresaldo) dient als tie-breaker bij gelijke punten.
-- security_invoker = false (DEFINER): dit is een GLOBAAL aggregaat en moet dat
-- blijven, óók voor niet-leden van een groep. Sinds #461 is public.matches
-- niet meer publiek leesbaar; een security_invoker-view zou de stand daardoor
-- per-kijker maken (groepsmatches vallen weg). Draaien als view-owner bypasst
-- de matches-RLS en geeft enkel het aggregaat terug — niet de ruwe rijen.
-- NIET terugzetten naar security_invoker zonder #461 opnieuw te openen.
create view public.player_standings
with (security_invoker = false) as
with team_results as (
  select team_a_id as team_id, winner_team_id,
         score_a as scored_for, score_b as scored_against
  from public.matches where status = 'completed'
  union all
  select team_b_id as team_id, winner_team_id,
         score_b as scored_for, score_a as scored_against
  from public.matches where status = 'completed'
),
player_team as (
  select id as team_id, player1_id as player_id from public.teams
  union all
  -- singles-teams hebben geen tweede speler
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

-- PostgREST voert clientqueries uit als anon/authenticated, niet als
-- view-owner. De DEFINER-view mag dus alleen het berekende klassement tonen,
-- maar heeft wel een expliciete leesgrant nodig.
grant select on public.player_standings to authenticated, anon;
