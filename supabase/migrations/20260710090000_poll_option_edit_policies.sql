-- "Dagen aanpassen" (#128): de maker/eigenaar mag kandidaat-momenten van een
-- poll toevoegen of verwijderen, maar alléén zolang de poll open staat — een
-- gelockte of geboekte poll is bevroren. De bestaande manager-policies missen
-- die status-check; opnieuw aanmaken met `p.status = 'open'` erbij.

drop policy "play_poll_options_insert_manager" on public.play_poll_options;
drop policy "play_poll_options_delete_manager" on public.play_poll_options;

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
