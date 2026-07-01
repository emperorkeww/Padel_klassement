-- Row Level Security voor public.teams
alter table public.teams enable row level security;

create policy "Teams zijn publiek leesbaar"
  on public.teams
  for select
  using (true);

-- Bewust GEEN directe INSERT/UPDATE-policy: teams worden uitsluitend aangemaakt
-- via public._ensure_team() (SECURITY DEFINER). Directe INSERT liet je zonder
-- vriend-check een team met een willekeurig slachtoffer vormen; directe UPDATE
-- liet een teamlid de andere speler vervangen en historische matchstatistiek
-- verschuiven. Zie migratie 20260701140000 (H1/H2).