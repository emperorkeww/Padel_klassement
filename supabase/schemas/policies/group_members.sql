-- Row Level Security voor public.group_members
alter table public.group_members enable row level security;

create policy "Groepsleden zijn zichtbaar voor leden"
  on public.group_members for select
  to authenticated
  using (public.is_group_member(group_id, (select auth.uid())));

-- Elk lid — niet alleen de eigenaar (#776) — kan zichzelf, een geaccepteerde
-- vriend of zijn eigen gast toevoegen (gasten doen zo mee in gegenereerde
-- rondes). De tweede voorwaarde blijft de rem: je nodigt alleen mensen uit die
-- je zelf kent, dus een lid kan geen willekeurige vreemde in de groep zetten.
create policy "Lid kan vrienden toevoegen"
  on public.group_members for insert
  to authenticated
  with check (
    public.is_group_member(group_id, (select auth.uid()))
    and (
      player_id = (select auth.uid())
      or public.are_friends((select auth.uid()), player_id)
      or public.is_own_guest((select auth.uid()), player_id)
    )
  );

-- Verwijderen blijft owner-only (#776): toevoegen is open, eruit zetten niet.
-- Ieder lid kan wel zichzelf verwijderen — dat is "groep verlaten".
create policy "Eigenaar of lid zelf kan verwijderen"
  on public.group_members for delete
  to authenticated
  using (public.is_group_owner(group_id, (select auth.uid()))
         or player_id = (select auth.uid()));