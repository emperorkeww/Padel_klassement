-- Jokers (#1003): zichtbaar voor groepsleden; je speelt alleen je eigen kaart
-- uit, en alleen in groepen waar je lid van bent (zelfde patroon als
-- match_stakes). Dat de gedenormaliseerde group_id echt bij de match hoort, dat
-- je zelf meespeelt, dat je rating ingelopen is en dat de match nog niet
-- begonnen is, borgt de guard-trigger (match_jokers_guard).
--
-- Zichtbaar voor de hele groep, ook vóór de aftrap: het verbergen van een
-- gespeelde joker tot de eerste bal is een keuze van de client (#981-patroon,
-- zie jokers.ts), niet van RLS. Een rij verbergen zou de speler zelf zijn eigen
-- tegoed niet kunnen laten zien, en wissel_van_kant moet juist meteen bekend
-- zijn — anders staat het halve veld verkeerd.
create policy "match_jokers_select_member" on public.match_jokers
  for select
  using (public.is_group_member(group_id, (select auth.uid())));

create policy "match_jokers_insert_own" on public.match_jokers
  for insert
  with check (
    player_id = (select auth.uid())
    and public.is_group_member(group_id, (select auth.uid()))
  );

-- Bewust geen update-policy: van kaart wisselen is intrekken en opnieuw
-- spelen. Een update zou de guard-trigger dwingen om ook het maandtegoed van
-- de óude rij na te lopen, zonder dat er iets mee gewonnen wordt.
create policy "match_jokers_delete_own" on public.match_jokers
  for delete
  using (player_id = (select auth.uid()));

-- Kolomprivileges: period_month wordt uitsluitend serverside gezet (de guard,
-- SECURITY DEFINER) en draagt het maandtegoed. RLS kan geen kolommen
-- beschermen, dus de insert voor authenticated is beperkt tot de eigen
-- sleutelkolommen plus de gekozen kaart. Geen update-grant — er is ook geen
-- update-policy.
revoke insert, update on public.match_jokers from authenticated;
grant insert (match_id, player_id, group_id, joker) on public.match_jokers to authenticated;
