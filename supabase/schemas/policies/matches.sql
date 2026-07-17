-- Row Level Security voor public.matches
alter table public.matches enable row level security;

create policy "Matches zijn publiek leesbaar"
  on public.matches
  for select
  using (true);

-- Bewust GEEN directe INSERT-policy: matches worden uitsluitend aangemaakt via
-- de SECURITY DEFINER RPC's (create_completed_match, generate_americano_round),
-- die deelnemer- en vriend-checks afdwingen. Zie migratie 20260701140000 (K1).

-- De aanmaker kan de match onbeperkt bijwerken (uitslag zetten, corrigeren,
-- tijdstip verplaatsen).
create policy "Aanmaker kan match bijwerken"
  on public.matches
  for update
  to authenticated
  using ((select auth.uid()) = created_by)
  with check ((select auth.uid()) = created_by);

-- Deelnemers (spelers in team A of B) mogen de uitslag van hun eigen match
-- invullen: alleen de overgang naar 'completed', en alleen zolang de match
-- nog niet afgerond is (#413). Corrigeren achteraf en het tijdstip wijzigen
-- (zonder statusovergang) blijven via de policy hierboven bij de aanmaker.
create policy "Deelnemer kan uitslag invullen"
  on public.matches
  for update
  to authenticated
  using (
    status <> 'completed'
    and (public.is_team_member(team_a_id, (select auth.uid()))
         or public.is_team_member(team_b_id, (select auth.uid())))
  )
  with check (
    status = 'completed'
    and (public.is_team_member(team_a_id, (select auth.uid()))
         or public.is_team_member(team_b_id, (select auth.uid())))
  );