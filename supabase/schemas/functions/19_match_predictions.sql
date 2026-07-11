-- Toto (#116): guards en puntentoekenning voor match_predictions.
-- De winkans wordt hier serverside berekend en bevroren; de client mag
-- win_chance/points nooit zelf aanleveren (zie ook de kolomgrants in
-- policies/match_predictions.sql).

-- Puntenformule: omgekeerd evenredig met de winkans van het getipte team.
-- Favoriet (75%+) ≈ 1 punt, 50/50 ≈ 3, underdog (≤30%) ≈ 4.
create or replace function public.prediction_points(p_chance numeric)
returns smallint
language sql
immutable
set search_path = ''
as $$
  select greatest(1, least(4, round((1 - p_chance) * 5)))::smallint;
$$;

-- Winkans van p_team in match p_match, identiek aan de Elo-verwachting in
-- recompute_ratings (09_ratings.sql) en winChance in src/lib/elo.ts:
-- teamrating = gemiddelde van beide spelers (basis 1000), 400-schaal.
create or replace function public.prediction_win_chance(p_match uuid, p_team uuid)
returns numeric
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  base constant int := 1000;
  m record;
  v_other uuid;
  p1 uuid; p2 uuid; o1 uuid; o2 uuid;
  r_team numeric; r_other numeric;
begin
  select team_a_id, team_b_id into m from public.matches where id = p_match;
  if m.team_a_id is null then
    raise exception 'match bestaat niet';
  end if;
  v_other := case when p_team = m.team_a_id then m.team_b_id else m.team_a_id end;

  select t.player1_id, t.player2_id into p1, p2 from public.teams t where t.id = p_team;
  select t.player1_id, t.player2_id into o1, o2 from public.teams t where t.id = v_other;

  r_team := (
    coalesce((select rating from public.player_ratings where player_id = p1), base)
    + coalesce((select rating from public.player_ratings where player_id = p2), base)
  ) / 2.0;
  r_other := (
    coalesce((select rating from public.player_ratings where player_id = o1), base)
    + coalesce((select rating from public.player_ratings where player_id = o2), base)
  ) / 2.0;

  return round(1.0 / (1.0 + power(10.0, (r_other - r_team) / 400.0)), 4);
end;
$$;

revoke execute on function public.prediction_win_chance(uuid, uuid) from public;

-- Guard: tippen kan alleen op een nog niet gestarte, geplande groepsmatch,
-- op een team dat echt meespeelt, met een group_id die echt bij de match
-- hoort. De winkans-snapshot wordt hier gezet, nooit door de client.
create or replace function public.match_predictions_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  m record;
begin
  -- Doorlaat voor de grader: een UPDATE die de tip zelf niet wijzigt
  -- (alleen points) hoeft niet opnieuw gevalideerd te worden.
  if tg_op = 'UPDATE'
     and new.predicted_team_id = old.predicted_team_id
     and new.match_id = old.match_id
     and new.player_id = old.player_id
     and new.group_id = old.group_id then
    return new;
  end if;

  select id, group_id, status, played_at, team_a_id, team_b_id
    into m
    from public.matches
    where id = new.match_id;

  if m.id is null then
    raise exception 'match bestaat niet';
  end if;
  if m.group_id is null or m.group_id is distinct from new.group_id then
    raise exception 'tippen kan alleen op groepsmatches';
  end if;
  if m.status <> 'scheduled' then
    raise exception 'deze match is al begonnen of afgerond';
  end if;
  if m.played_at is not null and m.played_at <= now() then
    raise exception 'de match is al begonnen';
  end if;
  if new.predicted_team_id not in (m.team_a_id, m.team_b_id) then
    raise exception 'het getipte team speelt niet mee in deze match';
  end if;

  new.win_chance := public.prediction_win_chance(new.match_id, new.predicted_team_id);
  new.points := null;
  new.updated_at := now();
  return new;
end;
$$;

create trigger match_predictions_guard
  before insert or update on public.match_predictions
  for each row execute function public.match_predictions_guard();

-- Een tip intrekken kan alleen zolang de match niet gestart of afgerond is.
-- Cascade-deletes (match of groep verwijderd) lopen via de RI-triggers en
-- mogen altijd door: die draaien op trigger-diepte > 1, een directe delete
-- van een gebruiker op diepte 1.
create or replace function public.match_predictions_delete_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  m record;
begin
  if pg_trigger_depth() > 1 then
    return old; -- cascade (match of groep verwijderd): altijd toestaan
  end if;
  select status, played_at into m from public.matches where id = old.match_id;
  if not found then
    return old; -- match al verwijderd
  end if;
  if m.status <> 'scheduled' or (m.played_at is not null and m.played_at <= now()) then
    raise exception 'deze tip is vergrendeld: de match is al begonnen of afgerond';
  end if;
  return old;
end;
$$;

create trigger match_predictions_delete_guard
  before delete on public.match_predictions
  for each row execute function public.match_predictions_delete_guard();

-- Puntentoekenning: zodra een match afgerond is (of de winnaar achteraf
-- gecorrigeerd wordt) worden alle tips van die match beoordeeld. Juiste tip
-- krijgt prediction_points(win_chance); fout of gelijkspel = 0. Wordt de
-- afronding teruggedraaid, dan gaat de beoordeling weer open (null).
create or replace function public.grade_match_predictions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'completed' then
    update public.match_predictions p
       set points = case
             when new.winner_team_id is not null
              and p.predicted_team_id = new.winner_team_id
             then public.prediction_points(p.win_chance)
             else 0
           end
     where p.match_id = new.id;
  elsif old.status = 'completed' then
    update public.match_predictions p
       set points = null
     where p.match_id = new.id;
  end if;
  return null;
end;
$$;

create trigger matches_grade_predictions
  after update of status, winner_team_id on public.matches
  for each row execute function public.grade_match_predictions();
