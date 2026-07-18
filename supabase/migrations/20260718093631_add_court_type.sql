-- Baantype op matches (#471): optioneel enum voor de baanvoorkeuren-statistiek
-- op het spelersprofiel. De aanmaak-RPC's krijgen een extra p_court_type-param;
-- omdat de signatuur wijzigt, wordt de oude variant eerst gedropt.
create type "public"."court_type" as enum ('binnen', 'buiten', 'panorama', 'muur');

drop function if exists "public"."create_completed_match"(p_a1 uuid, p_a2 uuid, p_b1 uuid, p_b2 uuid, p_winner text, p_score_a smallint, p_score_b smallint, p_group_id uuid, p_set_scores jsonb);

drop function if exists "public"."create_planned_match"(p_a1 uuid, p_a2 uuid, p_b1 uuid, p_b2 uuid, p_played_at timestamp with time zone, p_group_id uuid, p_set_scores jsonb);

alter table "public"."matches" add column "court_type" public.court_type;

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.create_completed_match(p_a1 uuid, p_a2 uuid, p_b1 uuid, p_b2 uuid, p_winner text, p_score_a smallint DEFAULT NULL::smallint, p_score_b smallint DEFAULT NULL::smallint, p_group_id uuid DEFAULT NULL::uuid, p_set_scores jsonb DEFAULT NULL::jsonb, p_court_type public.court_type DEFAULT NULL::public.court_type)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    score_a, score_b, set_scores, played_at, created_by, group_id, format,
    court_type
  )
  values (
    v_team_a, v_team_b, 'completed', v_winner,
    p_score_a, p_score_b, p_set_scores, now(), v_uid, p_group_id, v_format,
    p_court_type
  )
  returning id into v_match;

  return v_match;
end;
$function$
;

grant execute on function public.create_completed_match(uuid, uuid, uuid, uuid, text, smallint, smallint, uuid, jsonb, public.court_type) to authenticated;

CREATE OR REPLACE FUNCTION public.create_planned_match(p_a1 uuid, p_a2 uuid, p_b1 uuid, p_b2 uuid, p_played_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_group_id uuid DEFAULT NULL::uuid, p_set_scores jsonb DEFAULT NULL::jsonb, p_court_type public.court_type DEFAULT NULL::public.court_type)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    court_type
  )
  values (
    v_team_a, v_team_b, 'scheduled', p_played_at, v_uid, p_group_id, p_set_scores, v_format,
    p_court_type
  )
  returning id into v_match;

  return v_match;
end;
$function$
;

grant execute on function public.create_planned_match(uuid, uuid, uuid, uuid, timestamp with time zone, uuid, jsonb, public.court_type) to authenticated;
