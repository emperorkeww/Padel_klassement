-- Lef-tips (#804): zichtbaar voor groepsleden; je plaatst alleen je eigen
-- inzet, en alleen in groepen waar je lid van bent (zelfde patroon als
-- match_predictions). Dat de gedenormaliseerde group_id echt bij de match
-- hoort, dat je zelf meespeelt en dat je rating ingelopen is, borgt de
-- guard-trigger (match_stakes_guard), net als de start/status-vergrendeling.
create policy "match_stakes_select_member" on public.match_stakes
  for select
  using (public.is_group_member(group_id, (select auth.uid())));

create policy "match_stakes_insert_own" on public.match_stakes
  for insert
  with check (
    player_id = (select auth.uid())
    and public.is_group_member(group_id, (select auth.uid()))
  );

-- Bewust geen update-policy: aan een inzet valt niets te wijzigen. Je plaatst
-- hem of je trekt hem in.
create policy "match_stakes_delete_own" on public.match_stakes
  for delete
  using (player_id = (select auth.uid()));

-- Kolomprivileges: play_date wordt uitsluitend serverside gezet (de guard,
-- SECURITY DEFINER) en draagt het lef-tegoed. RLS kan geen kolommen
-- beschermen, dus de insert voor authenticated is beperkt tot de eigen
-- sleutelkolommen. Geen update-grant — er is ook geen update-policy.
revoke insert, update on public.match_stakes from authenticated;
grant insert (match_id, player_id, group_id) on public.match_stakes to authenticated;
