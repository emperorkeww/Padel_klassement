-- RPC: plan een match vooraf (4 spelers -> teams -> status 'scheduled').
-- p_played_at is het (optionele) geplande tijdstip; de uitslag volgt later
-- via de inline score-invoer (setMatchResult) op de kaart "Te spelen".
-- Elke speler moet jezelf of een geaccepteerde vriend zijn (in de DB afgedwongen).
create or replace function public.create_planned_match(
  p_a1 uuid, p_a2 uuid, p_b1 uuid, p_b2 uuid,
  p_played_at timestamptz default null,
  p_group_id uuid default null,
  -- optionele per-set uitslag (jsonb-array); meestal null bij plannen
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

  -- Loggen binnen een groep mag alleen als je zelf lid bent.
  if p_group_id is not null and not public.is_group_member(p_group_id, v_uid) then
    raise exception 'Geen toegang tot deze groep';
  end if;

  -- Jezelf, je vrienden, je eigen gasten of (binnen een groep) medeleden.
  if not public._can_add_player(v_uid, p_a1, p_group_id)
     or not public._can_add_player(v_uid, p_a2, p_group_id)
     or not public._can_add_player(v_uid, p_b1, p_group_id)
     or not public._can_add_player(v_uid, p_b2, p_group_id) then
    raise exception 'Je kunt alleen jezelf, je vrienden, je eigen gasten en groepsleden aan een match toevoegen';
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
