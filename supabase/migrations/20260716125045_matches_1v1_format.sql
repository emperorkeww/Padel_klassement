create type "public"."match_format" as enum ('1v1', '2v2');

drop view if exists "public"."group_player_standings";

drop view if exists "public"."group_prediction_standings";

drop view if exists "public"."player_standings";

alter table "public"."matches" add column "format" public.match_format not null default '2v2'::public.match_format;

alter table "public"."teams" alter column "player2_id" drop not null;

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public._apply_match_rating(p_match uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  k constant numeric := 24;      -- K-factor
  base constant int := 1000;
  m record;
  a1 uuid; a2 uuid; b1 uuid; b2 uuid;
  ra numeric; rb numeric;        -- teamratings (gemiddelde van de aanwezige spelers)
  ea numeric;                    -- verwachte score team A
  sa numeric;                    -- werkelijke score team A (1/0.5/0)
  da int; db int;                -- rating-delta per team
begin
  select mt.id, mt.team_a_id, mt.team_b_id, mt.winner_team_id,
         coalesce(mt.played_at, mt.created_at) as ts
    into m
    from public.matches mt
    where mt.id = p_match;

  if m.id is null then
    return;
  end if;

  select ta.player1_id, ta.player2_id, tb.player1_id, tb.player2_id
    into a1, a2, b1, b2
    from public.teams ta, public.teams tb
    where ta.id = m.team_a_id and tb.id = m.team_b_id;

  -- Ontbrekende teams (verwijderd?) overslaan.
  if a1 is null or b1 is null then
    return;
  end if;

  -- Bij singles (a2/b2 null) telt alleen de rating van de ene speler; anders
  -- zou een fantoom-partner van 1000 meegemiddeld worden.
  ra := case when a2 is null
    then coalesce((select rating from public.player_ratings where player_id = a1), base)
    else (
      coalesce((select rating from public.player_ratings where player_id = a1), base)
      + coalesce((select rating from public.player_ratings where player_id = a2), base)
    ) / 2.0
  end;
  rb := case when b2 is null
    then coalesce((select rating from public.player_ratings where player_id = b1), base)
    else (
      coalesce((select rating from public.player_ratings where player_id = b1), base)
      + coalesce((select rating from public.player_ratings where player_id = b2), base)
    ) / 2.0
  end;

  ea := 1.0 / (1.0 + power(10.0, (rb - ra) / 400.0));
  sa := case
          when m.winner_team_id = m.team_a_id then 1.0
          when m.winner_team_id = m.team_b_id then 0.0
          else 0.5
        end;

  da := round(k * (sa - ea));
  db := round(k * ((1.0 - sa) - (1.0 - ea)));

  perform public._apply_rating(a1, m.id, da, m.ts);
  if a2 is not null then
    perform public._apply_rating(a2, m.id, da, m.ts);
  end if;
  perform public._apply_rating(b1, m.id, db, m.ts);
  if b2 is not null then
    perform public._apply_rating(b2, m.id, db, m.ts);
  end if;
end;
$function$
;

CREATE OR REPLACE FUNCTION public._ensure_team(p_a uuid, p_b uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_id uuid;
begin
  -- player1_id is not null; zorg dat de gevulde speler altijd in slot 1 zit.
  if p_a is null then
    p_a := p_b;
    p_b := null;
  end if;

  select id into v_id
  from public.teams
  where least(player1_id, player2_id) = least(p_a, p_b)
    and greatest(player1_id, player2_id) = greatest(p_a, p_b);

  if v_id is null then
    insert into public.teams (player1_id, player2_id)
    values (p_a, p_b)
    returning id into v_id;
  end if;

  return v_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.create_completed_match(p_a1 uuid, p_a2 uuid, p_b1 uuid, p_b2 uuid, p_winner text, p_score_a smallint DEFAULT NULL::smallint, p_score_b smallint DEFAULT NULL::smallint, p_group_id uuid DEFAULT NULL::uuid, p_set_scores jsonb DEFAULT NULL::jsonb)
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
    score_a, score_b, set_scores, played_at, created_by, group_id, format
  )
  values (
    v_team_a, v_team_b, 'completed', v_winner,
    p_score_a, p_score_b, p_set_scores, now(), v_uid, p_group_id, v_format
  )
  returning id into v_match;

  return v_match;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.create_planned_match(p_a1 uuid, p_a2 uuid, p_b1 uuid, p_b2 uuid, p_played_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_group_id uuid DEFAULT NULL::uuid, p_set_scores jsonb DEFAULT NULL::jsonb)
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
    team_a_id, team_b_id, status, played_at, created_by, group_id, set_scores, format
  )
  values (
    v_team_a, v_team_b, 'scheduled', p_played_at, v_uid, p_group_id, p_set_scores, v_format
  )
  returning id into v_match;

  return v_match;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.generate_mexicano_round(p_group_id uuid)
 RETURNS SETOF uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := (select auth.uid());
  v_round smallint;
  v_players uuid[];
  v_n int;
  v_i int;
  v_team_a uuid;
  v_team_b uuid;
  v_match_id uuid;
