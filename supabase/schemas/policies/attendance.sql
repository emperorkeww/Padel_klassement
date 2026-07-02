-- Leden zien de aanwezigheid van hun eigen groepen.
create policy "attendance_select_member" on public.attendance
  for select
  using (public.is_group_member(group_id, (select auth.uid())));

-- Je zet alleen je eigen status, en alleen in groepen waar je lid van bent.
create policy "attendance_insert_own" on public.attendance
  for insert
  with check (
    player_id = (select auth.uid())
    and public.is_group_member(group_id, (select auth.uid()))
  );

create policy "attendance_update_own" on public.attendance
  for update
  using (player_id = (select auth.uid()))
  with check (player_id = (select auth.uid()));

create policy "attendance_delete_own" on public.attendance
  for delete
  using (player_id = (select auth.uid()));
