-- pgTAP-tests voor set_match_group (#648): een losse match achteraf aan een
-- groep koppelen, verhangen of weer loskoppelen.
--
-- Permissiemodel: koppelen mag door elk lid van de doelgroep; verhangen en
-- loskoppelen vergen daarnaast lidmaatschap van de huidige groep. De RPC is
-- het enige schrijfpad voor group_id — de kolom-grant uit #432 blijft dicht.
--
-- Afgeleide data: de match verliest met 6-0 (bagel), dus zodra hij aan een
-- groep hangt moet die groep een pias- én Zwarte-Piet-rij krijgen, en die
-- moeten weer verdwijnen (of meeverhuizen) bij loskoppelen/verhangen.
begin;

select plan(20);

------------------------------------------------------------------------
-- Fixtures (als superuser). De trigger handle_new_user maakt de profielen.
--   u1 = eigenaar G1 (speelt niet mee)   u2 = lid G1 én G2, speelt in team A
--   u3 = speelt in team A, nergens lid   u4/u5 = leden G1, verliezen in team B
--   u6 = eigenaar G2 (speelt niet mee)   u9 = buitenstaander zonder groepen
------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
values
  ('00000000-0000-0000-0000-000000000000','a6480000-0000-0000-0000-000000000001','authenticated','authenticated','g1@test.nl','x',now(),'{}','{"username":"g1"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','a6480000-0000-0000-0000-000000000002','authenticated','authenticated','g2@test.nl','x',now(),'{}','{"username":"g2"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','a6480000-0000-0000-0000-000000000003','authenticated','authenticated','g3@test.nl','x',now(),'{}','{"username":"g3"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','a6480000-0000-0000-0000-000000000004','authenticated','authenticated','g4@test.nl','x',now(),'{}','{"username":"g4"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','a6480000-0000-0000-0000-000000000005','authenticated','authenticated','g5@test.nl','x',now(),'{}','{"username":"g5"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','a6480000-0000-0000-0000-000000000006','authenticated','authenticated','g6@test.nl','x',now(),'{}','{"username":"g6"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','a6480000-0000-0000-0000-000000000009','authenticated','authenticated','g9@test.nl','x',now(),'{}','{"username":"g9"}',now(),now(),'','','','');

-- G1 (eigenaar u1) met u2, u4 en u5 als leden; G2 (eigenaar u6) met u2 als lid.
insert into public.groups (id, name, created_by)
values
  ('a6480000-0000-0000-0000-0000000000f1','Groep één','a6480000-0000-0000-0000-000000000001'),
  ('a6480000-0000-0000-0000-0000000000f2','Groep twee','a6480000-0000-0000-0000-000000000006');
insert into public.group_members (group_id, player_id, role)
values
  ('a6480000-0000-0000-0000-0000000000f1','a6480000-0000-0000-0000-000000000002','member'),
  ('a6480000-0000-0000-0000-0000000000f1','a6480000-0000-0000-0000-000000000004','member'),
  ('a6480000-0000-0000-0000-0000000000f1','a6480000-0000-0000-0000-000000000005','member'),
  ('a6480000-0000-0000-0000-0000000000f2','a6480000-0000-0000-0000-000000000002','member');

-- Teams TA = u2+u3, TB = u4+u5.
insert into public.teams (id, player1_id, player2_id)
values
  ('a6480000-0000-0000-0000-00000000000a','a6480000-0000-0000-0000-000000000002','a6480000-0000-0000-0000-000000000003'),
  ('a6480000-0000-0000-0000-00000000000b','a6480000-0000-0000-0000-000000000004','a6480000-0000-0000-0000-000000000005');

-- De losse match: TA droogt TB af met 6-0 (bagel voor u4/u5). Maandag over
-- twee weken als anker (zie pias_test): gegarandeerd een hele, eigen ISO-week.
insert into public.matches
  (id, team_a_id, team_b_id, group_id, status, winner_team_id,
   score_a, score_b, played_at)
values
  ('a6480000-0000-0000-0000-0000000000aa',
   'a6480000-0000-0000-0000-00000000000a','a6480000-0000-0000-0000-00000000000b',
   null,'completed','a6480000-0000-0000-0000-00000000000a',
   6,0, date_trunc('week', now()) + interval '14 days 1 hour');

------------------------------------------------------------------------
-- Baseline: los = telt nergens mee, maar is wel publiek zichtbaar.
------------------------------------------------------------------------
select is(
  (select count(*)::int from public.pias_of_week
    where group_id in ('a6480000-0000-0000-0000-0000000000f1',
                       'a6480000-0000-0000-0000-0000000000f2')),
  0, 'losse match: geen pias-rij voor welke groep dan ook');
select is(
  (select count(*)::int from public.zwarte_piet
    where group_id in ('a6480000-0000-0000-0000-0000000000f1',
                       'a6480000-0000-0000-0000-0000000000f2')),
  0, 'losse match: geen Zwarte Piet');

set local role authenticated;
set local request.jwt.claims = '{"sub":"a6480000-0000-0000-0000-000000000009","role":"authenticated"}';
select is(
  (select count(*)::int from public.matches
    where id = 'a6480000-0000-0000-0000-0000000000aa'),
  1, 'losse match is publiek zichtbaar, ook voor een buitenstaander (#461)');

------------------------------------------------------------------------
-- Schrijfpaden: de kolom-grant blijft dicht, de RPC bewaakt lidmaatschap.
------------------------------------------------------------------------
select throws_ok(
  $$ update public.matches
        set group_id = 'a6480000-0000-0000-0000-0000000000f1'
      where id = 'a6480000-0000-0000-0000-0000000000aa' $$,
  '42501', null, 'directe UPDATE op group_id blijft geweigerd (#432)');

select throws_ok(
  $$ select public.set_match_group('a6480000-0000-0000-0000-0000000000aa',
                                   'a6480000-0000-0000-0000-0000000000f1') $$,
  'P0001', 'Alleen een lid van de doelgroep kan deze match koppelen',
  'niet-lid kan de match niet aan G1 koppelen');

set local request.jwt.claims = '{"role":"authenticated"}';
select throws_ok(
  $$ select public.set_match_group('a6480000-0000-0000-0000-0000000000aa',
                                   'a6480000-0000-0000-0000-0000000000f1') $$,
  'P0001', 'Niet ingelogd',
  'zonder sessie geen koppeling');

set local request.jwt.claims = '{"sub":"a6480000-0000-0000-0000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ select public.set_match_group('a6480000-0000-0000-0000-0000000000ff',
                                   'a6480000-0000-0000-0000-0000000000f1') $$,
  'P0001', 'Match niet gevonden',
  'onbestaande match geeft een nette fout');

