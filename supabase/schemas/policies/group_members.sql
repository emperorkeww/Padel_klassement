-- Row Level Security voor public.group_members
alter table public.group_members enable row level security;

create policy "Groepsleden zijn zichtbaar voor leden"
  on public.group_members for select
  to authenticated
  using (public.is_group_member(group_id, (select auth.uid())));

-- Een eigenaar kan zichzelf, een geaccepteerde vriend of zijn eigen gast
-- toevoegen (gasten doen zo mee in gegenereerde rondes).
create policy "Eigenaar kan vrienden toevoegen"
  on public.group_members for insert
  to authenticated
  with check (
    public.is_group_owner(group_id, (select auth.uid()))
    and (
      player_id = (select auth.uid())
      or public.are_friends((select auth.uid()), player_id)
      or public.is_own_guest((select auth.uid()), player_id)
    )
  );

create policy "Eigenaar of lid zelf kan verwijderen"
  on public.group_members for delete
  to authenticated
  using (public.is_group_owner(group_id, (select auth.uid()))
         or player_id = (select auth.uid()));