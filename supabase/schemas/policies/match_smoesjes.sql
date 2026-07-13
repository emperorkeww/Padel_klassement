-- Smoesjes (#296): zichtbaar voor groepsleden; je plaatst alleen je eigen smoes,
-- en alleen in groepen waar je lid van bent (zelfde patroon als
-- match_predictions). Dat de smoes echt bij een verloren groepsmatch hoort borgt
-- de guard-trigger (match_smoesjes_guard).
create policy "match_smoesjes_select_member" on public.match_smoesjes
  for select
  using (public.is_group_member(group_id, (select auth.uid())));

create policy "match_smoesjes_insert_own" on public.match_smoesjes
  for insert
  with check (
    player_id = (select auth.uid())
    and public.is_group_member(group_id, (select auth.uid()))
  );

create policy "match_smoesjes_update_own" on public.match_smoesjes
  for update
  using (player_id = (select auth.uid()))
  with check (player_id = (select auth.uid()));

create policy "match_smoesjes_delete_own" on public.match_smoesjes
  for delete
  using (player_id = (select auth.uid()));

-- Kolomprivileges: updated_at wordt uitsluitend serverside gezet (guard-trigger).
-- RLS kan geen kolommen beschermen, dus insert/update voor authenticated is
-- beperkt tot de payloadkolommen. De update-grant bevat alle upsert-payload-
-- kolommen omdat PostgREST-upsert "on conflict do update set <payload>" doet.
revoke insert, update on public.match_smoesjes from authenticated;
grant insert (match_id, player_id, group_id, smoes),
      update (match_id, player_id, group_id, smoes)
  on public.match_smoesjes to authenticated;
