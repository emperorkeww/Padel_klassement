-- Feed (#138): geaccepteerde vriendschappen zijn ook zichtbaar voor
-- groepsgenoten, zodat "X en Y zijn nu vrienden" in de feed kan verschijnen.
-- Bewust smal: alleen status 'accepted' (verzoeken blijven privé), en alleen
-- wanneer béíde betrokkenen samen met de kijker in één groep zitten.
create policy "friendships_select_groupmates" on public.friendships
  for select
  to authenticated
  using (
    status = 'accepted'
    and exists (
      select 1
      from public.group_members me
      join public.group_members a
        on a.group_id = me.group_id and a.player_id = friendships.requester_id
      join public.group_members b
        on b.group_id = me.group_id and b.player_id = friendships.addressee_id
      where me.player_id = (select auth.uid())
    )
  );
