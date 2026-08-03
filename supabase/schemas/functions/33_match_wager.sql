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