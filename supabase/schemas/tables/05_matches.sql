-- Status van een wedstrijd
create type public.match_status as enum ('scheduled', 'in_progress', 'completed', 'cancelled');

-- Speelvorm: dubbel (2v2, standaard) of singles (1v1). Als enum zodat de
-- gegenereerde types de union '1v1' | '2v2' opleveren (zie match_status).
create type public.match_format as enum ('1v1', '2v2');

-- Baantype waarop gespeeld is (#471): voedt de baanvoorkeuren op het profiel.
-- Optioneel — oudere matches en snelle invoer laten dit leeg. Als enum zodat
-- de gegenereerde types een nette union opleveren (zie match_format).
create type public.court_type as enum ('binnen', 'buiten', 'panorama', 'muur');

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
  -- optionele per-set uitslag, bv. [[6,4],[3,6],[7,5]]. Puur voor weergave;
  -- score_a/score_b blijven de autoritaire aggregaat voor stand en ratings.
  set_scores jsonb,
  -- speelvorm; wordt door de RPC's afgeleid uit de aanwezige spelers
  format public.match_format not null default '2v2',
  -- optioneel baantype (#471), enkel voor de baanvoorkeuren-statistiek
  court_type public.court_type,
  -- een match is tussen twee verschillende teams
  constraint matches_distinct_teams check (team_a_id <> team_b_id),
  -- set_scores moet, indien gevuld, een JSON-array zijn
  constraint matches_set_scores_is_array check (
    set_scores is null or jsonb_typeof(set_scores) = 'array'
  ),
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
-- Ondersteunt de einde-van-de-keten-check van de ELO-trigger
-- (functions/09_ratings.sql): zelfde volgorde als recompute_ratings.
create index matches_completed_order_idx
  on public.matches ((coalesce(played_at, created_at)), created_at, id)
  where status = 'completed';