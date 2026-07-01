-- Status van een wedstrijd
create type public.match_status as enum ('scheduled', 'in_progress', 'completed', 'cancelled');

-- Matches: losse wedstrijden tussen twee teams
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  team_a_id uuid not null references public.teams (id) on delete restrict,
  team_b_id uuid not null references public.teams (id) on delete restrict,
  status public.match_status not null default 'scheduled',
  -- winnend team; wordt gezet zodra de match is afgerond
  winner_team_id uuid references public.teams (id) on delete restrict,
  played_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  -- een match is tussen twee verschillende teams
  constraint matches_distinct_teams check (team_a_id <> team_b_id),
  -- de winnaar moet een van beide deelnemende teams zijn
  constraint matches_winner_valid check (
    winner_team_id is null
    or winner_team_id in (team_a_id, team_b_id)
  )
);

create index matches_team_a_idx on public.matches (team_a_id);
create index matches_team_b_idx on public.matches (team_b_id);
