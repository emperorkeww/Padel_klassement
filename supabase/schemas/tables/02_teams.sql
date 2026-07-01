-- Teams: een vast paar van 2 spelers (padel-dubbel)
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text,
  player1_id uuid not null references public.profiles (id) on delete cascade,
  player2_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- een team bestaat uit twee verschillende spelers
  constraint teams_distinct_players check (player1_id <> player2_id)
);

-- Uniek paar, ongeacht de volgorde van speler 1 en 2
create unique index teams_unique_pair
  on public.teams (least(player1_id, player2_id), greatest(player1_id, player2_id));