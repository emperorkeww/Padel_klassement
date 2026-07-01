-- RPC: log een afgeronde match (4 spelers -> teams -> resultaat).
-- Elke speler moet jezelf of een geaccepteerde vriend zijn (in de DB afgedwongen).
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
  if p_winner not in ('a', 'b') then
    raise exception 'Winnaar moet ''a'' of ''b'' zijn';
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
  v_winner := case when p_winner = 'a' then v_team_a else v_team_b end;

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

grant execute on function public.create_completed_match(uuid, uuid, uuid, uuid, text, smallint, smallint, uuid) to authenticated;