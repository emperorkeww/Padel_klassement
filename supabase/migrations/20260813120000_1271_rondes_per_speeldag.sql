-- #1271 Rondes tellen binnen hun speeldag — spiegel van
-- supabase/schemas/functions/{05_americano,10_mexicano,13_create_fair_round}.sql.
--
-- `round_number` was max+1 over de hele groep, dus de tiende speeldag begon bij
-- "Ronde 37". De app gaf dat zelf toe: `dagStatus.ts` en `DagKop.tsx` droegen
-- allebei een guard met de motivering dat "ronde 4 van 3" onzin zou zijn. Een
-- ronde hoort te nummeren binnen zijn speeldag.
--
-- De dag komt uit het starttijdstip van de ronde (#827), in clubtijd. Dat is
-- een benadering van de regel die de app hanteert (#1221: de match hoort bij
-- het dichtstbijzijnde moment, met een uur voorsprong) — een sessie die over
-- middernacht loopt begint dus opnieuw te tellen. Zichtbaar en onschuldig; een
-- poll_id op matches bestaat niet.
--
-- Met de hand geschreven en niet via `supabase db diff`: dat commando draait op
-- develop niet meer door bestaande schema-drift.

-- 1. De bestaande rijen hernummeren ------------------------------------------
--
-- Zonder deze stap is de historie half oud en half nieuw genummerd: de rondes
-- van vorige week blijven 34, 35, 36 terwijl die van vanavond bij 1 beginnen.
-- dense_rank en niet row_number: alle matches van dezelfde ronde delen één
-- nummer, ook als er drie banen tegelijk speelden.
--
-- Losse matches (`round_number is null`) blijven met rust: die horen bij geen
-- enkele ronde en de constraint eist >= 1.
with hernummerd as (
  select
    id,
    dense_rank() over (
      partition by
        group_id,
        (coalesce(played_at, created_at) at time zone 'Europe/Brussels')::date
      order by round_number
    ) as nieuw
  from public.matches
  where round_number is not null
)
update public.matches m
   set round_number = h.nieuw
  from hernummerd h
 where m.id = h.id
   and m.round_number is distinct from h.nieuw;

-- 2. De drie generatoren -----------------------------------------------------

-- RPC: genereer een Americano-ronde met wisselende partners voor een groep.
-- p_played_at is het (optionele) starttijdstip van de ronde (#827): bij een
-- gelockte speeldag-poll is dat de echte starttijd, anders null zoals voorheen.
create or replace function public.generate_americano_round(
  p_group_id uuid,
  p_played_at timestamptz default null
)
returns setof uuid
language plpgsql
security definer
set search_path = ''
as $$
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

  -- Ronde-nummer binnen déze speeldag (#1271). Het was max+1 over de hele
  -- groep, dus de tiende speeldag begon bij "Ronde 37" — en de app moest met
  -- guards voorkomen dat er "ronde 4 van 3" kwam te staan. De dag komt uit het
  -- starttijdstip van de ronde zelf, in clubtijd; zonder tijdstip uit nu.
  --
  -- Dit is een benadering van de regel die de app hanteert (#1221: de match
  -- hoort bij het dichtstbijzijnde moment, met een uur voorsprong). Voor een
  -- sessie die over middernacht heen loopt kan de nummering dus opnieuw
  -- beginnen. Dat is zichtbaar en onschuldig; een poll_id op matches is er niet.
  select coalesce(max(round_number), 0) + 1 into v_round
  from public.matches
  where group_id = p_group_id
    and (coalesce(played_at, created_at) at time zone 'Europe/Brussels')::date
        = (coalesce(p_played_at, now()) at time zone 'Europe/Brussels')::date;

  select array_agg(player_id order by random())
  into v_players
  from public.group_members
  where group_id = p_group_id;

  v_n := coalesce(array_length(v_players, 1), 0);
  if v_n < 4 then
    raise exception 'Minimaal 4 spelers nodig voor een Americano-ronde (nu %).', v_n;
  end if;

  -- Vorm zoveel mogelijk courts van 4 spelers (2 vs 2). Overige 1-3 spelers
  -- zitten deze ronde op de bank.
  v_i := 1;
  while v_i + 3 <= v_n loop
    v_team_a := public._ensure_team(v_players[v_i], v_players[v_i + 1]);
    v_team_b := public._ensure_team(v_players[v_i + 2], v_players[v_i + 3]);

    insert into public.matches (team_a_id, team_b_id, status, group_id, round_number, created_by, played_at)
    values (v_team_a, v_team_b, 'scheduled', p_group_id, v_round, v_uid, p_played_at)
    returning id into v_match_id;

    return next v_match_id;
    v_i := v_i + 4;
  end loop;

  return;
end;
$$;

grant execute on function public.generate_americano_round(uuid, timestamptz) to authenticated;
-- RPC: genereer een Mexicano-ronde voor een groep.
--
-- Verschil met Americano: de partners/tegenstanders worden niet willekeurig
-- gekozen maar op basis van de huidige stand. Spelers worden gerangschikt op
-- punten (en saldo), en per court van 4 speelt rang 1&4 tegen 2&3 — zo spelen
-- gelijkwaardige spelers tegen elkaar.
--
-- Blokkade: er mag geen geplande match meer openstaan in de groep. Anders zou
-- de volgende ronde op een halve (onvolledige) stand gepaird worden. Een
-- geannuleerde match telt daar niet in mee (#1271): die levert nooit meer een
-- uitslag op en zou de groep anders permanent blokkeren.
--
-- p_played_at is het (optionele) starttijdstip van de ronde (#827): bij een
-- gelockte speeldag-poll is dat de echte starttijd, anders null zoals voorheen.
--
-- p_players is wie er vanavond meespeelt (#1271). Laat hem weg en de hele
-- ledenlijst wordt ingedeeld — het oude gedrag, dat wie afzegde gewoon op de
-- baan zette terwijl de kaart "8 aan · 1 op de bank" beloofde. Anders dan bij
-- create_fair_round is dit een pool en geen indeling: de volgorde komt uit de
-- stand, niet uit de lijst.
create or replace function public.generate_mexicano_round(
  p_group_id uuid,
  p_played_at timestamptz default null,
  p_players uuid[] default null
)
returns setof uuid
language plpgsql
security definer
set search_path = ''
as $$
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

  if p_players is not null and exists (
    select 1 from unnest(p_players) as pid
    where not public.is_group_member(p_group_id, pid)
  ) then
    raise exception 'Alle spelers moeten lid zijn van deze groep';
  end if;

  -- Ronde-slot: eerst alle uitslagen van de vorige ronde(s) invullen.
  if exists (
    select 1 from public.matches
    where group_id = p_group_id and status = 'scheduled'
  ) then
    raise exception 'Vul eerst alle uitslagen van de vorige ronde in voordat je een nieuwe Mexicano-ronde genereert.';
  end if;

  -- Ronde-nummer binnen déze speeldag (#1271). Het was max+1 over de hele
  -- groep, dus de tiende speeldag begon bij "Ronde 37" — en de app moest met
  -- guards voorkomen dat er "ronde 4 van 3" kwam te staan. De dag komt uit het
  -- starttijdstip van de ronde zelf, in clubtijd; zonder tijdstip uit nu.
  --
  -- Dit is een benadering van de regel die de app hanteert (#1221: de match
  -- hoort bij het dichtstbijzijnde moment, met een uur voorsprong). Voor een
  -- sessie die over middernacht heen loopt kan de nummering dus opnieuw
  -- beginnen. Dat is zichtbaar en onschuldig; een poll_id op matches is er niet.
  select coalesce(max(round_number), 0) + 1 into v_round
  from public.matches
  where group_id = p_group_id
    and (coalesce(played_at, created_at) at time zone 'Europe/Brussels')::date
        = (coalesce(p_played_at, now()) at time zone 'Europe/Brussels')::date;

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
  where gm.group_id = p_group_id
    and (p_players is null or gm.player_id = any(p_players));

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

    insert into public.matches (team_a_id, team_b_id, status, group_id, round_number, created_by, played_at)
    values (v_team_a, v_team_b, 'scheduled', p_group_id, v_round, v_uid, p_played_at)
    returning id into v_match_id;

    return next v_match_id;
    v_i := v_i + 4;
  end loop;

  return;
end;
$$;

grant execute on function public.generate_mexicano_round(uuid, timestamptz, uuid[]) to authenticated;

-- RPC: schrijf een "Eerlijke teams"-voorstel weg als speelbare geplande matches.
-- p_players is een platte lijst, per baan vier op een rij (team A = eerste twee,
-- team B = laatste twee). Zelfde vorm als generate_americano_round, maar met de
-- door FairTeams gekozen vaste teams.
-- p_played_at is het (optionele) starttijdstip van de ronde (#827): bij een
-- gelockte speeldag-poll is dat de echte starttijd, anders null zoals voorheen.
-- p_created_by is er enkel voor de cron (poll-deadline): die draait met de
-- service-role en heeft dus geen auth.uid(). Voor een ingelogde gebruiker wint
-- auth.uid() altijd, dus de parameter is niet te misbruiken om een match op
-- naam van iemand anders te zetten.
create or replace function public.create_fair_round(
  p_group_id uuid,
  p_players uuid[],
  p_played_at timestamptz default null,
  p_created_by uuid default null
)
returns setof uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := coalesce((select auth.uid()), p_created_by);
  v_round smallint;
  v_n int := coalesce(array_length(p_players, 1), 0);
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
  if v_n < 4 or v_n % 4 <> 0 then
    raise exception 'Aantal spelers moet een veelvoud van 4 zijn (nu %).', v_n;
  end if;

  if exists (
    select 1 from unnest(p_players) as pid
    where not public.is_group_member(p_group_id, pid)
  ) then
    raise exception 'Alle spelers moeten lid zijn van deze groep';
  end if;

  -- Ronde-nummer binnen déze speeldag (#1271). Het was max+1 over de hele
  -- groep, dus de tiende speeldag begon bij "Ronde 37" — en de app moest met
  -- guards voorkomen dat er "ronde 4 van 3" kwam te staan. De dag komt uit het
  -- starttijdstip van de ronde zelf, in clubtijd; zonder tijdstip uit nu.
  --
  -- Dit is een benadering van de regel die de app hanteert (#1221: de match
  -- hoort bij het dichtstbijzijnde moment, met een uur voorsprong). Voor een
  -- sessie die over middernacht heen loopt kan de nummering dus opnieuw
  -- beginnen. Dat is zichtbaar en onschuldig; een poll_id op matches is er niet.
  select coalesce(max(round_number), 0) + 1 into v_round
  from public.matches
  where group_id = p_group_id
    and (coalesce(played_at, created_at) at time zone 'Europe/Brussels')::date
        = (coalesce(p_played_at, now()) at time zone 'Europe/Brussels')::date;

  v_i := 1;
  while v_i + 3 <= v_n loop
    if p_players[v_i] in (p_players[v_i + 1], p_players[v_i + 2], p_players[v_i + 3])
       or p_players[v_i + 1] in (p_players[v_i + 2], p_players[v_i + 3])
       or p_players[v_i + 2] = p_players[v_i + 3] then
      raise exception 'De vier spelers per baan moeten verschillend zijn';
    end if;

    v_team_a := public._ensure_team(p_players[v_i], p_players[v_i + 1]);
    v_team_b := public._ensure_team(p_players[v_i + 2], p_players[v_i + 3]);

    insert into public.matches (team_a_id, team_b_id, status, group_id, round_number, created_by, played_at)
    values (v_team_a, v_team_b, 'scheduled', p_group_id, v_round, v_uid, p_played_at)
    returning id into v_match_id;

    return next v_match_id;
    v_i := v_i + 4;
  end loop;

  return;
end;
$$;

grant execute on function public.create_fair_round(uuid, uuid[], timestamptz, uuid) to authenticated;
