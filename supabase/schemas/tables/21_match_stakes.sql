-- Lef-tip (#804): een deelnemer zet vóór de aftrap zijn eigen Elo-mutatie
-- dubbel op het spel. Dubbel-of-niets: wint zijn team, dan telt zijn winst ×2;
-- verliest het, dan telt zijn verlies ×2. Wie niets plaatst speelt exact zoals
-- voorheen. Los van de toto (match_predictions, #116): die is voor de
-- toeschouwers en levert eigen punten op, de lef-tip is voor de spelers zelf
-- en raakt alleen hun rating.
--
-- Waarom symmetrisch: bij winst ×2 en verlies ÷2 levert tippen
-- 1,5 · K · E · (1 − E) op — altijd positief, dus het vinkje zou een
-- verplichting worden en de ratings zouden collectief oplopen. Een
-- symmetrische factor op een mutatie met verwachting nul houdt die
-- verwachting op nul.
--
-- De tip heeft bewust geen inhoud: je zet uitsluitend op je eigen winst in.
-- Kon je ook op je eigen verlies wedden, dan zou het bij sterke tegenstanders
-- lonen om tegen jezelf te spelen. Het bestaan van de rij ís dus de tip.
create table public.match_stakes (
  match_id uuid not null references public.matches (id) on delete cascade,
  player_id uuid not null references public.profiles (id) on delete cascade,
  -- group_id gedenormaliseerd zodat RLS en de realtime-filter hetzelfde
  -- eenvoudige patroon volgen als match_predictions/play_poll_votes.
  group_id uuid not null references public.groups (id) on delete cascade,
  -- Speeldag van de match in clubtijd, serverside gezet door de guard. Draagt
  -- de unieke index die het tegoed (één lef-tip per speeldag) afdwingt: een
  -- telling in de guard zou onder twee gelijktijdige inserts allebei
  -- doorlaten, een unieke index niet.
  --
  -- Bewust een snapshot van het tipmoment. Wordt de match later verplaatst,
  -- dan blijft de speeldag staan — anders zou een tijdswijziging op de unieke
  -- index kunnen botsen en de match-update laten falen.
  play_date date not null,
  created_at timestamptz not null default now(),
  primary key (match_id, player_id)
);

-- Het lef-tegoed: één inzet per speler per speeldag.
create unique index match_stakes_one_per_day
  on public.match_stakes (player_id, play_date);
create index match_stakes_group_idx on public.match_stakes (group_id);

alter table public.match_stakes enable row level security;
