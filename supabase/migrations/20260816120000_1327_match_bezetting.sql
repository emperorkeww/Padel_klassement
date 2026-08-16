-- Spelers wijzigen in een wedstrijd die al klaarstaat (#1327).
--
-- Twee schema-bestanden in één migratie: 28_replace_match_player.sql (het
-- vervangen, nu ook van een echt account en met de verruimde kring) en het
-- nieuwe 46_match_bezetting.sql (de gedeelde poort, het ruilen en de twee
-- beheerdersingangen). Met de hand geschreven: `db diff` struikelt op deze
-- branch over bestaande schema-drift in public.profiles.

-- Per match één speler vervangen (#681 deel 2, verruimd in #1327).
--
-- Oorspronkelijk alleen voor gasten: één gastprofiel wordt in de praktijk soms
-- voor verschillende personen hergebruikt ("Gast 1"), en soms blijkt achteraf
-- dat de gast eigenlijk een speler mét account was. Sinds #1327 vervangt deze
-- functie iedereen — ook een echt account — omdat een ronde die al klaarstaat
-- anders alleen te repareren viel door hem te slopen: was er niets aan de hand
-- met de indeling behalve dat er iemand afzegde, dan moest elke match los weg
-- en kwam de nieuwe ronde onderaan het rijtje terug (#1271 §2.7/§2.8).
--
-- Wie mag dat, staat niet meer hier maar in `_mag_bezetting_wijzigen`
-- (46_match_bezetting.sql), gedeeld met `ruil_match_spelers`. Kort: op een
-- gepláánde match mag de hele kring die erbij betrokken is (spelers,
-- groepsleden, aanmaker, groepseigenaar), op een afgeronde alleen de aanmaker
-- en de groepseigenaar — daar herschrijf je immers de Elo-geschiedenis van vier
-- mensen, en dat is wat anders dan een afspraak verzetten.
--
-- Anders dan claim_guest_player (27_guest_claims.sql) muteert dit de team-rij
-- NIET: teams worden gedeeld tussen matches, dus een team ter plekke omhangen
-- zou andere matches meeslepen. In plaats daarvan wijst déze match naar het
-- team van het nieuwe paar (_ensure_team). De statement-level triggers op
-- public.matches herberekenen daarna alle afgeleide data — ratings, pias,
-- Zwarte Piet, rangstand, dictator-termijnen — precies één keer.

-- De mutatie zelf, zonder poort. Gedeeld door de publieke RPC hieronder (die de
-- kring afdwingt) en `admin_vervang_match_speler` (46_match_bezetting.sql), die
-- namens de beheerder werkt en zijn spoor in admin_audit_log achterlaat.
create or replace function public._vervang_uitvoeren(
  p_match_id uuid,
  p_from_player uuid,
  p_to_player uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  m record;
  v_old_team uuid;
  v_kant text;      -- 'a' of 'b': in welk team van de match zat de speler
  v_partner uuid;   -- de medespeler die blijft staan (null bij singles)
  v_new_team uuid;
begin
  if p_from_player = p_to_player then
    return;
  end if;

  select id, group_id, created_by, team_a_id, team_b_id
    into m
    from public.matches
    where id = p_match_id
    for update;
  if not found then
    raise exception 'Match niet gevonden';
  end if;

  if not exists (select 1 from public.profiles where id = p_to_player) then
    raise exception 'Speler niet gevonden';
  end if;

  select case when t.id = m.team_a_id then 'a' else 'b' end,
         t.id,
         case when t.player1_id = p_from_player then t.player2_id else t.player1_id end
    into v_kant, v_old_team, v_partner
    from public.teams t
   where t.id in (m.team_a_id, m.team_b_id)
     and (t.player1_id = p_from_player or t.player2_id = p_from_player);
  if not found then
    raise exception 'Die speler speelde niet in deze match';
  end if;

  -- Staat de vervanger al in de match, dan wordt die onzinnig: dezelfde speler
  -- twee keer in een team (teams_distinct_players) of twee gelijke teams
  -- (matches_distinct_teams).
  if exists (
    select 1 from public.teams t
    where t.id in (m.team_a_id, m.team_b_id)
      and (t.player1_id = p_to_player or t.player2_id = p_to_player)
  ) then
    raise exception 'Die speler staat al in deze match';
  end if;

  v_new_team := public._ensure_team(p_to_player, v_partner);

  update public.matches
     set team_a_id = case when v_kant = 'a' then v_new_team else team_a_id end,
         team_b_id = case when v_kant = 'b' then v_new_team else team_b_id end,
         winner_team_id = case when winner_team_id = v_old_team
                               then v_new_team else winner_team_id end
   where id = p_match_id;

  -- Verwijzingen naar het oude team binnen déze match volgen mee. Het team zelf
  -- blijft bestaan: andere matches kunnen er nog naar wijzen, en _ensure_team
  -- vindt 'm later gewoon terug.
  update public.match_points
     set won_by_team_id = v_new_team
   where match_id = p_match_id and won_by_team_id = v_old_team;

  update public.match_predictions
     set predicted_team_id = v_new_team
   where match_id = p_match_id and predicted_team_id = v_old_team;

  -- De afrondingstrigger scoorde tijdens de UPDATE hierboven nog met de oude
  -- tip-verwijzing, waardoor een juiste tip op 'mis' zou blijven staan. Nu de
  -- tips kloppen opnieuw laten beoordelen (zelfde reden als in de merge).
  -- Op een geplande match is dit een no-op: `_grade_completed_match` eist
  -- status = 'completed'.
  perform public._grade_completed_match(p_match_id);
end;
$$;

revoke execute on function public._vervang_uitvoeren(uuid, uuid, uuid) from public;

create or replace function public.replace_match_player(
  p_match_id uuid,
  p_from_player uuid,
  p_to_player uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_status public.match_status;
  v_group uuid;
begin
  if v_uid is null then
    raise exception 'Niet ingelogd';
  end if;

  select status, group_id into v_status, v_group
    from public.matches where id = p_match_id;
  if not found then
    raise exception 'Match niet gevonden';
  end if;

  if not public._mag_bezetting_wijzigen(v_uid, p_match_id) then
    raise exception '%', public._bezetting_weigering(v_status);
  end if;

  -- Dezelfde toegangscheck als bij het loggen van een match: jezelf, een
  -- vriend, je eigen gast of een groepsgenoot. De beheerdersingang slaat deze
  -- bewust over — die vult namens iemand anders in.
  if not public._can_add_player(v_uid, p_to_player, v_group) then
    raise exception 'Je kunt alleen jezelf, een vriend, je eigen gast of een groepsgenoot invullen';
  end if;

  perform public._vervang_uitvoeren(p_match_id, p_from_player, p_to_player);
end;
$$;

grant execute on function public.replace_match_player(uuid, uuid, uuid) to authenticated;

-- De bezetting van een wedstrijd wijzigen (#1327).
--
-- Zodra de rondes van een speeldag klaarstonden lag de opstelling vast. Zegde
-- er iemand af, of bleek de indeling scheef, dan was de enige weg terug: elke
-- match los verwijderen en een nieuwe ronde bijmaken — die dan een hoger
-- rondenummer kreeg en onderaan het rijtje belandde (#1271 §2.7/§2.8).
--
-- Drie handelingen dekken alles wat je op de baan wil kunnen rechtzetten:
--
--   1. vervangen         — iemand eruit, iemand anders erin
--                          (replace_match_player, 28_replace_match_player.sql)
--   2. van team wisselen — twee spelers binnen dezelfde match omdraaien
--   3. ruilen met een andere baan — twee spelers uit twee matches omruilen
--
-- 2 en 3 zijn dezelfde beweging: A gaat naar de plek van B en omgekeerd. Ze
-- delen daarom één RPC, `ruil_match_spelers`; is p_match_a gelijk aan
-- p_match_b, dan is het handeling 2.

-- ---------------------------------------------------------------------------
-- De poort, gedeeld door alle drie de handelingen.
-- ---------------------------------------------------------------------------
--
-- Op een gepláánde match mag de hele kring die erbij betrokken is: de spelers
-- zelf, de leden van de groep, de aanmaker en de groepseigenaar. Je verplaatst
-- dan een afspraak, en wie op de baan staat weet het beste wie er komt opdagen.
--
-- Op een afgeronde match blijft het bij de aanmaker en de groepseigenaar —
-- dezelfde kring die de uitslag mag corrigeren en de match mag verwijderen.
-- Daar herschrijf je namelijk de Elo-geschiedenis van vier mensen, en dat is
-- wat anders dan een afspraak verzetten.
--
-- Een match zónder groep (losse partij) heeft geen groepsleden; dan blijft de
-- kring vanzelf bij de deelnemers en de aanmaker.
create or replace function public._mag_bezetting_wijzigen(
  p_uid uuid,
  p_match_id uuid
)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select coalesce(
    case
      when m.status = 'completed' then
        m.created_by = p_uid
        or (m.group_id is not null and public.is_group_owner(m.group_id, p_uid))
      else
        m.created_by = p_uid
        or (m.group_id is not null and public.is_group_owner(m.group_id, p_uid))
        or public.is_team_member(m.team_a_id, p_uid)
        or public.is_team_member(m.team_b_id, p_uid)
        or (m.group_id is not null and public.is_group_member(m.group_id, p_uid))
    end,
    false)
  from public.matches m
  where m.id = p_match_id;
$$;

revoke execute on function public._mag_bezetting_wijzigen(uuid, uuid) from public;

-- Eén tekst per status, zodat de drie RPC's hetzelfde zeggen en de gebruiker
-- aan de melding kan zien wélke grens hij raakte.
create or replace function public._bezetting_weigering(p_status public.match_status)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when p_status = 'completed'
    then 'Een afgeronde wedstrijd herbezet alleen de aanmaker of de groepseigenaar'
    else 'Alleen de spelers, de groepsleden, de aanmaker of de groepseigenaar kunnen de bezetting wijzigen'
  end;
$$;

revoke execute on function public._bezetting_weigering(public.match_status) from public;

-- ---------------------------------------------------------------------------
-- Ruilen: de mutatie, zonder poort.
-- ---------------------------------------------------------------------------
--
-- Net als bij het vervangen blijven de team-rijen zelf ongemoeid: teams worden
-- gedeeld tussen matches, dus een team ter plekke omhangen zou andere matches
-- meeslepen. De matches gaan naar het team van het nieuwe paar (_ensure_team).
--
-- De twee matches worden in één UPDATE bijgewerkt. Dat is geen stijlkeuze: de
-- triggers op public.matches zijn statement-level en herberekenen de hele
-- Elo-keten met alles wat eruit volgt. Twee losse updates zouden dat werk twee
-- keer doen.
create or replace function public._ruil_uitvoeren(
  p_match_a uuid,
  p_speler_a uuid,
  p_match_b uuid,
  p_speler_b uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ma record;
  mb record;
  v_kant_a text;     -- 'a' of 'b': aan welke kant van match A speelt speler A
  v_oud_team_a uuid;
  v_partner_a uuid;  -- blijft staan (null bij singles)
  v_kant_b text;
  v_oud_team_b uuid;
  v_partner_b uuid;
  v_nieuw_a uuid;    -- het team dat de plek van speler A overneemt
  v_nieuw_b uuid;
  -- De nieuwe kanten per match, apart uitgerekend zodat de UPDATE hieronder
  -- één statement blijft — ook als beide spelers in dezelfde match zitten en
  -- er dus twee kanten van één rij wijzigen.
  v_a_team_a uuid;
  v_a_team_b uuid;
  v_b_team_a uuid;
  v_b_team_b uuid;
begin
  if p_speler_a = p_speler_b then
    raise exception 'Kies twee verschillende spelers';
  end if;

  -- Beide rijen in dezelfde (id-)volgorde vergrendelen, zodat twee gelijktijdige
  -- ruils elkaar niet in een deadlock vastzetten.
  perform 1 from public.matches
   where id in (p_match_a, p_match_b) order by id for update;

  select id, group_id, status, team_a_id, team_b_id
    into ma from public.matches where id = p_match_a;
  if not found then
    raise exception 'Match niet gevonden';
  end if;

  if p_match_b = p_match_a then
    mb := ma;
  else
    select id, group_id, status, team_a_id, team_b_id
      into mb from public.matches where id = p_match_b;
    if not found then
      raise exception 'Match niet gevonden';
    end if;
    -- Ruilen blijft binnen één groep: een speler die naar een vreemde groep
    -- verhuist zou daar in een klassement belanden waar hij niet in zit.
    if ma.group_id is distinct from mb.group_id then
      raise exception 'Ruilen kan alleen tussen wedstrijden van dezelfde groep';
    end if;
  end if;

  select case when t.id = ma.team_a_id then 'a' else 'b' end,
         t.id,
         case when t.player1_id = p_speler_a then t.player2_id else t.player1_id end
    into v_kant_a, v_oud_team_a, v_partner_a
    from public.teams t
   where t.id in (ma.team_a_id, ma.team_b_id)
     and (t.player1_id = p_speler_a or t.player2_id = p_speler_a);
  if not found then
    raise exception 'Die speler speelt niet in deze wedstrijd';
  end if;

  select case when t.id = mb.team_a_id then 'a' else 'b' end,
         t.id,
         case when t.player1_id = p_speler_b then t.player2_id else t.player1_id end
    into v_kant_b, v_oud_team_b, v_partner_b
    from public.teams t
   where t.id in (mb.team_a_id, mb.team_b_id)
     and (t.player1_id = p_speler_b or t.player2_id = p_speler_b);
  if not found then
    raise exception 'Die speler speelt niet in de andere wedstrijd';
  end if;

  if p_match_a = p_match_b then
    if v_kant_a = v_kant_b then
      raise exception 'Die twee spelers staan al in hetzelfde team';
    end if;
  else
    if exists (
      select 1 from public.teams t
      where t.id in (mb.team_a_id, mb.team_b_id)
        and (t.player1_id = p_speler_a or t.player2_id = p_speler_a)
    ) then
      raise exception 'Die speler staat al in de andere wedstrijd';
    end if;
    if exists (
      select 1 from public.teams t
      where t.id in (ma.team_a_id, ma.team_b_id)
        and (t.player1_id = p_speler_b or t.player2_id = p_speler_b)
    ) then
      raise exception 'Die speler staat al in deze wedstrijd';
    end if;
  end if;

  -- Ieder neemt de plek van de ander in, náást de partner die blijft staan.
  v_nieuw_a := public._ensure_team(p_speler_b, v_partner_a);
  v_nieuw_b := public._ensure_team(p_speler_a, v_partner_b);

  v_a_team_a := case when v_kant_a = 'a' then v_nieuw_a else ma.team_a_id end;
  v_a_team_b := case when v_kant_a = 'b' then v_nieuw_a else ma.team_b_id end;
  v_b_team_a := case when v_kant_b = 'a' then v_nieuw_b else mb.team_a_id end;
  v_b_team_b := case when v_kant_b = 'b' then v_nieuw_b else mb.team_b_id end;

  -- Zelfde match: beide kanten wijzigen, dus de tweede kant erbij in dezelfde rij.
  if p_match_a = p_match_b then
    if v_kant_a = 'a' then
      v_a_team_b := v_nieuw_b;
    else
      v_a_team_a := v_nieuw_b;
    end if;
  end if;

  update public.matches m
     set team_a_id = n.team_a,
         team_b_id = n.team_b,
         -- m.team_a_id/m.team_b_id zijn hier nog de oude waarden.
         winner_team_id = case
           when m.winner_team_id = m.team_a_id then n.team_a
           when m.winner_team_id = m.team_b_id then n.team_b
           else m.winner_team_id
         end
    from (
      select p_match_a as id, v_a_team_a as team_a, v_a_team_b as team_b
      union all
      select p_match_b, v_b_team_a, v_b_team_b where p_match_b <> p_match_a
    ) n
   where m.id = n.id;

  -- Verwijzingen naar de oude teams binnen déze matches volgen mee. De teams
  -- zelf blijven bestaan; andere matches kunnen er nog naar wijzen.
  update public.match_points p
     set won_by_team_id = n.nieuw
    from (
      select p_match_a as mid, v_oud_team_a as oud, v_nieuw_a as nieuw
      union all
      select p_match_b, v_oud_team_b, v_nieuw_b
    ) n
   where p.match_id = n.mid and p.won_by_team_id = n.oud;

  update public.match_predictions t
     set predicted_team_id = n.nieuw
    from (
      select p_match_a as mid, v_oud_team_a as oud, v_nieuw_a as nieuw
      union all
      select p_match_b, v_oud_team_b, v_nieuw_b
    ) n
   where t.match_id = n.mid and t.predicted_team_id = n.oud;

  -- De tips opnieuw laten scoren nu ze naar de juiste teams wijzen; op een
  -- geplande match is dit een no-op (zie _grade_completed_match).
  perform public._grade_completed_match(p_match_a);
  if p_match_b <> p_match_a then
    perform public._grade_completed_match(p_match_b);
  end if;
end;
$$;

revoke execute on function public._ruil_uitvoeren(uuid, uuid, uuid, uuid) from public;

-- ---------------------------------------------------------------------------
-- Ruilen: de publieke ingang.
-- ---------------------------------------------------------------------------
create or replace function public.ruil_match_spelers(
  p_match_a uuid,
  p_speler_a uuid,
  p_match_b uuid,
  p_speler_b uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_status_a public.match_status;
  v_status_b public.match_status;
begin
  if v_uid is null then
    raise exception 'Niet ingelogd';
  end if;

  select status into v_status_a from public.matches where id = p_match_a;
  if not found then
    raise exception 'Match niet gevonden';
  end if;
  select status into v_status_b from public.matches where id = p_match_b;
  if not found then
    raise exception 'Match niet gevonden';
  end if;

  -- Beide kanten van de ruil apart getoetst: wie op de ene baan staat heeft
  -- daarmee nog niets te zeggen over de andere. Bij een groepsronde loopt dat
  -- meestal op hetzelfde uit, maar de regel hoort niet van dat toeval af te
  -- hangen.
  if not public._mag_bezetting_wijzigen(v_uid, p_match_a) then
    raise exception '%', public._bezetting_weigering(v_status_a);
  end if;
  if not public._mag_bezetting_wijzigen(v_uid, p_match_b) then
    raise exception '%', public._bezetting_weigering(v_status_b);
  end if;

  perform public._ruil_uitvoeren(p_match_a, p_speler_a, p_match_b, p_speler_b);
end;
$$;

grant execute on function public.ruil_match_spelers(uuid, uuid, uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- De beheerdersingangen (#1159-patroon).
-- ---------------------------------------------------------------------------
--
-- Service-role-only, exact zoals 40_admin_inhoud.sql: de client praat met de
-- edge function `admin-content`, die de beheerdersrol verifieert en de auditrij
-- schrijft. Een `is_app_admin`-tak in de RPC's hierboven zou de beheerder geen
-- kwaad doen, maar de ruimere select-policy die daarbij hoort wél: die geeft
-- hem alle vreemde groepen in zijn eigen feed en kwartaalstand.
--
-- Ze slaan de kring én `_can_add_player` over: de beheerder grijpt per definitie
-- in bij groepen waar hij niet in zit.
create or replace function public.admin_vervang_match_speler(
  p_match_id uuid,
  p_from_player uuid,
  p_to_player uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public._vervang_uitvoeren(p_match_id, p_from_player, p_to_player);
end;
$$;

revoke execute on function public.admin_vervang_match_speler(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.admin_vervang_match_speler(uuid, uuid, uuid) to service_role;

create or replace function public.admin_ruil_match_spelers(
  p_match_a uuid,
  p_speler_a uuid,
  p_match_b uuid,
  p_speler_b uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public._ruil_uitvoeren(p_match_a, p_speler_a, p_match_b, p_speler_b);
end;
$$;

revoke execute on function public.admin_ruil_match_spelers(uuid, uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.admin_ruil_match_spelers(uuid, uuid, uuid, uuid) to service_role;