begin
  if v_uid is null then
    raise exception 'Niet ingelogd';
  end if;
  if not public.is_group_member(p_group_id, v_uid) then
    raise exception 'Geen toegang tot deze groep';
  end if;

  -- Ronde-slot: eerst alle uitslagen van de vorige ronde(s) invullen.
  if exists (
    select 1 from public.matches
    where group_id = p_group_id and status <> 'completed'
  ) then
    raise exception 'Vul eerst alle uitslagen van de vorige ronde in voordat je een nieuwe Mexicano-ronde genereert.';
  end if;

  select coalesce(max(round_number), 0) + 1 into v_round
  from public.matches
  where group_id = p_group_id;

  -- Rangschik de leden op stand (punten desc, saldo desc). Spelers zonder
  -- afgeronde match krijgen 0 en vallen via de random-tiebreak willekeurig mee.
  select array_agg(gm.player_id order by coalesce(s.points, 0) desc, coalesce(s.goal_diff, 0) desc, random())
  into v_players
  from public.group_members gm
  left join (
    select pt.player_id,
           sum(case when tr.winner_team_id = tr.team_id then 3
                    when tr.winner_team_id is null then 1
                    else 0 end)                                    as points,
           sum(coalesce(tr.scored_for, 0) - coalesce(tr.scored_against, 0)) as goal_diff
    from (
      select team_a_id as team_id, winner_team_id,
             score_a as scored_for, score_b as scored_against
      from public.matches
      where group_id = p_group_id and status = 'completed'
      union all
      select team_b_id, winner_team_id, score_b, score_a
      from public.matches
      where group_id = p_group_id and status = 'completed'
    ) tr
    join (
      select id as team_id, player1_id as player_id from public.teams
      union all
      -- singles-teams hebben geen tweede speler
      select id, player2_id from public.teams where player2_id is not null
    ) pt on pt.team_id = tr.team_id
    group by pt.player_id
  ) s on s.player_id = gm.player_id
  where gm.group_id = p_group_id;

  v_n := coalesce(array_length(v_players, 1), 0);
  if v_n < 4 then
    raise exception 'Minimaal 4 spelers nodig voor een Mexicano-ronde (nu %).', v_n;
  end if;

  -- Per court van 4 gerangschikte spelers: 1&4 tegen 2&3. Overige 1-3 spelers
  -- zitten deze ronde op de bank.
  v_i := 1;
  while v_i + 3 <= v_n loop
    v_team_a := public._ensure_team(v_players[v_i], v_players[v_i + 3]);
    v_team_b := public._ensure_team(v_players[v_i + 1], v_players[v_i + 2]);

    insert into public.matches (team_a_id, team_b_id, status, group_id, round_number, created_by)
    values (v_team_a, v_team_b, 'scheduled', p_group_id, v_round, v_uid)
    returning id into v_match_id;

    return next v_match_id;
    v_i := v_i + 4;
  end loop;

  return;
end;
$function$
;

