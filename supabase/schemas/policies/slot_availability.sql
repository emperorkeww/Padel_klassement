-- Leden zien de slot-beschikbaarheid van hun eigen groepen.
create policy "slot_availability_select_member" on public.slot_availability
  for select
  using (public.is_group_member(group_id, (select auth.uid())));

-- Je zet alleen je eigen status, en alleen in groepen waar je lid van bent.
create policy "slot_availability_insert_own" on public.slot_availability
  for insert
  with check (
    player_id = (select auth.uid())
    and public.is_group_member(group_id, (select auth.uid()))
  );

create policy "slot_availability_update_own" on public.slot_availability
  for update
  using (player_id = (select auth.uid()))
  with check (player_id = (select auth.uid()));

create policy "slot_availability_delete_own" on public.slot_availability
  for delete
  using (player_id = (select auth.uid()));
