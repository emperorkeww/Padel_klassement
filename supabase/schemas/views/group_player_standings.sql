-- Spelerklassement per groep, live berekend uit afgeronde groepsmatches.
-- Puntensysteem: winst = 3, gelijkspel = 1, verlies = 0.
-- goal_diff (scoresaldo) dient als tie-breaker bij gelijke punten.
create view public.group_player_standings
with (security_invoker = true) as
with team_results as (
  select group_id, team_a_id as team_id, winner_team_id,
         score_a as scored_for, score_b as scored_against
  from public.matches where status = 'completed' and group_id is not null
  union all
  select group_id, team_b_id as team_id, winner_team_id,
         score_b as scored_for, score_a as scored_against
  from public.matches where status = 'completed' and group_id is not null
),
player_team as (
  select id as team_id, player1_id as player_id from public.teams
  union all
  select id as team_id, player2_id as player_id from public.teams
)
select
  tr.group_id,
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
group by tr.group_id, p.id, p.username, p.full_name;
