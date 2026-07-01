-- Spelerklassement: globaal, live berekend uit afgeronde matches (win = 3 punten).
create view public.player_standings
with (security_invoker = true) as
with team_results as (
  select team_a_id as team_id, winner_team_id from public.matches where status = 'completed'
  union all
  select team_b_id as team_id, winner_team_id from public.matches where status = 'completed'
),
player_team as (
  select id as team_id, player1_id as player_id from public.teams
  union all
  select id as team_id, player2_id as player_id from public.teams
)
select
  p.id                                                        as player_id,
  p.username,
  p.full_name,
  count(*)                                                    as played,
  count(*) filter (where tr.winner_team_id = tr.team_id)      as won,
  count(*) filter (where tr.winner_team_id is not null
                     and tr.winner_team_id <> tr.team_id)     as lost,
  count(*) filter (where tr.winner_team_id = tr.team_id) * 3  as points
from team_results tr
join player_team pt on pt.team_id = tr.team_id
join public.profiles p on p.id = pt.player_id
group by p.id, p.username, p.full_name;