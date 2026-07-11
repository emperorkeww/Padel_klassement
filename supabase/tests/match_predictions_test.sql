-- pgTAP-tests voor de toto (#116): match_predictions RLS, guards,
-- puntentoekenning en het voorspellersklassement.
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
  ('00000000-0000-0000-0000-000000000000','a0000000-0000-0000-0000-000000000001','authenticated','authenticated','p1@test.nl','x',now(),'{}','{"username":"p1"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','a0000000-0000-0000-0000-000000000002','authenticated','authenticated','p2@test.nl','x',now(),'{}','{"username":"p2"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','a0000000-0000-0000-0000-000000000003','authenticated','authenticated','p3@test.nl','x',now(),'{}','{"username":"p3"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','a0000000-0000-0000-0000-000000000004','authenticated','authenticated','p4@test.nl','x',now(),'{}','{"username":"p4"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','a0000000-0000-0000-0000-000000000005','authenticated','authenticated','p5@test.nl','x',now(),'{}','{"username":"p5"}',now(),now(),'','','','');

-- Groep f0 met p1 als eigenaar (trigger voegt p1 toe) + p2,p3,p4 als leden.
insert into public.groups (id, name, created_by)
values ('a0000000-0000-0000-0000-0000000000f0','Totogroep','a0000000-0000-0000-0000-000000000001');
insert into public.group_members (group_id, player_id, role)
values
  ('a0000000-0000-0000-0000-0000000000f0','a0000000-0000-0000-0000-000000000002','member'),
  ('a0000000-0000-0000-0000-0000000000f0','a0000000-0000-0000-0000-000000000003','member'),
  ('a0000000-0000-0000-0000-0000000000f0','a0000000-0000-0000-0000-000000000004','member');

-- Tweede groep f1 (eigenaar p2) voor de group_id-spoof-test.
insert into public.groups (id, name, created_by)
values ('a0000000-0000-0000-0000-0000000000f1','Spoofgroep','a0000000-0000-0000-0000-000000000002');

-- Teams: A = p1+p2, B = p3+p4, C = p1+p3 (speelt niet mee in de matches).
insert into public.teams (id, player1_id, player2_id)
values
  ('b0000000-0000-0000-0000-00000000000a','a0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000002'),
  ('b0000000-0000-0000-0000-00000000000b','a0000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000004'),
  ('b0000000-0000-0000-0000-00000000000c','a0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000003');

-- m1: geplande groepsmatch (morgen), m2: ad-hoc zonder groep,
-- m3: groepsmatch die al begonnen is.
insert into public.matches (id, team_a_id, team_b_id, status, played_at, group_id, created_by)
values
  ('c0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-00000000000a','b0000000-0000-0000-0000-00000000000b','scheduled', now() + interval '1 day','a0000000-0000-0000-0000-0000000000f0','a0000000-0000-0000-0000-000000000001'),
  ('c0000000-0000-0000-0000-000000000002','b0000000-0000-0000-0000-00000000000a','b0000000-0000-0000-0000-00000000000b','scheduled', now() + interval '1 day', null,'a0000000-0000-0000-0000-000000000001'),
  ('c0000000-0000-0000-0000-000000000003','b0000000-0000-0000-0000-00000000000a','b0000000-0000-0000-0000-00000000000b','scheduled', now() - interval '1 hour','a0000000-0000-0000-0000-0000000000f0','a0000000-0000-0000-0000-000000000001');

------------------------------------------------------------------------
-- prediction_points: staffel 1-4, omgekeerd evenredig met de winkans.
------------------------------------------------------------------------
select is(public.prediction_points(0.75), 1::smallint, 'favoriet 75% levert 1 punt');
select is(public.prediction_points(0.6),  2::smallint, '60% levert 2 punten');
select is(public.prediction_points(0.5),  3::smallint, '50/50 levert 3 punten');
select is(public.prediction_points(0.25), 4::smallint, 'underdog 25% levert 4 punten');
select is(public.prediction_points(0.05), 4::smallint, 'extreme underdog klemt op 4');
select is(public.prediction_points(0.95), 1::smallint, 'extreme favoriet klemt op 1');

------------------------------------------------------------------------
-- Tippen: eigen tip op een geplande groepsmatch, winkans serverside.
------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}';

select lives_ok(
  $$ insert into public.match_predictions (match_id, player_id, group_id, predicted_team_id)
     values ('c0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000002',
             'a0000000-0000-0000-0000-0000000000f0','b0000000-0000-0000-0000-00000000000a') $$,
  'lid tipt op een geplande groepsmatch'
);

