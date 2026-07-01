-- Row Level Security voor public.teams
alter table public.teams enable row level security;

create policy "Teams zijn publiek leesbaar"
  on public.teams
  for select
  using (true);

-- Je kunt enkel een team aanmaken waar je zelf in zit
create policy "Speler kan eigen team aanmaken"
  on public.teams
  for insert
  to authenticated
  with check ((select auth.uid()) in (player1_id, player2_id));

-- Enkel teamleden kunnen het team bijwerken
create policy "Teamlid kan team bijwerken"
  on public.teams
  for update
  to authenticated
  using ((select auth.uid()) in (player1_id, player2_id))
  with check ((select auth.uid()) in (player1_id, player2_id));