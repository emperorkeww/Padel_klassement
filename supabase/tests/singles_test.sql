-- pgTAP-tests voor 1v1/singles (#279): teams met een lege player2, de
-- RPC-validatie, de Elo zonder fantoom-partner en de null-safe guards.
--
-- NB: binnen één transactie is now() constant, dus matches die via de RPC's
-- worden aangemaakt krijgen allemaal hetzelfde played_at. Voor deterministische
-- Elo-ketens zetten we played_at daarom na elke aanmaak expliciet.
begin;

select plan(32);

------------------------------------------------------------------------
-- Fixtures (als superuser). De trigger handle_new_user maakt de profielen.
------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
values
  ('00000000-0000-0000-0000-000000000000','d0000000-0000-0000-0000-000000000001','authenticated','authenticated','d1@test.nl','x',now(),'{}','{"username":"d1"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','d0000000-0000-0000-0000-000000000002','authenticated','authenticated','d2@test.nl','x',now(),'{}','{"username":"d2"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','d0000000-0000-0000-0000-000000000003','authenticated','authenticated','d3@test.nl','x',now(),'{}','{"username":"d3"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','d0000000-0000-0000-0000-000000000004','authenticated','authenticated','d4@test.nl','x',now(),'{}','{"username":"d4"}',now(),now(),'','','','');

-- d1 is bevriend met d2 (voor matches buiten groepsverband).
insert into public.friendships (requester_id, addressee_id, status)
values ('d0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000002','accepted');

-- Groep met d1 als eigenaar (trigger voegt d1 toe) + d2, d3 als leden.
insert into public.groups (id, name, created_by)
values ('d0000000-0000-0000-0000-0000000000f0','Singlesgroep','d0000000-0000-0000-0000-000000000001');
insert into public.group_members (group_id, player_id, role)
values
  ('d0000000-0000-0000-0000-0000000000f0','d0000000-0000-0000-0000-000000000002','member'),
  ('d0000000-0000-0000-0000-0000000000f0','d0000000-0000-0000-0000-000000000003','member');

------------------------------------------------------------------------
-- 1. _ensure_team met één speler: aanmaken, dedup en normalisatie.
------------------------------------------------------------------------
select isnt(
  public._ensure_team('d0000000-0000-0000-0000-000000000001', null),
  null, '_ensure_team(d1, null) maakt een singles-team');
select is(
  public._ensure_team('d0000000-0000-0000-0000-000000000001', null),
  (select id from public.teams
    where player1_id = 'd0000000-0000-0000-0000-000000000001' and player2_id is null),
  '_ensure_team(d1, null) dedupt naar hetzelfde team');
select is(
  public._ensure_team(null, 'd0000000-0000-0000-0000-000000000001'),
  (select id from public.teams
    where player1_id = 'd0000000-0000-0000-0000-000000000001' and player2_id is null),
  '_ensure_team(null, d1) normaliseert naar hetzelfde team');
select is(
  (select count(*)::int from public.teams
    where player1_id = 'd0000000-0000-0000-0000-000000000001' and player2_id is null),
  1, 'er bestaat exact één singles-team voor d1');
select isnt(
  public._ensure_team('d0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000002'),
  (select id from public.teams
    where player1_id = 'd0000000-0000-0000-0000-000000000001' and player2_id is null),
  'het dubbelteam d1+d2 is een ander team dan het singles-team van d1');
select throws_ok(
  $$ insert into public.teams (player1_id, player2_id)
     values ('d0000000-0000-0000-0000-000000000001', null) $$,
  '23505');

------------------------------------------------------------------------
-- 2. RPC-validatie: halve teams en dubbele spelers worden geweigerd.
------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"d0000000-0000-0000-0000-000000000001","role":"authenticated"}';

-- Eén tweede speler leeg (a2 gevuld, b2 leeg) is geen geldige speelvorm.
select throws_ok(
  $$ select public.create_completed_match(
       'd0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000002',
       'd0000000-0000-0000-0000-000000000003', null,
       'a', 6::smallint, 3::smallint, null) $$,
  'P0001');

-- Zonder de "is distinct from"-herschrijving zou "p_a1 in (p_a2, ...)" met
-- nulls stil passeren; dezelfde speler aan beide kanten moet een fout geven.
select throws_ok(
  $$ select public.create_completed_match(
       'd0000000-0000-0000-0000-000000000001', null,
       'd0000000-0000-0000-0000-000000000001', null,
       'a', 6::smallint, 3::smallint, null) $$,
  'P0001');

