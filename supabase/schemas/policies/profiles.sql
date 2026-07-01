-- Row Level Security voor public.profiles
alter table public.profiles enable row level security;

-- Iedereen mag profielen lezen
create policy "Profielen zijn publiek leesbaar"
  on public.profiles
  for select
  using (true);

-- gebruiker mag enkel eigen profiel bijwerken
create policy "Gebruiker kan eigen profiel bijwerken"
  on public.profiles
  for update
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);