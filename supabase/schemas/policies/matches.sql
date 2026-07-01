-- Row Level Security voor public.matches
alter table public.matches enable row level security;

create policy "Matches zijn publiek leesbaar"
  on public.matches
  for select
  using (true);

-- Je registreert een match op eigen naam (created_by = jij)
create policy "Gebruiker kan match aanmaken"
  on public.matches
  for insert
  to authenticated
  with check ((select auth.uid()) = created_by);

-- Enkel de aanmaker kan de match bijwerken (bv. status/winnaar zetten)
create policy "Aanmaker kan match bijwerken"
  on public.matches
  for update
  to authenticated
  using ((select auth.uid()) = created_by)
  with check ((select auth.uid()) = created_by);