------------------------------------------------------------------------
-- Koppelen door een groepslid dat niet meespeelde en de match niet aanmaakte.
------------------------------------------------------------------------
select public.set_match_group('a6480000-0000-0000-0000-0000000000aa',
                              'a6480000-0000-0000-0000-0000000000f1');
select is(
  (select group_id from public.matches
    where id = 'a6480000-0000-0000-0000-0000000000aa'),
  'a6480000-0000-0000-0000-0000000000f1'::uuid,
  'lid van de doelgroep (geen speler, geen aanmaker) koppelt de match aan G1');

-- Zichtbaarheid kantelt mee met de select-policy (#461).
set local request.jwt.claims = '{"sub":"a6480000-0000-0000-0000-000000000009","role":"authenticated"}';
select is(
  (select count(*)::int from public.matches
    where id = 'a6480000-0000-0000-0000-0000000000aa'),
  0, 'na het koppelen ziet een buitenstaander de groepsmatch niet meer');

-- Afgeleide data volgt retroactief: de 6-0 wordt de pias én de Zwarte Piet.
reset role;
select is(
  (select reden from public.pias_of_week
    where group_id = 'a6480000-0000-0000-0000-0000000000f1'),
  'bagel', 'G1 krijgt retroactief een pias-rij (bagel) voor de matchweek');
select is(
  (select count(*)::int from public.zwarte_piet
    where group_id = 'a6480000-0000-0000-0000-0000000000f1'),
  1, 'G1 krijgt retroactief een Zwarte Piet');

------------------------------------------------------------------------
-- Verhangen: vergt lidmaatschap van huidige én doelgroep.
------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"a6480000-0000-0000-0000-000000000006","role":"authenticated"}';
select throws_ok(
  $$ select public.set_match_group('a6480000-0000-0000-0000-0000000000aa',
                                   'a6480000-0000-0000-0000-0000000000f2') $$,
  'P0001', 'Alleen een lid van de huidige groep kan deze match loskoppelen',
  'lid van alleen de doelgroep kan de match niet bij G1 weghalen');

set local request.jwt.claims = '{"sub":"a6480000-0000-0000-0000-000000000002","role":"authenticated"}';
select public.set_match_group('a6480000-0000-0000-0000-0000000000aa',
                              'a6480000-0000-0000-0000-0000000000f2');
select is(
  (select group_id from public.matches
    where id = 'a6480000-0000-0000-0000-0000000000aa'),
  'a6480000-0000-0000-0000-0000000000f2'::uuid,
  'lid van beide groepen verhangt de match van G1 naar G2');

reset role;
select is(
  (select count(*)::int from public.pias_of_week
    where group_id = 'a6480000-0000-0000-0000-0000000000f1'),
  0, 'na het verhangen is de pias-rij van G1 opgeruimd');
select is(
  (select reden from public.pias_of_week
    where group_id = 'a6480000-0000-0000-0000-0000000000f2'),
  'bagel', 'de pias-rij is meeverhuisd naar G2');

------------------------------------------------------------------------
-- Loskoppelen door een lid van de huidige groep; alles keert terug.
------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"a6480000-0000-0000-0000-000000000006","role":"authenticated"}';
select public.set_match_group('a6480000-0000-0000-0000-0000000000aa', null);
select is(
  (select group_id from public.matches
    where id = 'a6480000-0000-0000-0000-0000000000aa'),
  null::uuid, 'lid van de huidige groep maakt er weer een losse match van');

-- No-op: zelfde waarde nogmaals zetten faalt niet, ook niet zonder lidmaatschap.
set local request.jwt.claims = '{"sub":"a6480000-0000-0000-0000-000000000009","role":"authenticated"}';
select lives_ok(
  $$ select public.set_match_group('a6480000-0000-0000-0000-0000000000aa', null) $$,
  'ongewijzigde waarde is een stille no-op');

select is(
  (select count(*)::int from public.matches
    where id = 'a6480000-0000-0000-0000-0000000000aa'),
  1, 'na het loskoppelen is de match weer publiek zichtbaar');

reset role;
select is(
  (select count(*)::int from public.pias_of_week
    where group_id in ('a6480000-0000-0000-0000-0000000000f1',
                       'a6480000-0000-0000-0000-0000000000f2')),
  0, 'na het loskoppelen resteert nergens een pias-rij');
select is(
  (select count(*)::int from public.zwarte_piet
    where group_id in ('a6480000-0000-0000-0000-0000000000f1',
                       'a6480000-0000-0000-0000-0000000000f2')),
  0, 'na het loskoppelen resteert geen Zwarte Piet');

select * from finish();

rollback;
