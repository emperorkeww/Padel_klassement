-- RPC: log een afgeronde match (spelers -> teams -> resultaat).
-- 2v2: vier spelers; 1v1: p_a2 en p_b2 beide null (singles).
-- p_winner is 'a', 'b' of 'draw' (gelijkspel: winner_team_id blijft NULL).
-- Elke speler moet jezelf of een geaccepteerde vriend zijn (in de DB afgedwongen).
create or replace function public.create_completed_match(
  p_a1 uuid, p_a2 uuid, p_b1 uuid, p_b2 uuid,
  p_winner text,
  p_score_a smallint default null,
  p_score_b smallint default null,
  p_group_id uuid default null,
  -- optionele per-set uitslag (jsonb-array), bv. [[6,4],[3,6],[7,5]]
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
  v_format public.match_format :=
    case when p_a2 is null and p_b2 is null then '1v1' else '2v2' end;
begin
  if v_uid is null then
    raise exception 'Niet ingelogd';
  end if;
  if p_winner not in ('a', 'b', 'draw') then
    raise exception 'Winnaar moet ''a'', ''b'' of ''draw'' zijn';
  end if;
  if p_a1 is null or p_b1 is null then
    raise exception 'Elk team heeft minstens één speler nodig';
  end if;
  -- 1v1 = beide tweede spelers leeg; 2v2 = beide gevuld. Eén van de twee leeg
  -- is geen geldige speelvorm.
  if (p_a2 is null) <> (p_b2 is null) then
    raise exception 'Kies 1v1 of 2v2: beide teams moeten even groot zijn';
  end if;
  -- Alle aanwezige spelers moeten verschillend zijn. Let op: "x in (..., null)"
  -- evalueert naar null, daarom expliciet "is distinct from".
  if p_a1 = p_b1
     or p_a1 is not distinct from p_a2 or p_a1 is not distinct from p_b2
     or p_b1 is not distinct from p_a2 or p_b1 is not distinct from p_b2
     or (p_a2 is not null and p_a2 is not distinct from p_b2) then
    raise exception 'De spelers moeten verschillend zijn';
  end if;

  -- Loggen binnen een groep mag alleen als je zelf lid bent.
  if p_group_id is not null and not public.is_group_member(p_group_id, v_uid) then
    raise exception 'Geen toegang tot deze groep';
  end if;

  -- Jezelf, je vrienden, je eigen gasten of (binnen een groep) medeleden.
  if not public._can_add_player(v_uid, p_a1, p_group_id)
     or (p_a2 is not null and not public._can_add_player(v_uid, p_a2, p_group_id))
     or not public._can_add_player(v_uid, p_b1, p_group_id)
     or (p_b2 is not null and not public._can_add_player(v_uid, p_b2, p_group_id)) then
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
    score_a, score_b, set_scores, played_at, created_by, group_id, format
  )
  values (
    v_team_a, v_team_b, 'completed', v_winner,
    p_score_a, p_score_b, p_set_scores, now(), v_uid, p_group_id, v_format
  )
  returning id into v_match;

  return v_match;
end;
$$;

grant execute on function public.create_completed_match(uuid, uuid, uuid, uuid, text, smallint, smallint, uuid, jsonb) to authenticated;
