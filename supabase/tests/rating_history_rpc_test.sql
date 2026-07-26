-- pgTAP-tests voor de begrensde lees-RPC's op rating_history (#731):
-- recent_rating_history (laatste N punten per speler) en ratings_as_of (de
-- rating per speler op een datum, voor de tijdmachine in het klassement).
--
-- Waarom dit getest wordt: de vorige client-query haalde de vólledige tabel op
-- en werd stil door PostgREST afgekapt op max_rows. De hele winst van deze
-- RPC's zit in hun begrenzing — dat het venster écht per speler telt en dat
-- p_limit geklemd blijft, is dus de kern, niet een randgeval.
begin;

select plan(12);

------------------------------------------------------------------------
-- Fixtures (als superuser). De trigger handle_new_user maakt de profielen.
-- Vaste data in 2030 zodat onze matches ná eventuele seed-matches sorteren
-- en de dag-grenzen deterministisch zijn.
------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
values
  ('00000000-0000-0000-0000-000000000000','73100000-0000-0000-0000-000000000001','authenticated','authenticated','h1@test.nl','x',now(),'{}','{"username":"h1"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','73100000-0000-0000-0000-000000000002','authenticated','authenticated','h2@test.nl','x',now(),'{}','{"username":"h2"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','73100000-0000-0000-0000-000000000003','authenticated','authenticated','h3@test.nl','x',now(),'{}','{"username":"h3"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','73100000-0000-0000-0000-000000000004','authenticated','authenticated','h4@test.nl','x',now(),'{}','{"username":"h4"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','73100000-0000-0000-0000-000000000009','authenticated','authenticated','h9@test.nl','x',now(),'{}','{"username":"h9"}',now(),now(),'','','','');

-- HA = h1+h2, HB = h3+h4. h9 speelt niet mee (heeft dus geen historie).
insert into public.teams (id, player1_id, player2_id)
values
  ('73100000-0000-0000-0000-0000000000aa','73100000-0000-0000-0000-000000000001','73100000-0000-0000-0000-000000000002'),
  ('73100000-0000-0000-0000-0000000000bb','73100000-0000-0000-0000-000000000003','73100000-0000-0000-0000-000000000004');

-- Drie afgeronde matches; de ELO-trigger schrijft per match vier history-rijen.
insert into public.matches (id, team_a_id, team_b_id, status, winner_team_id, played_at)
values
  ('73100000-0000-0000-0000-0000000000c1','73100000-0000-0000-0000-0000000000aa','73100000-0000-0000-0000-0000000000bb','completed','73100000-0000-0000-0000-0000000000aa','2030-01-10 19:00:00+00'),
  ('73100000-0000-0000-0000-0000000000c2','73100000-0000-0000-0000-0000000000aa','73100000-0000-0000-0000-0000000000bb','completed','73100000-0000-0000-0000-0000000000bb','2030-02-10 19:00:00+00'),
  ('73100000-0000-0000-0000-0000000000c3','73100000-0000-0000-0000-0000000000aa','73100000-0000-0000-0000-0000000000bb','completed','73100000-0000-0000-0000-0000000000aa','2030-03-10 19:00:00+00');

------------------------------------------------------------------------
-- 1. recent_rating_history: het venster telt per speler, niet globaal.
------------------------------------------------------------------------
select is(
  (select count(*)::int from public.recent_rating_history(2)
    where player_id = '73100000-0000-0000-0000-000000000001'),
  2, 'p_limit=2 geeft twee punten voor deze speler');
select is(
  (select count(*)::int from public.recent_rating_history(2)
    where player_id in (
      '73100000-0000-0000-0000-000000000001','73100000-0000-0000-0000-000000000002',
      '73100000-0000-0000-0000-000000000003','73100000-0000-0000-0000-000000000004')),
  8, 'en twee punten voor élke speler — de limiet is per speler, niet totaal');