-- Zonder gespeelde matches staat iedereen op basisrating: winkans 0.5.
select is(
  (select win_chance from public.match_predictions
    where match_id = 'c0000000-0000-0000-0000-000000000001'
      and player_id = 'a0000000-0000-0000-0000-000000000002'),
  0.5, 'win_chance is serverside gesnapshot (0.5 bij gelijke ratings)'
);
select is(
  (select points from public.match_predictions
    where match_id = 'c0000000-0000-0000-0000-000000000001'
      and player_id = 'a0000000-0000-0000-0000-000000000002'),
  null, 'tip is nog niet beoordeeld (points null)'
);

-- win_chance en points zijn niet schrijfbaar voor gebruikers (kolomgrants).
select throws_ok(
  $$ insert into public.match_predictions (match_id, player_id, group_id, predicted_team_id, win_chance)
     values ('c0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000002',
             'a0000000-0000-0000-0000-0000000000f0','b0000000-0000-0000-0000-00000000000a', 0.01) $$,
  '42501'
);
select throws_ok(
  $$ update public.match_predictions set points = 99
     where match_id = 'c0000000-0000-0000-0000-000000000001' $$,
  '42501'
);

-- Niet-lid p5: ziet niets en mag niet tippen.
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000005","role":"authenticated"}';
select is(
  (select count(*)::int from public.match_predictions),
  0, 'niet-lid ziet geen tips'
);
select throws_ok(
  $$ insert into public.match_predictions (match_id, player_id, group_id, predicted_team_id)
     values ('c0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000005',
             'a0000000-0000-0000-0000-0000000000f0','b0000000-0000-0000-0000-00000000000a') $$,
  '42501'
);

-- p3 tipt team B; leden zien elkaars tips.
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000003","role":"authenticated"}';
select lives_ok(
  $$ insert into public.match_predictions (match_id, player_id, group_id, predicted_team_id)
     values ('c0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000003',
             'a0000000-0000-0000-0000-0000000000f0','b0000000-0000-0000-0000-00000000000b') $$,
  'tweede lid tipt het andere team'
);
select is(
  (select count(*)::int from public.match_predictions
    where match_id = 'c0000000-0000-0000-0000-000000000001'),
  2, 'leden zien alle tips van de groep'
);

-- Tippen namens een ander is geblokkeerd (RLS).
select throws_ok(
  $$ insert into public.match_predictions (match_id, player_id, group_id, predicted_team_id)
     values ('c0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000004',
             'a0000000-0000-0000-0000-0000000000f0','b0000000-0000-0000-0000-00000000000a') $$,
  '42501'
);

-- Guard-checks (p2): ad-hoc match, gestarte match, vreemd team, group-spoof.
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}';
select throws_ok(
  $$ insert into public.match_predictions (match_id, player_id, group_id, predicted_team_id)
     values ('c0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000002',
             'a0000000-0000-0000-0000-0000000000f0','b0000000-0000-0000-0000-00000000000a') $$,
  'P0001'
);
select throws_ok(
  $$ insert into public.match_predictions (match_id, player_id, group_id, predicted_team_id)
     values ('c0000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000002',
             'a0000000-0000-0000-0000-0000000000f0','b0000000-0000-0000-0000-00000000000a') $$,
  'P0001'
);
select throws_ok(
  $$ insert into public.match_predictions (match_id, player_id, group_id, predicted_team_id)
     values ('c0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000002',
             'a0000000-0000-0000-0000-0000000000f0','b0000000-0000-0000-0000-00000000000c') $$,
  'P0001'
);
select throws_ok(
  $$ insert into public.match_predictions (match_id, player_id, group_id, predicted_team_id)
     values ('c0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000002',
             'a0000000-0000-0000-0000-0000000000f1','b0000000-0000-0000-0000-00000000000a') $$,
  'P0001'
);

-- Hertippen kan tot de start (upsert-pad: update van de eigen rij).
select lives_ok(
  $$ update public.match_predictions
       set predicted_team_id = 'b0000000-0000-0000-0000-00000000000b'
     where match_id = 'c0000000-0000-0000-0000-000000000001'
       and player_id = 'a0000000-0000-0000-0000-000000000002';
     update public.match_predictions
       set predicted_team_id = 'b0000000-0000-0000-0000-00000000000a'
     where match_id = 'c0000000-0000-0000-0000-000000000001'
       and player_id = 'a0000000-0000-0000-0000-000000000002' $$,
  'hertippen voor de start kan'
);

reset role;

------------------------------------------------------------------------
-- Beoordeling: match afronden kent punten toe; correcties herbeoordelen.
------------------------------------------------------------------------
update public.matches
   set status = 'completed', winner_team_id = 'b0000000-0000-0000-0000-00000000000a',
       score_a = 6, score_b = 3, played_at = now()
 where id = 'c0000000-0000-0000-0000-000000000001';

select is(
  (select points from public.match_predictions
    where match_id = 'c0000000-0000-0000-0000-000000000001'
      and player_id = 'a0000000-0000-0000-0000-000000000002'),
  3::smallint, 'juiste tip (winkans 0.5) levert 3 punten'
);
select is(
  (select points from public.match_predictions
    where match_id = 'c0000000-0000-0000-0000-000000000001'
      and player_id = 'a0000000-0000-0000-0000-000000000003'),
  0::smallint, 'foute tip levert 0 punten'
);

