-- #1004 Wedstrijd-inzet: drankje-traktatie. De verliezers trakteren de
-- winnaars na de pot op een drankje uit de Belgische drankkaart. Spiegel van
-- de aanpassingen aan supabase/schemas/tables/05_matches.sql en
-- supabase/schemas/functions/12_create_planned_match.sql, plus het nieuwe
-- supabase/schemas/functions/33_match_wager.sql; zie die bestanden voor de
-- volledige motivatie.
--
-- Kern: dit is een sociale inzet, geen rating-inzet. De naamgenoot
-- match_stakes (#804) verdubbelt je Elo-mutatie; hier gaat het om wie er aan
-- de bar betaalt. De Elo-kern wordt met geen enkele regel aangeraakt.

-- 1. Kolommen ---------------------------------------------------------------

-- Slug in plaats van een enum zoals court_type: de drankkaart telt 35 items en
-- groeit, en een enum zou per nieuw biertje een migratie kosten. De preset in
-- src/features/matches/drankkaart.ts is de bron van waarheid voor label en
-- icoon; een onbekende slug degradeert daar naar de slug zelf.
alter table public.matches
  add column wager_drink text,
  add column wager_drink_qty smallint not null default 1,
  add column wager_settled_at timestamptz,
  add column wager_settled_by uuid references public.profiles (id) on delete set null;

alter table public.matches
  add constraint matches_wager_drink_slug check (
    wager_drink is null or wager_drink ~ '^[a-z0-9-]{2,40}$'
  ),
  add constraint matches_wager_qty_range check (
    wager_drink_qty between 1 and 10
  ),
  -- wager_settled_by mag los leeglopen (profiel verwijderd, on delete set
  -- null); wager_settled_at blijft dan staan als "is ingelost, door wie weten
  -- we niet meer". Andersom heeft een inlosser zonder tijdstip geen betekenis.
  add constraint matches_wager_settled_needs_drink check (
    wager_settled_at is null or wager_drink is not null
  ),
  add constraint matches_wager_settled_by_needs_at check (
    wager_settled_by is null or wager_settled_at is not null
  );

-- 2. create_planned_match: inzet meteen bij het plannen -----------------------

-- Signatuurwijziging: create or replace zou een overload maken in plaats van
-- een vervanging, dus eerst de oude droppen (de rechten verdwijnen mee).
drop function if exists public.create_planned_match(
  uuid, uuid, uuid, uuid, timestamptz, uuid, jsonb, public.court_type, uuid
);

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
  p_client_token uuid default null,
  -- optionele drankje-inzet (#1004): slug uit de drankkaart + aantal per
  -- winnaar. Achteraf wijzigbaar via set_match_wager, zolang de match nog niet
  -- begonnen is.
  p_wager_drink text default null,
  p_wager_drink_qty smallint default 1
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
    court_type, client_token, wager_drink, wager_drink_qty
  )
  values (
    v_team_a, v_team_b, 'scheduled', p_played_at, v_uid, p_group_id, p_set_scores, v_format,
    p_court_type, p_client_token,
    -- Zonder drankje heeft een aantal geen betekenis; de kolom is not null, dus
    -- val terug op 1 in plaats van de check te laten struikelen over een null.
    p_wager_drink,
    case when p_wager_drink is null then 1 else coalesce(p_wager_drink_qty, 1) end
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

grant execute on function public.create_planned_match(uuid, uuid, uuid, uuid, timestamptz, uuid, jsonb, public.court_type, uuid, text, smallint) to authenticated;

-- 3. Inzet zetten en afvinken ------------------------------------------------

-- Drankje-inzet (#1004): de verliezers trakteren de winnaars. Twee RPC's —
-- de inzet zetten vóór de aftrap, en hem ná de pot aan de bar afvinken.
--
-- BEWUST RPC'S EN GEEN POLICY + KOLOM-GRANT. Kolom-grants gelden per rol, niet
-- per policy (zie de motivatie onderaan policies/matches.sql). Een policy die
-- deelnemers een afgeronde match laat bijwerken zou ze via de bestaande
-- table-grant meteen ook status, winner_team_id en de scores laten
-- overschrijven — precies wat #432 dichtgemetseld heeft. SECURITY DEFINER laat
-- exact deze vier kolommen door en niets anders.
--
-- Dit raakt de rating niet. De naamgenoot match_stakes (#804) verdubbelt je
-- Elo-mutatie; een drankje is opschepmateriaal aan de bar.

-- Wie mag aan de inzet van deze match komen: de aanmaker, een deelnemer, of de
-- eigenaar van de groep waarin de match hangt. Dezelfde kring als wie de
-- uitslag mag invullen (policies/matches.sql), plus de aanmaker.
-- Losse kolommen en geen record-parameter: plpgsql/sql-functies accepteren
-- geen argument van het pseudotype record.
create or replace function public._can_manage_wager(
  p_created_by uuid,
  p_group_id uuid,
  p_team_a uuid,
  p_team_b uuid,
  p_uid uuid
)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select p_uid is not null and (
    p_created_by = p_uid
    or public.is_team_member(p_team_a, p_uid)
    or public.is_team_member(p_team_b, p_uid)
    or (p_group_id is not null and public.is_group_owner(p_group_id, p_uid))
  );
$$;

revoke execute on function public._can_manage_wager(uuid, uuid, uuid, uuid, uuid) from public;

-- Zet of wist de drankje-inzet van een geplande match. Nodig náást de
-- parameter op create_planned_match, omdat gegenereerde rondes (americano,
-- mexicano, fair round) buiten de wizard om ontstaan en dus nooit langs die
-- parameter komen.
create or replace function public.set_match_wager(
  p_match_id uuid,
  p_drink text,
  p_qty smallint default 1
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  m record;
begin
  if v_uid is null then
    raise exception 'Niet ingelogd';
  end if;

  select id, created_by, group_id, team_a_id, team_b_id, status, played_at
    into m
    from public.matches
    where id = p_match_id;

  if not found then
    raise exception 'Match niet gevonden';
  end if;
  if not public._can_manage_wager(m.created_by, m.group_id, m.team_a_id, m.team_b_id, v_uid) then
    raise exception 'Alleen de spelers, de aanmaker of de groepseigenaar kunnen de inzet bepalen';
  end if;
  -- Na de eerste bal ligt de inzet vast: anders kan de verliezer hem achteraf
  -- nog van een Westmalle Tripel naar een plat water draaien.
  if m.status <> 'scheduled' then
    raise exception 'De match is al begonnen of afgerond: de inzet ligt vast';
  end if;
  if m.played_at is not null and m.played_at <= now() then
    raise exception 'De match is al begonnen: de inzet ligt vast';
  end if;
  -- De check-constraint op de kolom vangt dit ook af, maar dan als kale
  -- Postgres-tekst; hier wordt het een zin.
  if p_drink is not null and p_drink !~ '^[a-z0-9-]{2,40}$' then
    raise exception 'Onbekend drankje';
  end if;
  if p_drink is not null and coalesce(p_qty, 1) not between 1 and 10 then
    raise exception 'Kies tussen 1 en 10 consumpties per winnaar';
  end if;

  update public.matches
     set wager_drink = p_drink,
         wager_drink_qty = case when p_drink is null then 1 else coalesce(p_qty, 1) end,
         -- Inzet weg = de inlossing die erbij hoorde is ook weg. Kan alleen op
         -- een geplande match, dus in de praktijk stond er nog niets.
         wager_settled_at = case when p_drink is null then null else wager_settled_at end,
         wager_settled_by = case when p_drink is null then null else wager_settled_by end
   where id = p_match_id;
end;
$$;

grant execute on function public.set_match_wager(uuid, text, smallint) to authenticated;

-- Vink de traktatie af (of terug). Kan pas als de match afgerond is en er een
-- winnaar is: bij gelijkspel vervalt de inzet, dan valt er niets te schenken.
create or replace function public.settle_match_wager(
  p_match_id uuid,
  p_settled boolean default true
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  m record;
begin
  if v_uid is null then
    raise exception 'Niet ingelogd';
  end if;

  select id, created_by, group_id, team_a_id, team_b_id, status,
         winner_team_id, wager_drink
    into m
    from public.matches
    where id = p_match_id;

  if not found then
    raise exception 'Match niet gevonden';
  end if;
  if not public._can_manage_wager(m.created_by, m.group_id, m.team_a_id, m.team_b_id, v_uid) then
    raise exception 'Alleen de spelers, de aanmaker of de groepseigenaar kunnen de traktatie afvinken';
  end if;
  if m.wager_drink is null then
    raise exception 'Er staat geen drankje op deze match';
  end if;
  if m.status <> 'completed' then
    raise exception 'De match is nog niet afgerond';
  end if;
  if m.winner_team_id is null then
    raise exception 'Gelijkspel: de inzet vervalt';
  end if;

  update public.matches
     set wager_settled_at = case when p_settled then now() else null end,
         wager_settled_by = case when p_settled then v_uid else null end
   where id = p_match_id;
end;
$$;

grant execute on function public.settle_match_wager(uuid, boolean) to authenticated;