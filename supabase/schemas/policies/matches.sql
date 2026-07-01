-- Row Level Security voor public.matches
alter table public.matches enable row level security;

create policy "Matches zijn publiek leesbaar"
  on public.matches
  for select
  using (true);

-- Bewust GEEN directe INSERT-policy: matches worden uitsluitend aangemaakt via
-- de SECURITY DEFINER RPC's (create_completed_match, generate_americano_round),
-- die deelnemer- en vriend-checks afdwingen. Zie migratie 20260701140000 (K1).

-- Enkel de aanmaker kan de match bijwerken (bv. status/winnaar zetten)
create policy "Aanmaker kan match bijwerken"
  on public.matches
  for update
  to authenticated
  using ((select auth.uid()) = created_by)
  with check ((select auth.uid()) = created_by);