-- Maandelijkse jokers (#1003): elke speler krijgt één joker per kalendermaand
-- en speelt die vóór de aftrap uit op een geplande groepsmatch waarin hij zelf
-- meedoet. Drie soorten, waarvan er twee de rating raken:
--
--   * schild          — deze match telt niet voor jóuw rating: geen verlies,
--                       maar ook geen winst (factor 0).
--   * dubbel_of_niets — je eigen mutatie ×2, in beide richtingen. Exact de
--                       lef-tip (match_stakes, #804), maar betaald uit je
--                       maandjoker in plaats van uit je dagtegoed.
--   * wissel_van_kant — de tegenstanders wisselen links/rechts. Puur sociaal;
--                       de app kent geen kanten, dit is een afspraak op de
--                       kaart. Raakt de rating met geen enkel punt.
--
-- WAAROM HET SCHILD OOK JE WINST AFNEEMT. Met factor fw bij winst en fl bij
-- verlies is E[Δ] = E · K · (1 − E) · (fw − fl): elke asymmetrie maakt Elo bij.
-- Pure verliesbescherming (fw = 1, fl = 0) levert dus gratis rating op, en dan
-- is de joker geen keuze meer maar een verplichting — precies de redenering
-- waarmee de lef-tip symmetrisch werd gehouden (zie 21_match_stakes.sql). Een
-- factor die beide kanten even hard raakt is de enige bescherming die de
-- verwachting op nul laat; 0 is daarvan het uiterste geval.
--
-- BEWUST GEEN INVENTARIS-TABEL EN GEEN UITDEEL-JOB. Een tabel met "uitgedeelde"
-- jokers zou muteerbare state naast de rating-replay zetten, met alle drift van
-- dien (zie de motivatie in 31_bounty.sql), plus een cron die maandelijks moet
-- draaien. Het tegoed is hier afgeleid: deze tabel bevat alleen de gespééld
-- jokers, en de unieke index op (player_id, period_month) ís de inventaris.
-- Niets uitgedeeld betekent één vrije kaart; één rij betekent op. Zelfde
-- constructie als het dagtegoed van de lef-tip.
--
-- Het type public.joker_type staat in 05_matches.sql en niet hier: de
-- schema-bestanden worden op naam ingelezen (config.toml) en rating_history
-- gebruikt het type al in 08_ratings.sql, ruim vóór dit bestand.
create table public.match_jokers (
  match_id uuid not null references public.matches (id) on delete cascade,
  player_id uuid not null references public.profiles (id) on delete cascade,
  -- group_id gedenormaliseerd zodat RLS en de realtime-filter hetzelfde
  -- eenvoudige patroon volgen als match_stakes/match_predictions.
  group_id uuid not null references public.groups (id) on delete cascade,
  joker public.joker_type not null,
  -- Eerste dag van de maand waarin de match valt, in clubtijd, serverside
  -- gezet door de guard. Draagt de unieke index die het maandtegoed afdwingt:
  -- een telling in de guard zou onder twee gelijktijdige inserts allebei
  -- doorlaten, een unieke index niet.
  --
  -- Bewust een snapshot van het speelmoment, net als play_date bij de lef-tip:
  -- wordt de match later verplaatst, dan blijft de maand staan — anders zou
  -- een tijdswijziging op de unieke index kunnen botsen en de match-update
  -- laten falen.
  period_month date not null,
  created_at timestamptz not null default now(),
  -- Eén joker per speler per match. Twee kaarten op dezelfde partij bestaat
  -- niet: dan zou "schild" en "dubbel of niets" tegelijk kunnen gelden.
  primary key (match_id, player_id)
);

-- Het maandtegoed: één joker per speler per kalendermaand, over al zijn
-- groepen samen.
create unique index match_jokers_one_per_month
  on public.match_jokers (player_id, period_month);
create index match_jokers_group_idx on public.match_jokers (group_id);

alter table public.match_jokers enable row level security;
