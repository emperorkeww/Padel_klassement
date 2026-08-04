-- Rudy's VAR (#1025): een deelnemer betwist één punt uit de eindstand, de
-- andere deelnemers stemmen, en bij een toekenning verschuift het punt écht.
--
-- WAAROM DE EINDSTAND EN NIET match_points. De issue beschrijft een beroep op
-- één rij uit public.match_points, "de bron van waarheid voor de score". Die
-- tabel heeft in de hele codebase geen enkele schrijver: alleen seed.sql vult
-- hem, geen RPC en geen client-flow (zie de toelichting in
-- src/features/seizoen/awards.ts en src/features/profiles/badges.streaks.ts).
-- Een VAR op match_points zou dus op geen enkele bestaande of nieuwe match
-- zichtbaar zijn. Daarom hangt het beroep aan matches.score_a/score_b — "de
-- autoritaire aggregaat voor stand en ratings" (05_matches.sql) — en verschuift
-- een toekenning daar één eenheid. In een americano-ronde is dat precies het
-- punt waarover geroepen wordt (21-19 wordt 20-20), en het werkt op de hele
-- bestaande historie. Komt er ooit punt-voor-punt-invoer (#568), dan kan een
-- nullable point_id hier meeliften zonder de rest te herbouwen.
create table public.point_appeals (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  claimant_id uuid not null references public.profiles (id) on delete cascade,
  -- Welke set het punt in viel (1-based, index in matches.set_scores). Alleen
  -- gevuld als de match een per-set uitslag heeft: dan verschuift naast de
  -- kopscore ook die ene set mee, zodat de twee niet uit elkaar lopen. Zonder
  -- set_scores hoort hier null te staan; de guard dwingt beide kanten af.
  set_number smallint check (set_number is null or set_number between 1 and 5),
  reden text not null check (
    reden in ('ons-punt', 'dubbele-stuit', 'net', 'buiten', 'verkeerd-ingetikt')
  ),
  toelichting text check (toelichting is null or length(toelichting) <= 140),
  -- 'verlopen' = de uitslag is intussen langs een andere weg gewijzigd, dus het
  -- beroep sloeg op een stand die niet meer bestaat. 'tegoed-op' = de groep gaf
  -- je gelijk, maar je had die speeldag al een beroep gewonnen; de uitslag
  -- blijft dan staan. Twee eigen statussen en geen 'afgewezen', omdat Rudy in
  -- beide gevallen iets heel anders te vertellen heeft dan "de groep vond het
  -- onzin".
  status text not null default 'open' check (
    status in ('open', 'toegekend', 'afgewezen', 'verlopen', 'tegoed-op')
  ),
  -- Stand op het moment van indienen, serverside gezet door de guard. Wijkt de
  -- match daar bij de afhandeling van af — iemand corrigeerde de uitslag
  -- tussendoor (#978) of verving een gast (#681) — dan slaat het beroep op een
  -- stand die niet meer bestaat en vervalt het ('verlopen') in plaats van een
  -- tweede correctie bovenop de eerste te stapelen.
  snapshot_a smallint not null,
  snapshot_b smallint not null,
  -- Speeldag van de match in clubtijd, serverside gezet door de guard. Draagt
  -- het beroepstegoed via de partiële unieke index hieronder — zelfde model als
  -- play_date bij de lef-tip (21_match_stakes.sql) en period_month bij de joker
  -- (24_match_jokers.sql).
  play_date date not null,
  -- Wanneer de stemming dichtgaat; serverside gezet op 12 u na indienen. Niet
  -- gestemd = afgewezen: zwijgen is geen instemming.
  votes_close_at timestamptz not null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

-- Eén open beroep per match tegelijk. Als partiële unieke index en niet als
-- telling in de guard: twee gelijktijdige inserts zouden een telling allebei
-- passeren, een index niet.
create unique index point_appeals_one_open_per_match_uidx
  on public.point_appeals (match_id) where status = 'open';

-- Het beroepstegoed: één tóekenning per speler per speeldag. Verliezen kost je
-- niets behalve gezichtsverlies; winnen kost je je tegoed, zoals in de sport.
-- De guard weigert een nieuw beroep zodra het tegoed op is, maar de index is
-- wat het echt afdwingt: twee beroepen op verschillende matches van dezelfde
-- avond kunnen allebei openstaan en pas bij de afhandeling botsen.
create unique index point_appeals_tegoed_uidx
  on public.point_appeals (claimant_id, play_date) where status = 'toegekend';

create index point_appeals_match_idx on public.point_appeals (match_id);
create index point_appeals_claimant_idx on public.point_appeals (claimant_id);
-- Voor de cron die verlopen beroepen sluit (expire_point_appeals).
create index point_appeals_open_idx
  on public.point_appeals (votes_close_at) where status = 'open';

alter table public.point_appeals enable row level security;

-- De stemmen. Met naam en toeval: dit is een sociaal mechanisme, geen anonieme
-- jury — de select-policy laat iedereen die het beroep mag zien ook zien wie
-- wat stemde.
create table public.point_appeal_votes (
  appeal_id uuid not null references public.point_appeals (id) on delete cascade,
  voter_id uuid not null references public.profiles (id) on delete cascade,
  akkoord boolean not null,
  created_at timestamptz not null default now(),
  primary key (appeal_id, voter_id)
);

alter table public.point_appeal_votes enable row level security;