create or replace view "public"."group_player_standings" with (security_invoker = true) as  WITH team_results AS (
         SELECT matches.group_id,
            matches.team_a_id AS team_id,
            matches.winner_team_id,
            matches.score_a AS scored_for,
            matches.score_b AS scored_against
           FROM public.matches
          WHERE ((matches.status = 'completed'::public.match_status) AND (matches.group_id IS NOT NULL))
        UNION ALL
         SELECT matches.group_id,
            matches.team_b_id AS team_id,
            matches.winner_team_id,
            matches.score_b AS scored_for,
            matches.score_a AS scored_against
           FROM public.matches
          WHERE ((matches.status = 'completed'::public.match_status) AND (matches.group_id IS NOT NULL))
        ), player_team AS (
         SELECT teams.id AS team_id,
            teams.player1_id AS player_id
           FROM public.teams
        UNION ALL
         SELECT teams.id AS team_id,
            teams.player2_id AS player_id
           FROM public.teams
          WHERE (teams.player2_id IS NOT NULL)
        )
 SELECT tr.group_id,
    p.id AS player_id,
    p.username,
    p.full_name,
    count(*) AS played,
    count(*) FILTER (WHERE (tr.winner_team_id = tr.team_id)) AS won,
    count(*) FILTER (WHERE (tr.winner_team_id IS NULL)) AS drawn,
    count(*) FILTER (WHERE ((tr.winner_team_id IS NOT NULL) AND (tr.winner_team_id <> tr.team_id))) AS lost,
    ((count(*) FILTER (WHERE (tr.winner_team_id = tr.team_id)) * 3) + count(*) FILTER (WHERE (tr.winner_team_id IS NULL))) AS points,
    COALESCE(sum((COALESCE((tr.scored_for)::integer, 0) - COALESCE((tr.scored_against)::integer, 0))), (0)::bigint) AS goal_diff
   FROM ((team_results tr
     JOIN player_team pt ON ((pt.team_id = tr.team_id)))
     JOIN public.profiles p ON ((p.id = pt.player_id)))
  GROUP BY tr.group_id, p.id, p.username, p.full_name;


create or replace view "public"."group_prediction_standings" with (security_invoker = true) as  SELECT mp.group_id,
    p.id AS player_id,
    p.username,
    p.full_name,
    count(*) FILTER (WHERE (mp.points IS NOT NULL)) AS predicted,
    count(*) FILTER (WHERE (mp.points > 0)) AS correct,
    COALESCE(sum(mp.points), (0)::bigint) AS points
   FROM (public.match_predictions mp
     JOIN public.profiles p ON ((p.id = mp.player_id)))
  GROUP BY mp.group_id, p.id, p.username, p.full_name;


CREATE OR REPLACE FUNCTION public.match_smoesjes_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  m record;
  v_loser uuid;
  l record;
begin
  select id, group_id, status, winner_team_id, team_a_id, team_b_id
    into m
    from public.matches
    where id = new.match_id;

  if m.id is null then
    raise exception 'match bestaat niet';
  end if;
  if m.group_id is null or m.group_id is distinct from new.group_id then
    raise exception 'een smoes plaatsen kan alleen op groepsmatches';
  end if;
  if m.status <> 'completed' then
    raise exception 'deze match is nog niet afgerond';
  end if;
  if m.winner_team_id is null then
    raise exception 'bij een gelijkspel valt er niets goed te praten';
  end if;

  -- Het verliezende team en de vraag of de speler daarin zat.
  v_loser := case when m.winner_team_id = m.team_a_id then m.team_b_id else m.team_a_id end;
  select player1_id, player2_id into l from public.teams where id = v_loser;
  -- "not in (..., null)" evalueert naar null en zou de guard stil passeren
  -- bij een singles-team; daarom expliciet "is distinct from".
  if new.player_id <> l.player1_id and new.player_id is distinct from l.player2_id then
    raise exception 'alleen wie de match verloor mag een smoes plaatsen';
  end if;

  new.updated_at := now();
  return new;
end;
$function$
;

create or replace view "public"."player_standings" with (security_invoker = true) as  WITH team_results AS (
         SELECT matches.team_a_id AS team_id,
            matches.winner_team_id,
            matches.score_a AS scored_for,
            matches.score_b AS scored_against
           FROM public.matches
          WHERE (matches.status = 'completed'::public.match_status)
        UNION ALL
         SELECT matches.team_b_id AS team_id,
            matches.winner_team_id,
            matches.score_b AS scored_for,
            matches.score_a AS scored_against
           FROM public.matches
          WHERE (matches.status = 'completed'::public.match_status)
        ), player_team AS (
         SELECT teams.id AS team_id,
            teams.player1_id AS player_id
           FROM public.teams
        UNION ALL
         SELECT teams.id AS team_id,
            teams.player2_id AS player_id
           FROM public.teams
          WHERE (teams.player2_id IS NOT NULL)
        )
 SELECT p.id AS player_id,
    p.username,
    p.full_name,
    count(*) AS played,
    count(*) FILTER (WHERE (tr.winner_team_id = tr.team_id)) AS won,
    count(*) FILTER (WHERE (tr.winner_team_id IS NULL)) AS drawn,
    count(*) FILTER (WHERE ((tr.winner_team_id IS NOT NULL) AND (tr.winner_team_id <> tr.team_id))) AS lost,
    ((count(*) FILTER (WHERE (tr.winner_team_id = tr.team_id)) * 3) + count(*) FILTER (WHERE (tr.winner_team_id IS NULL))) AS points,
    COALESCE(sum((COALESCE((tr.scored_for)::integer, 0) - COALESCE((tr.scored_against)::integer, 0))), (0)::bigint) AS goal_diff
   FROM ((team_results tr
     JOIN player_team pt ON ((pt.team_id = tr.team_id)))
     JOIN public.profiles p ON ((p.id = pt.player_id)))
  WHERE (NOT p.is_guest)
  GROUP BY p.id, p.username, p.full_name;


