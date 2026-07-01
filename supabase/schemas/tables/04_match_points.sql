-- Score per punt: elk gespeeld punt is één rij (bron van waarheid voor de score)
-- Set/game-stand is af te leiden door punten te aggregeren volgens de padel-regels.
create table public.match_points (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  set_number smallint not null check (set_number between 1 and 3),
  game_number smallint not null check (game_number >= 1),
  point_number smallint not null check (point_number >= 1),
  -- welk team het punt won
  won_by_team_id uuid not null references public.teams (id) on delete restrict,
  -- gouden punt (beslissend punt bij deuce)
  is_golden_point boolean not null default false,
  created_at timestamptz not null default now(),
  -- elk punt binnen een game is uniek genummerd
  unique (match_id, set_number, game_number, point_number)
);

create index match_points_match_idx on public.match_points (match_id);