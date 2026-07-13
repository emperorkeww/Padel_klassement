-- Smoesjesmachine (#296): na een verloren groepsmatch plaatst de verliezer één
-- ludiek excuus ("smoes") onder Coach Rudy's stem, zichtbaar voor de groep op de
-- feed. Eén smoes per speler per match, vervangbaar. De tekst wordt opgeslagen
-- (niet een index) zodat pool-wijzigingen bestaande smoezen niet breken en de
-- feed exact toont wat de speler plaatste. Rudy's jury-oordeel (❌/⚠️/✅) is
-- deterministisch uit de tekst afleidbaar (src/lib/excuses.ts) en hoeft dus niet
-- opgeslagen te worden.
create table public.match_smoesjes (
  match_id uuid not null references public.matches (id) on delete cascade,
  player_id uuid not null references public.profiles (id) on delete cascade,
  -- group_id gedenormaliseerd zodat RLS en de realtime-filter hetzelfde
  -- eenvoudige patroon volgen als match_predictions/play_poll_votes. De guard-
  -- trigger borgt dat hij echt bij de match hoort.
  group_id uuid not null references public.groups (id) on delete cascade,
  smoes text not null check (char_length(smoes) between 1 and 280),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (match_id, player_id)
);

create index match_smoesjes_group_idx on public.match_smoesjes (group_id);

alter table public.match_smoesjes enable row level security;