CREATE OR REPLACE FUNCTION public.prediction_win_chance(p_match uuid, p_team uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

  r_team := case when p2 is null
    then coalesce((select rating from public.player_ratings where player_id = p1), base)
    else (
      coalesce((select rating from public.player_ratings where player_id = p1), base)
      + coalesce((select rating from public.player_ratings where player_id = p2), base)
    ) / 2.0
  end;
  r_other := case when o2 is null
    then coalesce((select rating from public.player_ratings where player_id = o1), base)
    else (
      coalesce((select rating from public.player_ratings where player_id = o1), base)
      + coalesce((select rating from public.player_ratings where player_id = o2), base)
    ) / 2.0
  end;

  return round(1.0 / (1.0 + power(10.0, (r_other - r_team) / 400.0)), 4);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.recompute_pias()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  -- WHERE true: de authenticator-rol laadt safeupdate, die ongekwalificeerde
  -- DELETE blokkeert — ook binnen deze SECURITY DEFINER-functie (zie 09_ratings).
  delete from public.pias_of_week where true;

  insert into public.pias_of_week
    (group_id, iso_year, iso_week, player_id, match_id, win_chance, week_start)
  with chokes as (
    -- Alle afgeronde groepsmatches met een winnaar, met hun ISO-week.
    select
      m.id                                                                as match_id,
      m.group_id,
      extract(isoyear from coalesce(m.played_at, m.created_at))::smallint as iso_year,
      extract(week    from coalesce(m.played_at, m.created_at))::smallint as iso_week,
      date_trunc('week', coalesce(m.played_at, m.created_at))::date       as week_start,
      m.winner_team_id                                                    as winner_team_id,
      case when m.winner_team_id = m.team_a_id then m.team_b_id else m.team_a_id end
                                                                          as loser_team_id
    from public.matches m
    where m.status = 'completed'
      and m.group_id is not null
      and m.winner_team_id is not null
  ),
  rated as (
    -- Pre-match ratings van de spelers uit rating_history (basis 1000 als er
    -- nog geen historie is, bv. verwijderde speler). Bij singles is player2
    -- null en blijft rl2/rw2 null, zodat er geen fantoom-1000 meegemiddeld wordt.
    select
      c.*,
      lt.player1_id as l1, lt.player2_id as l2,
      coalesce(rl1.rating_before, 1000) as rl1,
      case when lt.player2_id is not null then coalesce(rl2.rating_before, 1000) end as rl2,
      coalesce(rw1.rating_before, 1000) as rw1,
      case when wt.player2_id is not null then coalesce(rw2.rating_before, 1000) end as rw2
    from chokes c
    join public.teams lt on lt.id = c.loser_team_id
    join public.teams wt on wt.id = c.winner_team_id
    left join public.rating_history rl1
      on rl1.match_id = c.match_id and rl1.player_id = lt.player1_id
    left join public.rating_history rl2
      on rl2.match_id = c.match_id and rl2.player_id = lt.player2_id
    left join public.rating_history rw1
      on rw1.match_id = c.match_id and rw1.player_id = wt.player1_id
    left join public.rating_history rw2
      on rw2.match_id = c.match_id and rw2.player_id = wt.player2_id
  ),
  scored as (
    select
      r.*,
      -- Winkans van het verliezende team vóór de match. Geklemd op < 1 zodat
      -- de check-constraint nooit sneuvelt bij extreme rating-verschillen.
      -- coalesce(x2, x1) laat een singles-team op de rating van de ene speler
      -- uitkomen in plaats van op een gemiddelde met een fantoom-partner.
      least(
        0.9999,
        round(
          1.0 / (1.0 + power(10.0,
            ((r.rw1 + coalesce(r.rw2, r.rw1)) / 2.0
             - (r.rl1 + coalesce(r.rl2, r.rl1)) / 2.0) / 400.0)),
          4)
      ) as loser_chance
    from rated r
  ),
  best as (
    -- Per (groep, ISO-week) de pijnlijkste choke: hoogste verlieskans.
    select distinct on (group_id, iso_year, iso_week)
      group_id, iso_year, iso_week, week_start, match_id, loser_chance,
      l1, l2, rl1, rl2
    from scored
    where loser_chance > 0.65
    order by group_id, iso_year, iso_week, loser_chance desc, match_id
  )
  select
    b.group_id, b.iso_year, b.iso_week,
    -- De pias: de verliezer met de hoogste pre-match rating (de grootste naam
    -- die flopte); bij gelijke rating de eerste speler van het team. Bij
    -- singles (l2 null) is er maar één kandidaat.
    case when b.l2 is null then b.l1
         when b.rl1 >= b.rl2 then b.l1
         else b.l2 end as player_id,
    b.match_id, b.loser_chance, b.week_start
  from best b;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.recompute_zwarte_piet()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  r record;
  v_group  uuid := null;
  v_holder uuid := null;
  v_from   uuid := null;
  v_reden  text := null;
  v_ernst  int  := null;
  v_detail text := null;
  v_match  uuid := null;
  v_since  date := null;
begin
  -- WHERE true: safeupdate blokkeert een ongekwalificeerde DELETE (zie 09_ratings).
  delete from public.zwarte_piet where true;

  for r in
    with completed as (
      select m.id as match_id, m.group_id,
             coalesce(m.played_at, m.created_at) as ts,
             m.winner_team_id, m.team_a_id, m.team_b_id, m.score_a, m.score_b
      from public.matches m
      where m.status = 'completed' and m.group_id is not null
    ),
    -- Elke deelnemer per match met uitkomst W/L/D (D voor gelijkspel).
    participants as (
      select c.match_id, c.group_id, c.ts, c.winner_team_id,
             c.team_a_id, c.team_b_id, c.score_a, c.score_b,
             pt.player_id, pt.team_id,
             case when c.winner_team_id is null then 'D'
                  when c.winner_team_id = pt.team_id then 'W'
                  else 'L' end as outcome
      from completed c
      join (
        select id as team_id, player1_id as player_id from public.teams
        union all
        -- singles-teams hebben geen tweede speler
        select id as team_id, player2_id as player_id from public.teams
        where player2_id is not null
      ) pt on pt.team_id in (c.team_a_id, c.team_b_id)
    ),
    -- Lopende verliesreeks per (groep, speler): rij-index minus de laatste
    -- niet-verlies-index (gaps-and-islands). Gelijkspel/winst zetten 'm op 0.
    base as (
      select p.*,
             row_number() over w as rn,
             case when p.outcome <> 'L' then row_number() over w end as nlrn
      from participants p
      window w as (partition by p.group_id, p.player_id order by p.ts, p.match_id)
    ),
    streaked as (
      select b.*,
             b.rn - coalesce(
               max(b.nlrn) over (
                 partition by b.group_id, b.player_id
                 order by b.ts, b.match_id
                 rows between unbounded preceding and current row),
               0) as loss_streak
      from base b
    ),
    -- Winkans van het verliezende team vóór de match (favoriet als ≥0.5), voor
    -- de choke — identiek aan recompute_pias.
    match_choke as (
      -- Bij singles telt alleen de rating van de ene speler mee (geen
      -- fantoom-1000-partner in het gemiddelde).
      select c.match_id,
             least(0.9999, round(
               1.0 / (1.0 + power(10.0,
                 ((coalesce(rw1.rating_before, 1000)
                   + case when wt.player2_id is null then coalesce(rw1.rating_before, 1000)
                          else coalesce(rw2.rating_before, 1000) end) / 2.0
                  - (coalesce(rl1.rating_before, 1000)
                     + case when lt.player2_id is null then coalesce(rl1.rating_before, 1000)
                            else coalesce(rl2.rating_before, 1000) end) / 2.0)
                 / 400.0)), 4)) as loser_chance
      from completed c
      join public.teams lt
        on lt.id = case when c.winner_team_id = c.team_a_id then c.team_b_id else c.team_a_id end
      join public.teams wt on wt.id = c.winner_team_id
      left join public.rating_history rl1 on rl1.match_id = c.match_id and rl1.player_id = lt.player1_id
      left join public.rating_history rl2 on rl2.match_id = c.match_id and rl2.player_id = lt.player2_id
      left join public.rating_history rw1 on rw1.match_id = c.match_id and rw1.player_id = wt.player1_id
      left join public.rating_history rw2 on rw2.match_id = c.match_id and rw2.player_id = wt.player2_id
      where c.winner_team_id is not null
    ),
    -- Verliezers met eigen/tegenscore, verliesreeks en team-choke-kans.
    losers as (
      select s.match_id, s.group_id, s.player_id, s.loss_streak,
             case when s.team_id = s.team_a_id then s.score_a else s.score_b end as mij,
             case when s.team_id = s.team_a_id then s.score_b else s.score_a end as hen,
             mc.loser_chance
      from streaked s
      left join match_choke mc on mc.match_id = s.match_id
      where s.outcome = 'L'
    ),
    -- De ergste afgang per verliezende speler (hoogste ernst wint).
    afgang as (
      select l.match_id, l.player_id, k.reden, k.ernst, k.detail
      from losers l
      cross join lateral (
        select c.reden, c.ernst, c.detail
        from (values
          ('bagel'::text,
           case when l.mij = 0 and l.hen > 0 then 110 end,
           'slikte een bagel 🥯'::text),
          ('afdroging',
           case when (l.hen - l.mij) >= 4 then 50 + (l.hen - l.mij) end,
           'ging met ' || (l.hen - l.mij) || ' games verschil de boot in'),
          ('zwarte-reeks',
           case when l.loss_streak >= 3 then 40 + l.loss_streak end,
           'verloor ' || l.loss_streak || '× op rij'),
          ('choke',
           case when l.loser_chance >= 0.6 then 30 + round(l.loser_chance * 10)::int end,
           'was torenhoge favoriet en ging tóch onderuit (' || round(l.loser_chance * 100)::int || '% kans)')
        ) as c(reden, ernst, detail)
        where c.ernst is not null
        order by c.ernst desc
        limit 1
      ) k
    ),
    -- Per match de ergste flopper (hoogste ernst, tie-break laagste id).
    worst as (
      select distinct on (match_id)
             match_id, player_id, reden, ernst, detail
      from afgang
      order by match_id, ernst desc, player_id
    ),
    -- Overzicht per beslissende match: winnaars + eventuele ergste flopper.
    summary as (
      select c.group_id, c.match_id, c.ts,
             wt.player1_id as win_p1, wt.player2_id as win_p2,
             w.player_id as worst_player, w.reden as worst_reden,
             w.ernst as worst_ernst, w.detail as worst_detail
      from completed c
      join public.teams wt on wt.id = c.winner_team_id
      left join worst w on w.match_id = c.match_id
      where c.winner_team_id is not null
    )
    select * from summary order by group_id, ts, match_id
  loop
    -- Groepswissel: vorige drager wegschrijven, staat resetten.
    if v_group is distinct from r.group_id then
      if v_holder is not null then
        insert into public.zwarte_piet
          (group_id, holder_id, from_id, reden, ernst, detail, match_id, since)
        values (v_group, v_holder, v_from, v_reden, v_ernst, v_detail, v_match, v_since);
      end if;
      v_group := r.group_id;
      v_holder := null; v_from := null; v_reden := null;
      v_ernst := null; v_detail := null; v_match := null; v_since := null;
    end if;

    if r.worst_player is not null then
      -- Recency: een nieuwe flopper pakt de Piet af. Dezelfde drager die
      -- opnieuw flopt houdt 'm (since blijft lopen).
      if v_holder is null or v_holder <> r.worst_player then
        v_from := v_holder;
        v_holder := r.worst_player;
        v_reden := r.worst_reden;
        v_ernst := r.worst_ernst;
        v_detail := r.worst_detail;
        v_match := r.match_id;
        v_since := r.ts::date;
      end if;
    elsif v_holder is not null
      and (v_holder = r.win_p1 or v_holder is not distinct from r.win_p2) then
      -- Geen flop en de drager won: verlost → Piet vrij. Expliciet null-safe:
      -- "in (..., null)" zou bij een singles-winnaar naar null evalueren.
      v_holder := null;
    end if;
  end loop;

  -- Laatste groep wegschrijven.
  if v_holder is not null then
    insert into public.zwarte_piet
      (group_id, holder_id, from_id, reden, ernst, detail, match_id, since)
    values (v_group, v_holder, v_from, v_reden, v_ernst, v_detail, v_match, v_since);
  end if;
end;
$function$
;

-- NB: db diff wilde hier ook de avatar-storage-policies droppen (die staan in
-- 20260701150000_avatars_storage.sql maar niet in schemas/); handmatig
-- verwijderd -- niets aan de storage-policies wijzigt in deze migratie.


