-- Leden zien de speelvoorstellen van hun eigen groepen.
create policy "play_proposals_select_member" on public.play_proposals
  for select
  using (public.is_group_member(group_id, (select auth.uid())));

-- Een lid doet voorstellen op eigen naam, alleen in eigen groepen.
create policy "play_proposals_insert_member" on public.play_proposals
  for insert
  with check (
    created_by = (select auth.uid())
    and public.is_group_member(group_id, (select auth.uid()))
  );

-- De indiener of de groepseigenaar trekt een voorstel in.
create policy "play_proposals_delete_own" on public.play_proposals
  for delete
  using (
    created_by = (select auth.uid())
    or public.is_group_owner(group_id, (select auth.uid()))
  );

-- Reacties: zichtbaar voor leden; je zet alleen je eigen reactie, en alleen
-- in groepen waar je lid van bent (zelfde patroon als slot_availability).
create policy "play_proposal_votes_select_member" on public.play_proposal_votes
  for select
  using (public.is_group_member(group_id, (select auth.uid())));

create policy "play_proposal_votes_insert_own" on public.play_proposal_votes
  for insert
  with check (
    player_id = (select auth.uid())
    and public.is_group_member(group_id, (select auth.uid()))
    -- group_id is gedenormaliseerd: borg dat hij echt bij het voorstel hoort.
    and exists (
      select 1 from public.play_proposals p
      where p.id = proposal_id
        and p.group_id = play_proposal_votes.group_id
    )
  );

create policy "play_proposal_votes_update_own" on public.play_proposal_votes
  for update
  using (player_id = (select auth.uid()))
  with check (player_id = (select auth.uid()));

create policy "play_proposal_votes_delete_own" on public.play_proposal_votes
  for delete
  using (player_id = (select auth.uid()));
