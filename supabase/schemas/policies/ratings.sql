-- Row Level Security voor de rating-tabellen.
-- Publiek leesbaar (net als de standings); schrijven kan enkel via de
-- SECURITY DEFINER recompute-functie, dus er zijn geen write-policies.

alter table public.player_ratings enable row level security;

create policy "Ratings zijn publiek leesbaar"
  on public.player_ratings
  for select
  using (true);

alter table public.rating_history enable row level security;

create policy "Rating-historie is publiek leesbaar"
  on public.rating_history
  for select
  using (true);
