-- Sets/games per match + geplande match verwijderen.
--
-- 1) matches.set_scores (jsonb): OPTIONELE per-set uitslag, bv.
--    [[6,4],[3,6],[7,5]]. Puur informatief/weergave; score_a/score_b blijven
--    de autoritaire aggregaat voor stand en ratings (die raken we NIET aan).
-- 2) create_completed_match / create_planned_match krijgen een optionele
--    p_set_scores-parameter (achteraan, default null) zodat bestaande aanroepen
--    ongewijzigd blijven werken.
-- 3) delete_match: verwijdert een NIET-afgeronde match van de aanmaker.

-- 1) Kolom + lichte vormcontrole (moet een JSON-array zijn als hij gevuld is).
alter table public.matches
  add column if not exists set_scores jsonb;

alter table public.matches
  drop constraint if exists matches_set_scores_is_array;
alter table public.matches
  add constraint matches_set_scores_is_array check (
    set_scores is null or jsonb_typeof(set_scores) = 'array'
  );

-- 2a) create_completed_match: p_set_scores toegevoegd (oude signatuur droppen
--     zodat er geen dubbele overload ontstaat).
drop function if exists public.create_completed_match(uuid, uuid, uuid, uuid, text, smallint, smallint, uuid);
create or replace function public.create_completed_match(
  p_a1 uuid, p_a2 uuid, p_b1 uuid, p_b2 uuid,
  p_winner text,
  p_score_a smallint default null,
  p_score_b smallint default null,
  p_group_id uuid default null,
  p_set_scores jsonb default null
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
  if p_a1 in (p_a2, p_b1, p_b2) or p_a2 in (p_b1, p_b2) or p_b1 = p_b2 then
    raise exception 'De vier spelers moeten verschillend zijn';
  end if;

  -- Alleen jezelf en je vrienden mogen in de match.
  if not (p_a1 = v_uid or public.are_friends(v_uid, p_a1))
     or not (p_a2 = v_uid or public.are_friends(v_uid, p_a2))
     or not (p_b1 = v_uid or public.are_friends(v_uid, p_b1))
     or not (p_b2 = v_uid or public.are_friends(v_uid, p_b2)) then
    raise exception 'Je kunt alleen jezelf en je vrienden aan een match toevoegen';
  end if;

  v_team_a := public._ensure_team(p_a1, p_a2);
  v_team_b := public._ensure_team(p_b1, p_b2);
  v_winner := case p_winner
                when 'a' then v_team_a
                when 'b' then v_team_b
                else null
              end;

  insert into public.matches (
    team_a_id, team_b_id, status, winner_team_id,
    score_a, score_b, set_scores, played_at, created_by, group_id
  )
  values (
    v_team_a, v_team_b, 'completed', v_winner,
    p_score_a, p_score_b, p_set_scores, now(), v_uid, p_group_id
  )
  returning id into v_match;

  return v_match;
end;
$$;

grant execute on function public.create_completed_match(uuid, uuid, uuid, uuid, text, smallint, smallint, uuid, jsonb) to authenticated;

-- 2b) create_planned_match: p_set_scores toegevoegd (meestal null bij plannen,
--     maar zo blijft de signatuur consistent en kan een set-stand ook vooraf).
drop function if exists public.create_planned_match(uuid, uuid, uuid, uuid, timestamptz, uuid);
create or replace function public.create_planned_match(
  p_a1 uuid, p_a2 uuid, p_b1 uuid, p_b2 uuid,
  p_played_at timestamptz default null,
  p_group_id uuid default null,
  p_set_scores jsonb default null
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
  v_match uuid;
begin
  if v_uid is null then
    raise exception 'Niet ingelogd';
  end if;
  if p_a1 is null or p_a2 is null or p_b1 is null or p_b2 is null then
    raise exception 'Vier spelers vereist';
  end if;
  if p_a1 in (p_a2, p_b1, p_b2) or p_a2 in (p_b1, p_b2) or p_b1 = p_b2 then
    raise exception 'De vier spelers moeten verschillend zijn';
  end if;

  -- Alleen jezelf en je vrienden mogen in de match.
  if not (p_a1 = v_uid or public.are_friends(v_uid, p_a1))
     or not (p_a2 = v_uid or public.are_friends(v_uid, p_a2))
     or not (p_b1 = v_uid or public.are_friends(v_uid, p_b1))
     or not (p_b2 = v_uid or public.are_friends(v_uid, p_b2)) then
    raise exception 'Je kunt alleen jezelf en je vrienden aan een match toevoegen';
  end if;

  v_team_a := public._ensure_team(p_a1, p_a2);
  v_team_b := public._ensure_team(p_b1, p_b2);

  insert into public.matches (
    team_a_id, team_b_id, status, played_at, created_by, group_id, set_scores
  )
  values (
    v_team_a, v_team_b, 'scheduled', p_played_at, v_uid, p_group_id, p_set_scores
  )
  returning id into v_match;

  return v_match;
end;
$$;

grant execute on function public.create_planned_match(uuid, uuid, uuid, uuid, timestamptz, uuid, jsonb) to authenticated;

-- 3) delete_match: verwijdert een match. VEILIGE keuze: alleen de aanmaker, en
--    alleen zolang de match NIET is afgerond. Een afgeronde match verwijderen
--    zou de seizoensstand en de (uit matches herrekende) ratings aantasten, dus
--    dat blokkeren we bewust. Geplande/geannuleerde matches mogen weg.
create or replace function public.delete_match(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_created_by uuid;
  v_status public.match_status;
begin
  if v_uid is null then
    raise exception 'Niet ingelogd';
  end if;

  select created_by, status into v_created_by, v_status
  from public.matches
  where id = p_match_id;

  if not found then
    raise exception 'Match niet gevonden';
  end if;
  if v_created_by is distinct from v_uid then
    raise exception 'Alleen de aanmaker kan deze match verwijderen';
  end if;
  if v_status = 'completed' then
    raise exception 'Een afgeronde match kan niet verwijderd worden (dat zou de stand en ratings aantasten)';
  end if;

  delete from public.matches where id = p_match_id;
end;
$$;

grant execute on function public.delete_match(uuid) to authenticated;
