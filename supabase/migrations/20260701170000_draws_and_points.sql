-- Gelijkspel mogelijk maken + puntensysteem herzien.
--
-- Padel op tijd (i.p.v. tot 6 games) kan gelijk eindigen. We modelleren een
-- gelijkspel als een afgeronde match met winner_team_id IS NULL — de bestaande
-- check-constraint matches_winner_valid staat dat al toe, dus geen schemawijziging.
--
-- Puntensysteem: winst = 3, gelijkspel = 1, verlies = 0.

------------------------------------------------------------------------
-- 1) RPC bijwerken: p_winner mag nu ook 'draw' zijn (geen winnaar)
------------------------------------------------------------------------
create or replace function public.create_completed_match(
  p_a1 uuid, p_a2 uuid, p_b1 uuid, p_b2 uuid,
  p_winner text,
  p_score_a smallint default null,
  p_score_b smallint default null,
  p_group_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_team_a uuid;
  v_team_b uuid;
  v_winner uuid;
  v_match uuid;
begin
  if v_uid is null then
    raise exception 'Niet ingelogd';
  end if;
  if p_winner not in ('a', 'b', 'draw') then
    raise exception 'Winnaar moet ''a'', ''b'' of ''draw'' zijn';
  end if;
  if p_a1 is null or p_a2 is null or p_b1 is null or p_b2 is null then
    raise exception 'Vier spelers vereist';
  end if;
  -- alle vier spelers moeten verschillend zijn
  if p_a1 in (p_a2, p_b1, p_b2) or p_a2 in (p_b1, p_b2) or p_b1 = p_b2 then
    raise exception 'De vier spelers moeten verschillend zijn';
  end if;

  v_team_a := public._ensure_team(p_a1, p_a2);
  v_team_b := public._ensure_team(p_b1, p_b2);
  -- Bij een gelijkspel blijft de winnaar NULL.
  v_winner := case p_winner
                when 'a' then v_team_a
                when 'b' then v_team_b
                else null
              end;

  insert into public.matches (
    team_a_id, team_b_id, status, winner_team_id,
    score_a, score_b, played_at, created_by, group_id
  )
  values (
    v_team_a, v_team_b, 'completed', v_winner,
    p_score_a, p_score_b, now(), v_uid, p_group_id
  )
  returning id into v_match;

  return v_match;
end;
$$;

------------------------------------------------------------------------
-- 2) Views herzien: kolom "drawn" + punten = won*3 + drawn
--    (drop + recreate omdat create-or-replace geen kolommen tussenvoegt)
------------------------------------------------------------------------
drop view if exists public.standings;
drop view if exists public.player_standings;
drop view if exists public.group_player_standings;

-- Teamklassement
create view public.standings
with (security_invoker = true) as
with results as (
  select team_a_id as team_id, winner_team_id,
         score_a as scored_for, score_b as scored_against
  from public.matches where status = 'completed'
  union all
  select team_b_id as team_id, winner_team_id,
         score_b as scored_for, score_a as scored_against
  from public.matches where status = 'completed'
)
select
  t.id                                                      as team_id,
  t.name                                                    as team_name,
  count(*)                                                  as played,
  count(*) filter (where r.winner_team_id = r.team_id)      as won,
  count(*) filter (where r.winner_team_id is null)          as drawn,
  count(*) filter (where r.winner_team_id is not null
                     and r.winner_team_id <> r.team_id)     as lost,
  count(*) filter (where r.winner_team_id = r.team_id) * 3
    + count(*) filter (where r.winner_team_id is null)      as points,
  coalesce(sum(coalesce(r.scored_for, 0)
             - coalesce(r.scored_against, 0)), 0)           as goal_diff
from results r
join public.teams t on t.id = r.team_id
group by t.id, t.name;

-- Spelersklassement (over alle teams van een speler)
create view public.player_standings
with (security_invoker = true) as
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
  select id as team_id, player2_id as player_id from public.teams
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
group by p.id, p.username, p.full_name;

-- Spelersklassement per groep
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
