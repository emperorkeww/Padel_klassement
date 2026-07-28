-- Klassement: live berekend uit afgeronde matches.
-- Puntensysteem: winst = 3, gelijkspel = 1, verlies = 0.
-- Een gelijkspel is een afgeronde match zonder winner_team_id.
-- goal_diff (scoresaldo) dient als tie-breaker bij gelijke punten.
-- security_invoker = false (DEFINER): globaal team-aggregaat, moet globaal
-- blijven na de matches-RLS-afscherming (#461). Zie player_standings voor de
-- volledige uitleg. NIET terugzetten naar security_invoker.
create view public.standings
with (security_invoker = false) as
with results as (
  select team_a_id as team_id, winner_team_id,
         score_a as scored_for, score_b as scored_against
  from public.matches
  where status = 'completed'
  union all
  select team_b_id as team_id, winner_team_id,
         score_b as scored_for, score_a as scored_against
  from public.matches
  where status = 'completed'
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

grant select on public.standings to authenticated, anon;
