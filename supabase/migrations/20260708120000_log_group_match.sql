-- Matches handmatig loggen/plannen binnen een groep. De rondegeneratoren
-- (americano/mexicano) gebruiken een groepslidmaatschap-check, maar de losse
-- create_completed_match / create_planned_match eisten dat elke speler jezelf,
-- een vriend of je eigen gast is. Groepsleden zijn echter niet per se vrienden
-- (denk aan de uitnodigingslink). Daarom: binnen een groep mogen ook medeleden
-- in de match, en moet de aanmaker zelf lid van die groep zijn.

-- Mag p_player door p_uid aan een match worden toegevoegd? Jezelf, een vriend,
-- je eigen gast, of — als er een groep is opgegeven — een medelid van die groep.
create or replace function public._can_add_player(
  p_uid uuid, p_player uuid, p_group_id uuid
)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select p_player = p_uid
      or public.are_friends(p_uid, p_player)
      or public.is_own_guest(p_uid, p_player)
      or (p_group_id is not null and public.is_group_member(p_group_id, p_player));
$$;

revoke execute on function public._can_add_player(uuid, uuid, uuid) from public;

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

  if p_group_id is not null and not public.is_group_member(p_group_id, v_uid) then
    raise exception 'Geen toegang tot deze groep';
  end if;

  if not public._can_add_player(v_uid, p_a1, p_group_id)
     or not public._can_add_player(v_uid, p_a2, p_group_id)
     or not public._can_add_player(v_uid, p_b1, p_group_id)
     or not public._can_add_player(v_uid, p_b2, p_group_id) then
    raise exception 'Je kunt alleen jezelf, je vrienden, je eigen gasten en groepsleden aan een match toevoegen';
  end if;

  v_team_a := public._ensure_team(p_a1, p_a2);
  v_team_b := public._ensure_team(p_b1, p_b2);

  insert into public.matches (
    team_a_id, team_b_id, status, played_at, created_by, group_id
  )
  values (
    v_team_a, v_team_b, 'scheduled', p_played_at, v_uid, p_group_id
  )
  returning id into v_match;

  return v_match;
end;
$$;
