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
