-- Per match een gast vervangen (#681, deel 2). Eén gastprofiel wordt in de
-- praktijk soms voor verschillende personen hergebruikt ("Gast 1"), en soms
-- blijkt achteraf dat de gast eigenlijk een speler mét account was. Dan wil je
-- per match kunnen corrigeren wie er écht speelde.
--
-- Anders dan claim_guest_player (27_guest_claims.sql) muteert dit de team-rij
-- NIET: teams worden gedeeld tussen matches, dus een team ter plekke omhangen
-- zou andere matches meeslepen. In plaats daarvan wijst déze match naar het
-- team van het nieuwe paar (_ensure_team). De statement-level triggers op
-- public.matches herberekenen daarna alle afgeleide data — ratings, pias,
-- Zwarte Piet, rangstand, dictator-termijnen — precies één keer.
--
-- Bewust niet beperkt tot afgeronde matches: dezelfde correctie is op een
-- geplande match even zinnig. De UI biedt 'm bij een afgeronde match aan, waar
-- de ronde-generator geen uitweg meer is.
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
  m record;
  v_old_team uuid;
  v_kant text;      -- 'a' of 'b': in welk team van de match zat de gast
  v_partner uuid;   -- de medespeler die blijft staan (null bij singles)
  v_new_team uuid;
begin
  if v_uid is null then
    raise exception 'Niet ingelogd';
  end if;
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

  -- Zelfde kring als delete_match: de aanmaker of de eigenaar van de groep.
  if m.created_by is distinct from v_uid
     and not (m.group_id is not null and public.is_group_owner(m.group_id, v_uid)) then
    raise exception 'Alleen de aanmaker of de groepseigenaar kan een gast vervangen';
  end if;

  -- Alleen gasten zijn vervangbaar: de historie van een echt account herschrijf
  -- je niet buiten die persoon om — daarvoor is het koppelverzoek (#681 deel 1).
  if not exists (
    select 1 from public.profiles where id = p_from_player and is_guest
  ) then
    raise exception 'Alleen een gastspeler kan vervangen worden';
  end if;

  if not exists (select 1 from public.profiles where id = p_to_player) then
    raise exception 'Speler niet gevonden';
  end if;

  -- Dezelfde toegangscheck als bij het loggen van een match: jezelf, een
  -- vriend, je eigen gast of een groepsgenoot.
  if not public._can_add_player(v_uid, p_to_player, m.group_id) then
    raise exception 'Je kunt alleen jezelf, een vriend, je eigen gast of een groepsgenoot invullen';
  end if;

  select case when t.id = m.team_a_id then 'a' else 'b' end,
         t.id,
         case when t.player1_id = p_from_player then t.player2_id else t.player1_id end
    into v_kant, v_old_team, v_partner
    from public.teams t
   where t.id in (m.team_a_id, m.team_b_id)
     and (t.player1_id = p_from_player or t.player2_id = p_from_player);
  if not found then
    raise exception 'Die gast speelde niet in deze match';
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
  perform public._grade_completed_match(p_match_id);
end;
$$;

grant execute on function public.replace_match_player(uuid, uuid, uuid) to authenticated;