------------------------------------------------------------------------
-- 3. 1v1 loggen + Elo zonder fantoom-partner.
--    Drie keer d1 wint van d2: 1000→1012→1023→1033 (K=24). Met een
--    fantoom-1000-partner in het gemiddelde zou de tweede stap +12 i.p.v.
--    +11 zijn (1024) — dat is de regressie die we hier vastpinnen.
--
--    De uitslagen zijn bewust 6-1 en dus niet nípt (#1005): drie nipte
--    nederlagen op rij zouden d2's derde verlies dempen, en dan pint dit
--    bestand de pechvogel-meter vast in plaats van de Elo zonder fantoom-
--    partner. De marge raakt de Elo zelf niet — die kijkt alleen naar de
--    winnaar — dus de ketens hieronder blijven ongewijzigd.
------------------------------------------------------------------------
create temp table m1 as
  select public.create_completed_match(
    'd0000000-0000-0000-0000-000000000001', null,
    'd0000000-0000-0000-0000-000000000002', null,
    'a', 6::smallint, 1::smallint, null) as id;
update public.matches set played_at = now() + interval '1 day'
 where id = (select id from m1);

select isnt((select id from m1), null, 'create_completed_match maakt een 1v1 aan');
select is(
  (select format from public.matches where id = (select id from m1)),
  '1v1', 'format van een singles-match is 1v1');
select is(
  (select t.player2_id from public.teams t
     join public.matches m on m.team_a_id = t.id
    where m.id = (select id from m1)),
  null::uuid, 'team A van een 1v1 heeft geen tweede speler');
select is(
  (select count(*)::int from public.rating_history where match_id = (select id from m1)),
  2, 'een 1v1 schrijft precies twee history-rijen (geen fantoomspelers)');
select is(
  (select rating from public.player_ratings where player_id = 'd0000000-0000-0000-0000-000000000001'),
  1012, 'winnaar stijgt van 1000 naar 1012 (K=24, gelijke ratings)');
select is(
  (select rating from public.player_ratings where player_id = 'd0000000-0000-0000-0000-000000000002'),
  988, 'verliezer daalt van 1000 naar 988');

create temp table m2 as
  select public.create_completed_match(
    'd0000000-0000-0000-0000-000000000001', null,
    'd0000000-0000-0000-0000-000000000002', null,
    'a', 6::smallint, 1::smallint, null) as id;
update public.matches set played_at = now() + interval '2 days'
 where id = (select id from m2);

select is(
  (select rating from public.player_ratings where player_id = 'd0000000-0000-0000-0000-000000000001'),
  1023, 'tweede winst: 1012 → 1023 (+11; met fantoom-partner zou dit +12 zijn)');
select is(
  (select rating from public.player_ratings where player_id = 'd0000000-0000-0000-0000-000000000002'),
  977, 'tweede verlies: 988 → 977');

create temp table m3 as
  select public.create_completed_match(
    'd0000000-0000-0000-0000-000000000001', null,
    'd0000000-0000-0000-0000-000000000002', null,
    'a', 6::smallint, 1::smallint, null) as id;
update public.matches set played_at = now() + interval '3 days'
 where id = (select id from m3);

select is(
  (select rating from public.player_ratings where player_id = 'd0000000-0000-0000-0000-000000000001'),
  1033, 'derde winst: 1023 → 1033 (+10)');
select is(
  (select rating from public.player_ratings where player_id = 'd0000000-0000-0000-0000-000000000002'),
  967, 'derde verlies: 977 → 967');

------------------------------------------------------------------------
-- 4. 1v1 plannen + prediction_win_chance zonder fantoom-partner.
------------------------------------------------------------------------
create temp table mp as
  select public.create_planned_match(
    'd0000000-0000-0000-0000-000000000001', null,
    'd0000000-0000-0000-0000-000000000002', null,
    now() + interval '10 days', null, null) as id;

select isnt((select id from mp), null, 'create_planned_match maakt een 1v1 aan');
select is(
  (select format from public.matches where id = (select id from mp)),
  '1v1', 'format van een geplande singles-match is 1v1');
-- d1 (1033) tegen d2 (967): 1/(1+10^(-66/400)) = 0.5939. Met fantoom-partners
-- (gemiddeld met 1000) zou dit 0.5473 zijn.
select is(
  public.prediction_win_chance(
    (select id from mp),
    (select team_a_id from public.matches where id = (select id from mp))),
  0.5939, 'winkans van een singles-team komt uit de echte spelersrating');

------------------------------------------------------------------------
-- 5. Klassement-views tellen singles mee zonder phantom-rijen.
------------------------------------------------------------------------
select is(
  (select points::int from public.player_standings
    where player_id = 'd0000000-0000-0000-0000-000000000001'),
  9, 'd1 heeft 9 punten na drie 1v1-winsten');
select is(
  (select played::int from public.player_standings
    where player_id = 'd0000000-0000-0000-0000-000000000001'),
  3, 'd1 heeft 3 gespeelde matches');
select is(
  (select points::int from public.player_standings
    where player_id = 'd0000000-0000-0000-0000-000000000002'),
  0, 'd2 heeft 0 punten na drie 1v1-verliezen');
select is_empty(
  $$ select 1 from public.player_standings where player_id is null $$,
  'geen phantom-rijen voor de lege tweede speler');

------------------------------------------------------------------------
-- 6. Groeps-1v1: smoesjes-guard en zwarte-piet-verlossing zijn null-safe.
------------------------------------------------------------------------
create temp table gm1 as
  select public.create_completed_match(
    'd0000000-0000-0000-0000-000000000001', null,
    'd0000000-0000-0000-0000-000000000002', null,
    'a', 6::smallint, 0::smallint, 'd0000000-0000-0000-0000-0000000000f0') as id;
update public.matches set played_at = now() + interval '4 days'
 where id = (select id from gm1);

select isnt((select id from gm1), null, 'groeps-1v1 aangemaakt (bagel voor d2)');
select is(
  (select holder_id from public.zwarte_piet
    where group_id = 'd0000000-0000-0000-0000-0000000000f0'),
  'd0000000-0000-0000-0000-000000000002'::uuid,
  'd2 draagt de Zwarte Piet na een bagel in een 1v1');

-- De verliezer (d2) mag een smoes plaatsen…
select lives_ok(
  $$ insert into public.match_smoesjes (match_id, player_id, group_id, smoes)
     values ((select id from gm1),
             'd0000000-0000-0000-0000-000000000002',
             'd0000000-0000-0000-0000-0000000000f0',
             'De zon stond in mijn ogen.') $$,
  'verliezer van een 1v1 mag een smoes plaatsen');
-- …maar een groepslid dat niet meespeelde niet. Zonder de "is distinct from"-
-- fix zou "not in (player1_id, null)" naar null evalueren en stil passeren.
select throws_ok(
  $$ insert into public.match_smoesjes (match_id, player_id, group_id, smoes)
     values ((select id from gm1),
             'd0000000-0000-0000-0000-000000000003',
             'd0000000-0000-0000-0000-0000000000f0',
             'Ik deed niet eens mee.') $$,
  'P0001');

-- d2 wint daarna een 1v1 van d3: de drager won → verlost. Ook dit pad is
-- null-safe ("v_holder in (win_p1, null)" zou naar null evalueren).
set local request.jwt.claims = '{"sub":"d0000000-0000-0000-0000-000000000002","role":"authenticated"}';
create temp table gm2 as
  select public.create_completed_match(
    'd0000000-0000-0000-0000-000000000002', null,
    'd0000000-0000-0000-0000-000000000003', null,
    'a', 6::smallint, 4::smallint, 'd0000000-0000-0000-0000-0000000000f0') as id;
update public.matches set played_at = now() + interval '5 days'
 where id = (select id from gm2);

select isnt((select id from gm2), null, 'tweede groeps-1v1 aangemaakt (d2 wint)');
select is_empty(
  $$ select 1 from public.zwarte_piet
      where group_id = 'd0000000-0000-0000-0000-0000000000f0' $$,
  'de drager is verlost na een 1v1-winst (null-safe winnaarscheck)');
select is(
  (select points::int from public.group_player_standings
    where group_id = 'd0000000-0000-0000-0000-0000000000f0'
      and player_id = 'd0000000-0000-0000-0000-000000000002'),
  3, 'd2 heeft 3 punten in het groepsklassement (1 winst, 1 verlies)');

select * from finish();

rollback;
