-- Matchvoorspellingen (toto, #116): groepsleden tippen vóór de start de
-- winnaar van een geplande groepsmatch. Eén tip per speler per match,
-- aanpasbaar tot de starttijd. Punten worden na de uitslag automatisch
-- toegekend door grade_match_predictions (omgekeerd evenredig met de
-- winkans op tipmoment).
create table public.match_predictions (
  match_id uuid not null references public.matches (id) on delete cascade,
  player_id uuid not null references public.profiles (id) on delete cascade,
  -- group_id gedenormaliseerd zodat RLS en de realtime-filter hetzelfde
  -- eenvoudige patroon volgen als play_poll_votes/slot_availability.
  group_id uuid not null references public.groups (id) on delete cascade,
  predicted_team_id uuid not null references public.teams (id) on delete cascade,
  -- Snapshot van de winkans van het GETIPTE team op tipmoment, door de
  -- guard-trigger serverside berekend uit player_ratings. Nodig omdat
  -- recompute_ratings() de historie volledig herbouwt: de punten moeten
  -- kloppen met wat de tipper destijds zag.
  win_chance numeric not null check (win_chance > 0 and win_chance < 1),
  -- null = nog niet beoordeeld; gezet door grade_match_predictions.
  points smallint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (match_id, player_id)
);

create index match_predictions_group_idx on public.match_predictions (group_id);

alter table public.match_predictions enable row level security;
