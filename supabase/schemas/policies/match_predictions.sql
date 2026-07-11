-- Tips: zichtbaar voor groepsleden; je zet alleen je eigen tip, en alleen in
-- groepen waar je lid van bent (zelfde patroon als play_poll_votes). Dat de
-- gedenormaliseerde group_id echt bij de match hoort, borgt de guard-trigger
-- (match_predictions_guard), net als de start/status-vergrendeling.
create policy "match_predictions_select_member" on public.match_predictions
  for select
  using (public.is_group_member(group_id, (select auth.uid())));

create policy "match_predictions_insert_own" on public.match_predictions
  for insert
  with check (
    player_id = (select auth.uid())
    and public.is_group_member(group_id, (select auth.uid()))
  );

create policy "match_predictions_update_own" on public.match_predictions
  for update
  using (player_id = (select auth.uid()))
  with check (player_id = (select auth.uid()));

create policy "match_predictions_delete_own" on public.match_predictions
  for delete
  using (player_id = (select auth.uid()));

-- Kolomprivileges: win_chance en points worden uitsluitend serverside gezet
-- (guard- en grade-triggers, SECURITY DEFINER). RLS kan geen kolommen
-- beschermen, dus insert/update voor authenticated is beperkt tot de
-- tip-kolommen. De update-grant bevat alle upsert-payloadkolommen omdat
-- PostgREST-upsert "on conflict do update set <payload>" doet.
revoke insert, update on public.match_predictions from authenticated;
grant insert (match_id, player_id, group_id, predicted_team_id),
      update (match_id, player_id, group_id, predicted_team_id)
  on public.match_predictions to authenticated;
