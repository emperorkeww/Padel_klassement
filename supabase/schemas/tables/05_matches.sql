-- Status van een wedstrijd
create type public.match_status as enum ('scheduled', 'in_progress', 'completed', 'cancelled');

-- Speelvorm: dubbel (2v2, standaard) of singles (1v1). Als enum zodat de
-- gegenereerde types de union '1v1' | '2v2' opleveren (zie match_status).
create type public.match_format as enum ('1v1', '2v2');

-- Baantype waarop gespeeld is (#471): voedt de baanvoorkeuren op het profiel.
-- Optioneel — oudere matches en snelle invoer laten dit leeg. Als enum zodat
-- de gegenereerde types een nette union opleveren (zie match_format).
create type public.court_type as enum ('binnen', 'buiten', 'panorama', 'muur');

-- Maandelijkse joker (#1003). De tabel en de volledige motivatie staan in
-- 24_match_jokers.sql; het type staat hier omdat rating_history hem al in
-- 08_ratings.sql gebruikt en de schema-bestanden op naam worden ingelezen
-- (config.toml, schema_paths). Als enum en niet als slug zoals wager_drink:
-- dit is een gesloten lijst van drie met gevolgen voor de Elo-kern, geen
-- groeiende kaart.
create type public.joker_type as enum (
  'schild',
  'dubbel_of_niets',
  'wissel_van_kant'
);

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
  -- Drankje-inzet (#1004): waar de verliezers de winnaars na de pot op
  -- trakteren. Puur sociaal — dit raakt de rating met geen vinger aan, in
  -- tegenstelling tot de lef-tip (match_stakes, #804) die óók "inzet" heet.
  --
  -- Bewust text-slug en geen enum zoals court_type: de drankkaart telt 35
  -- items en groeit, en een enum zou per nieuw biertje een migratie kosten én
  -- een union van 35 strings in de gegenereerde types opleveren. De preset in
  -- src/features/matches/drankkaart.ts is de bron van waarheid voor label en
  -- icoon; een onbekende slug degradeert daar naar de slug zelf.
  wager_drink text,
  -- Aantal consumpties per winnaar; standaard 1, verhoogbaar voor wie durft.
  wager_drink_qty smallint not null default 1,
  -- Ingelost aan de bar (#1004): gezet via settle_match_wager, nooit direct.
  wager_settled_at timestamptz,
  wager_settled_by uuid references public.profiles (id) on delete set null,
  -- idempotentie-sleutel voor de aanmaak-RPC's (#462): een client-gegenereerde
  -- token maakt het opnieuw afspelen van een offline gequeuede match veilig — een
  -- tweede insert met dezelfde token botst (unieke index) i.p.v. een duplicaat te
  -- maken, en de RPC geeft dan de bestaande match terug. NULL voor legacy/normale
  -- writes; NULLs blijven onderling distinct, dus die coëxisteren gewoon.
  client_token uuid,
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
  -- Drankje-inzet (#1004): de slug blijft een slug, het aantal blijft klein
  -- genoeg om aan de bar waargemaakt te worden, en zonder drankje valt er
  -- niets in te lossen.
  constraint matches_wager_drink_slug check (
    wager_drink is null or wager_drink ~ '^[a-z0-9-]{2,40}$'
  ),
  constraint matches_wager_qty_range check (
    wager_drink_qty between 1 and 10
  ),
  -- wager_settled_by mag los leeglopen (profiel verwijderd, on delete set
  -- null); wager_settled_at blijft dan staan als "is ingelost, door wie weten
  -- we niet meer". Andersom heeft een inlosser zonder tijdstip geen betekenis.
  constraint matches_wager_settled_needs_drink check (
    wager_settled_at is null or wager_drink is not null
  ),
  constraint matches_wager_settled_by_needs_at check (
    wager_settled_by is null or wager_settled_at is not null
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
-- Idempotentie-sleutel (#462): partieel, zodat alleen de (weinige) getokende
-- matches geïndexeerd worden en legacy-NULL-rijen buiten de unieke beperking
-- vallen. Dient tegelijk als arbiter-index voor de ON CONFLICT in de RPC's.
create unique index matches_client_token_key
  on public.matches (client_token)
  where client_token is not null;
-- Ondersteunt de einde-van-de-keten-check van de ELO-trigger
-- (functions/09_ratings.sql): zelfde volgorde als recompute_ratings.
create index matches_completed_order_idx
  on public.matches ((coalesce(played_at, created_at)), created_at, id)
  where status = 'completed';