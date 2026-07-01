-- Klassement: live berekend uit afgeronde matches.
-- Puntensysteem: winst = 3 punten, verlies = 0.
-- security_invoker = true → de RLS-policies van de onderliggende tabellen gelden.
create view public.standings
with (security_invoker = true) as
with results as (
  select team_a_id as team_id, winner_team_id
  from public.matches
  where status = 'completed'
  union all
  select team_b_id as team_id, winner_team_id
  from public.matches
  where status = 'completed'
)
select
  t.id                                                     as team_id,
  t.name                                                   as team_name,
  count(*)                                                 as played,
  count(*) filter (where r.winner_team_id = r.team_id)     as won,
  count(*) filter (where r.winner_team_id is not null
                     and r.winner_team_id <> r.team_id)    as lost,
  count(*) filter (where r.winner_team_id = r.team_id) * 3 as points
from results r
join public.teams t on t.id = r.team_id
group by t.id, t.name;
