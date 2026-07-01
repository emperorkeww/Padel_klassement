-- Row Level Security voor public.groups
alter table public.groups enable row level security;

create policy "Groepen van leden zijn leesbaar"
  on public.groups for select
  to authenticated
  using (public.is_group_member(id, (select auth.uid()))
         or created_by = (select auth.uid()));

create policy "Gebruiker kan groep aanmaken"
  on public.groups for insert
  to authenticated
  with check ((select auth.uid()) = created_by);

create policy "Eigenaar kan groep bijwerken"
  on public.groups for update
  to authenticated
  using ((select auth.uid()) = created_by)
  with check ((select auth.uid()) = created_by);

create policy "Eigenaar kan groep verwijderen"
  on public.groups for delete
  to authenticated
  using ((select auth.uid()) = created_by);