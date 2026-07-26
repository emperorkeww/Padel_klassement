-- Teams: een vast paar van 2 spelers (padel-dubbel) of 1 speler (1v1/singles,
-- player2_id is dan null)
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text,
  player1_id uuid not null references public.profiles (id) on delete cascade,
  player2_id uuid references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- een dubbel bestaat uit twee verschillende spelers
  -- (bij een null player2_id evalueert de check naar null en passeert hij)
  constraint teams_distinct_players check (player1_id <> player2_id)
);

-- Uniek paar, ongeacht de volgorde van speler 1 en 2. least/greatest negeren
-- nulls, dus een singles-team (p1, null) indexeert als (p1, p1): botst nooit
-- met een dubbelpaar en dedupt singles-teams per speler.
create unique index teams_unique_pair
  on public.teams (least(player1_id, player2_id), greatest(player1_id, player2_id));

-- "In welke teams speelt deze speler?" (#737). teams_unique_pair helpt daar
-- niet bij: die expressie-index vereist een compleet paar. Zonder deze twee
-- scant getPlayerMatches() de hele tabel, en cascadeert een profiel-
-- verwijdering via een seq scan.
create index teams_player1_idx on public.teams (player1_id);
create index teams_player2_idx on public.teams (player2_id);