-- Status van een wedstrijd
create type public.match_status as enum ('scheduled', 'in_progress', 'completed', 'cancelled');

-- Matches: wedstrijden tussen twee teams, optioneel binnen een groep/ronde
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
  -- koppeling aan een groep/ronde (bv. Americano) + eindscore
  group_id uuid references public.groups (id) on delete set null,
  round_number smallint,
  score_a smallint,
  score_b smallint,
  -- een match is tussen twee verschillende teams
  constraint matches_distinct_teams check (team_a_id <> team_b_id),
  -- de winnaar moet een van beide deelnemende teams zijn
  constraint matches_winner_valid check (
    winner_team_id is null
    or winner_team_id in (team_a_id, team_b_id)
  ),
  -- scores kunnen niet negatief zijn (zou het scoresaldo verpesten)
  constraint matches_scores_nonneg check (
    (score_a is null or score_a >= 0)
    and (score_b is null or score_b >= 0)
  ),
  -- rondenummers beginnen bij 1
  constraint matches_round_positive check (
    round_number is null or round_number >= 1
  ),
  -- als beide scores zijn ingevuld moet de winnaar bij de score passen:
  -- hoogste score wint, gelijke score = gelijkspel (geen winnaar)
  constraint matches_result_consistent check (
    score_a is null
    or score_b is null
    or (winner_team_id = team_a_id and score_a > score_b)
    or (winner_team_id = team_b_id and score_b > score_a)
    or (winner_team_id is null and score_a = score_b)
  )
);

create index matches_team_a_idx on public.matches (team_a_id);
create index matches_team_b_idx on public.matches (team_b_id);
create index matches_group_idx on public.matches (group_id);