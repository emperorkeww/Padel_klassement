-- #322: leg de club/locatie vast op de speeldag-poll zelf (snapshot), i.p.v.
-- die af te leiden uit de globale clubkeuze (localStorage). Zonder deze kolommen
-- "verhuist" elke bestaande poll mee als je in /banen een andere club kiest —
-- ook reeds vergrendelde/geboekte polls. Clubs zijn Playtomic-tenants (geen
-- eigen tabel), dus we denormaliseren de vier Club-velden.

-- 1. Kolommen toevoegen (eerst nullable, zodat de backfill kan draaien).
alter table public.play_polls
  add column if not exists club_id text,
  add column if not exists club_name text,
  add column if not exists club_city text,
  add column if not exists club_timezone text;

-- 2. Bestaande polls terugvullen met de thuisclub (DEFAULT_CLUB uit club.ts:
--    LAGO CLUB Padel Beveren). Alleen rijen die nog geen locatie hebben.
update public.play_polls
set
  club_id = coalesce(club_id, '91d8d419-3736-498e-90be-362de786d588'),
  club_name = coalesce(club_name, 'LAGO CLUB Padel Beveren'),
  club_city = coalesce(club_city, 'Beveren'),
  club_timezone = coalesce(club_timezone, 'Europe/Brussels')
where club_id is null
  or club_name is null
  or club_timezone is null;

-- 3. Nu elke poll een locatie heeft: de verplichte velden hard maken. club_city
--    blijft optioneel (kan leeg zijn voor sommige tenants).
alter table public.play_polls
  alter column club_id set not null,
  alter column club_name set not null,
  alter column club_timezone set not null;

-- NB: nieuwe kolommen erven de bestaande table-grants van play_polls; RLS
-- (play_polls_update_manager) dekt het wijzigen van deze kolommen al.
