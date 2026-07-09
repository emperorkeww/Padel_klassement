-- Leden zien de polls van hun eigen groepen.
create policy "play_polls_select_member" on public.play_polls
  for select
  using (public.is_group_member(group_id, (select auth.uid())));

-- Elk lid start een poll, op eigen naam.
create policy "play_polls_insert_member" on public.play_polls
  for insert
  with check (
    created_by = (select auth.uid())
    and public.is_group_member(group_id, (select auth.uid()))
  );

-- De maker of groepseigenaar beheert de poll (lock, geboekt, annuleren).
create policy "play_polls_update_manager" on public.play_polls
  for update
  using (
    created_by = (select auth.uid())
    or public.is_group_owner(group_id, (select auth.uid()))
  )
  with check (
    created_by = (select auth.uid())
    or public.is_group_owner(group_id, (select auth.uid()))
  );

create policy "play_polls_delete_manager" on public.play_polls
  for delete
  using (
    created_by = (select auth.uid())
    or public.is_group_owner(group_id, (select auth.uid()))
  );

-- Opties: leesbaar voor leden; alleen de poll-maker/eigenaar voegt ze toe of
-- haalt ze weg, de group_id moet echt bij de poll horen (anti-spoof), en
-- bewerken kan alleen zolang de poll open staat ("Dagen aanpassen", #128).
create policy "play_poll_options_select_member" on public.play_poll_options
  for select
  using (public.is_group_member(group_id, (select auth.uid())));

create policy "play_poll_options_insert_manager" on public.play_poll_options
  for insert
  with check (
    public.is_group_member(group_id, (select auth.uid()))
    and exists (
      select 1 from public.play_polls p
      where p.id = poll_id
        and p.group_id = play_poll_options.group_id
        and p.status = 'open'
        and (
          p.created_by = (select auth.uid())
          or public.is_group_owner(p.group_id, (select auth.uid()))
        )
    )
  );

create policy "play_poll_options_delete_manager" on public.play_poll_options
  for delete
  using (
    exists (
      select 1 from public.play_polls p
      where p.id = poll_id
        and p.status = 'open'
        and (
          p.created_by = (select auth.uid())
          or public.is_group_owner(p.group_id, (select auth.uid()))
        )
    )
  );

-- Stemmen: zichtbaar voor leden; je zet alleen je eigen stem, en alleen op
-- opties van groepen waar je lid van bent (zelfde patroon als slot_availability).
create policy "play_poll_votes_select_member" on public.play_poll_votes
  for select
  using (public.is_group_member(group_id, (select auth.uid())));

create policy "play_poll_votes_insert_own" on public.play_poll_votes
  for insert
  with check (
    player_id = (select auth.uid())
    and public.is_group_member(group_id, (select auth.uid()))
    -- group_id is gedenormaliseerd: borg dat hij echt bij de optie hoort.
    and exists (
      select 1 from public.play_poll_options o
      where o.id = option_id
        and o.group_id = play_poll_votes.group_id
    )
  );

create policy "play_poll_votes_update_own" on public.play_poll_votes
  for update
  using (player_id = (select auth.uid()))
  with check (player_id = (select auth.uid()));

create policy "play_poll_votes_delete_own" on public.play_poll_votes
  for delete
  using (player_id = (select auth.uid()));