------------------------------------------------------------------------
-- 2. Het zijn de NIEUWSTE punten, chronologisch teruggegeven. Precies dit
--    ging mis: oplopend sorteren + afkappen leverde de oudste punten op.
------------------------------------------------------------------------
select is(
  (select array_agg(played_at order by ord)
     from (select played_at, row_number() over () as ord
             from public.recent_rating_history(2)
            where player_id = '73100000-0000-0000-0000-000000000001') t),
  array['2030-02-10 19:00:00+00'::timestamptz, '2030-03-10 19:00:00+00'::timestamptz],
  'de twee nieuwste punten, oud → nieuw teruggegeven');
select is(
  (select count(*)::int from public.recent_rating_history(2)
    where player_id = '73100000-0000-0000-0000-000000000001'
      and match_id = '73100000-0000-0000-0000-0000000000c1'),
  0, 'het oudste punt valt buiten het venster');

------------------------------------------------------------------------
-- 3. Zonder venster-argument telt de default (20) — hier dus alles.
------------------------------------------------------------------------
select is(
  (select count(*)::int from public.recent_rating_history()
    where player_id = '73100000-0000-0000-0000-000000000001'),
  3, 'default p_limit geeft de volledige (korte) historie');

------------------------------------------------------------------------
-- 4. Klemming. p_limit is een payload-plafond: onder de 1 heeft het geen zin,
--    en boven de 50 zou spelers × p_limit alsnog door max_rows heen breken.
--    Vijftig losse rijen voor h9 om het bovenplafond zichtbaar te maken.
------------------------------------------------------------------------
insert into public.rating_history (player_id, match_id, rating_before, rating_after, delta, played_at)
select '73100000-0000-0000-0000-000000000009',
  '73100000-0000-0000-0000-0000000000c1',
  1000 + i, 1010 + i, 10,
  '2030-04-01 19:00:00+00'::timestamptz + (i || ' days')::interval
from generate_series(1, 60) as i;

select is(
  (select count(*)::int from public.recent_rating_history(999)
    where player_id = '73100000-0000-0000-0000-000000000009'),
  50, 'p_limit boven het plafond wordt geklemd op 50');
select is(
  (select count(*)::int from public.recent_rating_history(0)
    where player_id = '73100000-0000-0000-0000-000000000009'),
  1, 'p_limit onder 1 wordt geklemd op 1');
select is(
  (select min(played_at) from public.recent_rating_history(50)
    where player_id = '73100000-0000-0000-0000-000000000009'),
  '2030-04-12 19:00:00+00'::timestamptz,
  'het geklemde venster houdt de nieuwste rijen over, niet de oudste');

------------------------------------------------------------------------
-- 5. ratings_as_of: de rating zoals die aan het eind van die dag was.
------------------------------------------------------------------------
select is(
  (select rating from public.ratings_as_of('2030-02-10')
    where player_id = '73100000-0000-0000-0000-000000000001'),
  (select rating_after from public.rating_history
    where player_id = '73100000-0000-0000-0000-000000000001'
      and match_id = '73100000-0000-0000-0000-0000000000c2'),
  'op de speeldag zelf telt de match van die dag al mee');
select is(
  (select rating from public.ratings_as_of('2030-02-09')
    where player_id = '73100000-0000-0000-0000-000000000001'),
  (select rating_after from public.rating_history
    where player_id = '73100000-0000-0000-0000-000000000001'
      and match_id = '73100000-0000-0000-0000-0000000000c1'),
  'de dag ervoor geldt nog de rating van de vorige match');
select is(
  (select count(*)::int from public.ratings_as_of('2030-02-10')
    where player_id = '73100000-0000-0000-0000-000000000001'),
  1, 'exact één rij per speler');
select is(
  (select count(*)::int from public.ratings_as_of('2029-12-31')
    where player_id = '73100000-0000-0000-0000-000000000001'),
  0, 'vóór zijn eerste match komt een speler niet voor');

select * from finish();
rollback;
