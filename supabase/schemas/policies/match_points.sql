-- Row Level Security voor public.match_points
alter table public.match_points enable row level security;

create policy "Punten zijn publiek leesbaar"
  on public.match_points
  for select
  using (true);

-- Enkel de aanmaker van de match mag punten toevoegen
create policy "Match-aanmaker kan punten toevoegen"
  on public.match_points
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.matches m
      where m.id = match_id
        and m.created_by = (select auth.uid())
    )
  );