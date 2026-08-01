-- Row Level Security voor public.matches
alter table public.matches enable row level security;

-- Leesbaarheid van ruwe matchrijen (#461). De ruwe rij verraadt wie tegen wie
-- speelde (= de facto de roster) en de uitslag; die horen even privé te zijn als
-- group_members/attendance zelf. Daarom:
--   * niet-groepsmatches (group_id is null) blijven publiek;
--   * groepsmatches enkel voor leden van die groep;
--   * daarnaast altijd voor de deelnemers zelf en de aanmaker.
-- Het GLOBALE klassement lekt hierdoor niet: dat wordt als aggregaat geserveerd
-- door de SECURITY DEFINER views (player_standings/standings) en de
-- season_*_standings RPC's, die de matches-RLS bewust bypassen. Zie #461.
create policy "Matches: deelnemers, groepsleden en publiek (niet-groep)"
  on public.matches
  for select
  using (
    group_id is null
    or public.is_group_member(group_id, (select auth.uid()))
    or public.is_team_member(team_a_id, (select auth.uid()))
    or public.is_team_member(team_b_id, (select auth.uid()))
    or created_by = (select auth.uid())
  );

-- Bewust GEEN directe INSERT-policy: matches worden uitsluitend aangemaakt via
-- de SECURITY DEFINER RPC's (create_completed_match, generate_americano_round),
-- die deelnemer- en vriend-checks afdwingen. Zie migratie 20260701140000 (K1).

-- De aanmaker kan de match onbeperkt bijwerken (uitslag zetten, corrigeren,
-- tijdstip verplaatsen).
create policy "Aanmaker kan match bijwerken"
  on public.matches
  for update
  to authenticated
  using ((select auth.uid()) = created_by)
  with check ((select auth.uid()) = created_by);

-- Deelnemers (spelers in team A of B) mogen de uitslag van hun eigen match
-- invullen: alleen de overgang naar 'completed', en alleen zolang de match
-- nog niet afgerond is (#413). Corrigeren achteraf en het tijdstip wijzigen
-- (zonder statusovergang) blijven via de policy hierboven bij de aanmaker.
create policy "Deelnemer kan uitslag invullen"
  on public.matches
  for update
  to authenticated
  using (
    status <> 'completed'
    and (public.is_team_member(team_a_id, (select auth.uid()))
         or public.is_team_member(team_b_id, (select auth.uid())))
  )
  with check (
    status = 'completed'
    and (public.is_team_member(team_a_id, (select auth.uid()))
         or public.is_team_member(team_b_id, (select auth.uid())))
  );

-- De eigenaar van de groep waar de match in hangt mag de uitslag óók invullen.
-- Op een speeldag is dat de organisator: hij staat lang niet altijd zelf op de
-- baan, en de rondes worden gegenereerd (created_by = degene die op "ronde
-- maken" drukte), dus zonder deze policy kon hij geen enkele uitslag invoeren.
-- Dezelfde begrenzing als de deelnemer-policy — alleen de overgang naar
-- 'completed' op een nog niet afgeronde match; corrigeren achteraf blijft bij
-- de aanmaker. Sluit aan bij delete_match, waar de groepseigenaar al mag.
create policy "Groepseigenaar kan uitslag invullen"
  on public.matches
  for update
  to authenticated
  using (
    status <> 'completed'
    and group_id is not null
    and public.is_group_owner(group_id, (select auth.uid()))
  )
  with check (
    status = 'completed'
    and group_id is not null
    and public.is_group_owner(group_id, (select auth.uid()))
  );

-- #432: de policies hierboven werken op rij-niveau, maar de UPDATE-grant op
-- matches is table-wide (Supabase-default). Daardoor mag een deelnemer bij de
-- ene toegestane UPDATE (uitslag invullen) élke kolom meeschrijven — o.a.
-- created_by naar zichzelf zetten en zo onder de aanmaker-policy vallen, of
-- group_id/team_*/played_at manipuleren. RLS controleert alleen de rij, niet
-- welke kolommen worden geraakt.
--
-- Beperk de UPDATE-grant tot de unie van wat aanmaker, deelnemer én
-- groepseigenaar nodig hebben (kolom-grants gelden per rol, niet per policy —
-- alle drie zijn 'authenticated'):
--   setMatchResult        status, winner_team_id, score_a, score_b, set_scores, played_at
--   updateMatchScore      winner_team_id, score_a, score_b, set_scores
--   updatePlannedMatchTime played_at
-- Zo blijven created_by, group_id, team_a_id/team_b_id, round_number, format
-- en id buiten bereik. anon (geen UPDATE-policy) en service_role: ongemoeid.
-- group_id muteert uitsluitend via de RPC set_match_group (#648).
revoke update on table public.matches from authenticated;
grant update (status, winner_team_id, score_a, score_b, set_scores, played_at)
  on table public.matches to authenticated;