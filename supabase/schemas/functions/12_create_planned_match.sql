-- RPC: plan een match vooraf (spelers -> teams -> status 'scheduled').
-- 2v2: vier spelers; 1v1: p_a2 en p_b2 beide null (singles).
-- p_played_at is het (optionele) geplande tijdstip; de uitslag volgt later
-- via de inline score-invoer (setMatchResult) op de kaart "Te spelen".
-- Elke speler moet jezelf of een geaccepteerde vriend zijn (in de DB afgedwongen).
create or replace function public.create_planned_match(
  p_a1 uuid, p_a2 uuid, p_b1 uuid, p_b2 uuid,
  p_played_at timestamptz default null,
  p_group_id uuid default null,
  -- optionele per-set uitslag (jsonb-array); meestal null bij plannen
  p_set_scores jsonb default null,
  -- optioneel baantype (#471); null = niet opgegeven
  p_court_type public.court_type default null,
  -- optionele idempotentie-sleutel (#462): een client-gegenereerde token maakt
  -- het opnieuw afspelen van een offline gequeuede match veilig
  p_client_token uuid default null
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
  v_format public.match_format :=
    case when p_a2 is null and p_b2 is null then '1v1' else '2v2' end;
begin
  if v_uid is null then
    raise exception 'Niet ingelogd';
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

  insert into public.matches (
    team_a_id, team_b_id, status, played_at, created_by, group_id, set_scores, format,
    court_type, client_token
  )
  values (
    v_team_a, v_team_b, 'scheduled', p_played_at, v_uid, p_group_id, p_set_scores, v_format,
    p_court_type, p_client_token
  )
  -- Idempotente replay (#462): een tweede insert met dezelfde token botst op de
  -- partiële unieke index en voegt niets in (RETURNING geeft dan geen rij).
  on conflict (client_token) where client_token is not null do nothing
  returning id into v_match;

  -- Was het een botsing (token al eerder verwerkt)? Geef de bestaande match
  -- terug i.p.v. NULL. Gescoped op created_by: binnen SECURITY DEFINER staat RLS
  -- uit, en de aanmaker kan alleen zijn eigen token opvragen.
  if v_match is null and p_client_token is not null then
    select id into v_match
      from public.matches
     where client_token = p_client_token
       and created_by = v_uid;
  end if;

  return v_match;
end;
$$;

grant execute on function public.create_planned_match(uuid, uuid, uuid, uuid, timestamptz, uuid, jsonb, public.court_type, uuid) to authenticated;