-- Beoordeelde tips zijn vergrendeld.
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}';
select throws_ok(
  $$ delete from public.match_predictions
     where match_id = 'c0000000-0000-0000-0000-000000000001'
       and player_id = 'a0000000-0000-0000-0000-000000000002' $$,
  'P0001'
);
reset role;

-- Winnaarscorrectie draait de punten om.
update public.matches
   set winner_team_id = 'b0000000-0000-0000-0000-00000000000b', score_a = 3, score_b = 6
 where id = 'c0000000-0000-0000-0000-000000000001';
select is(
  (select points from public.match_predictions
    where match_id = 'c0000000-0000-0000-0000-000000000001'
      and player_id = 'a0000000-0000-0000-0000-000000000002'),
  0::smallint, 'na winnaarscorrectie is de eerdere juiste tip 0 punten'
);
select is(
  (select points from public.match_predictions
    where match_id = 'c0000000-0000-0000-0000-000000000001'
      and player_id = 'a0000000-0000-0000-0000-000000000003'),
  3::smallint, 'na winnaarscorrectie krijgt de andere tipper de punten'
);

-- Correctie naar gelijkspel: niemand punten.
update public.matches
   set winner_team_id = null, score_a = 6, score_b = 6
 where id = 'c0000000-0000-0000-0000-000000000001';
select is(
  (select coalesce(sum(points), -1)::int from public.match_predictions
    where match_id = 'c0000000-0000-0000-0000-000000000001'),
  0, 'gelijkspel: alle tips 0 punten'
);

-- Afronding terugdraaien heropent de beoordeling.
update public.matches
   set status = 'scheduled', winner_team_id = null, score_a = null, score_b = null
 where id = 'c0000000-0000-0000-0000-000000000001';
select is(
  (select count(*)::int from public.match_predictions
    where match_id = 'c0000000-0000-0000-0000-000000000001'
      and points is null),
  2, 'teruggedraaide match: tips weer onbeoordeeld'
);

------------------------------------------------------------------------
-- Voorspellersklassement (view) + cascades.
------------------------------------------------------------------------
update public.matches
   set status = 'completed', winner_team_id = 'b0000000-0000-0000-0000-00000000000a',
       score_a = 6, score_b = 3
 where id = 'c0000000-0000-0000-0000-000000000001';

select results_eq(
  $$ select predicted::int, correct::int, points::int
       from public.group_prediction_standings
      where group_id = 'a0000000-0000-0000-0000-0000000000f0'
        and player_id = 'a0000000-0000-0000-0000-000000000002' $$,
  $$ values (1, 1, 3) $$,
  'klassement: p2 heeft 1 tip, 1 juist, 3 punten'
);
select results_eq(
  $$ select predicted::int, correct::int, points::int
       from public.group_prediction_standings
      where group_id = 'a0000000-0000-0000-0000-0000000000f0'
        and player_id = 'a0000000-0000-0000-0000-000000000003' $$,
  $$ values (1, 0, 0) $$,
  'klassement: p3 heeft 1 tip, 0 juist, 0 punten'
);

-- Match verwijderen: tips cascaden weg, ook al zijn ze vergrendeld.
delete from public.matches where id = 'c0000000-0000-0000-0000-000000000001';
select is(
  (select count(*)::int from public.match_predictions),
  0, 'match verwijderd: tips zijn weg (cascade door de delete-guard heen)'
);

-- Groep verwijderen: tips cascaden weg via group_id, ook als de match blijft.
insert into public.matches (id, team_a_id, team_b_id, status, played_at, group_id, created_by)
values ('c0000000-0000-0000-0000-000000000004','b0000000-0000-0000-0000-00000000000a','b0000000-0000-0000-0000-00000000000b','scheduled', now() + interval '1 day','a0000000-0000-0000-0000-0000000000f0','a0000000-0000-0000-0000-000000000001');

set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000003","role":"authenticated"}';
insert into public.match_predictions (match_id, player_id, group_id, predicted_team_id)
values ('c0000000-0000-0000-0000-000000000004','a0000000-0000-0000-0000-000000000003',
        'a0000000-0000-0000-0000-0000000000f0','b0000000-0000-0000-0000-00000000000b');
reset role;

update public.matches
   set status = 'completed', winner_team_id = 'b0000000-0000-0000-0000-00000000000b',
       score_a = 3, score_b = 6
 where id = 'c0000000-0000-0000-0000-000000000004';

delete from public.groups where id = 'a0000000-0000-0000-0000-0000000000f0';
select is(
  (select count(*)::int from public.match_predictions),
  0, 'groep verwijderd: tips zijn weg terwijl de match blijft bestaan'
);

select * from finish();

rollback;
