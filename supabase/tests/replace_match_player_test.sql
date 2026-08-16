-- pgTAP-tests voor replace_match_player (#681, deel 2): in een afgeronde match
-- een gastdeelnemer vervangen door de speler die er écht stond.
--
-- Scenario: u1 logde een match met "Gast 1" (een hergebruikt gastprofiel).
-- Achteraf blijkt u5 die avond gespeeld te hebben. Na de vervanging telt de
-- match voor u5 mee — inclusief rating — en houdt de toto zijn punten.
begin;

select plan(23);

------------------------------------------------------------------------
-- Fixtures. u1 = groepseigenaar én aanmaker van de match, u2 = partner van
-- de gast, u3/u4 = tegenstanders, u5 = de echte speler, u9 = buitenstaander.
------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
values
  ('00000000-0000-0000-0000-000000000000','b6810000-0000-0000-0000-000000000001','authenticated','authenticated','v1@test.nl','x',now(),'{}','{"username":"v1"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','b6810000-0000-0000-0000-000000000002','authenticated','authenticated','v2@test.nl','x',now(),'{}','{"username":"v2"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','b6810000-0000-0000-0000-000000000003','authenticated','authenticated','v3@test.nl','x',now(),'{}','{"username":"v3"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','b6810000-0000-0000-0000-000000000004','authenticated','authenticated','v4@test.nl','x',now(),'{}','{"username":"v4"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','b6810000-0000-0000-0000-000000000005','authenticated','authenticated','v5@test.nl','x',now(),'{}','{"username":"v5"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','b6810000-0000-0000-0000-000000000009','authenticated','authenticated','v9@test.nl','x',now(),'{}','{"username":"v9"}',now(),now(),'','','','');

insert into public.profiles (id, username, full_name, is_guest, owner_id, discoverable, allow_friend_requests)
values ('b6810000-0000-0000-0000-0000000000a1','gast_1','Gast 1',true,'b6810000-0000-0000-0000-000000000001',false,false);

insert into public.groups (id, name, created_by)
values ('b6810000-0000-0000-0000-0000000000f1','Groep één','b6810000-0000-0000-0000-000000000001');
insert into public.group_members (group_id, player_id, role)
values
  ('b6810000-0000-0000-0000-0000000000f1','b6810000-0000-0000-0000-000000000002','member'),
  ('b6810000-0000-0000-0000-0000000000f1','b6810000-0000-0000-0000-000000000003','member'),
  ('b6810000-0000-0000-0000-0000000000f1','b6810000-0000-0000-0000-000000000004','member'),
  ('b6810000-0000-0000-0000-0000000000f1','b6810000-0000-0000-0000-000000000005','member'),
  ('b6810000-0000-0000-0000-0000000000f1','b6810000-0000-0000-0000-0000000000a1','member');

-- Team A = gast + u2 (wint), team B = u3 + u4.
insert into public.teams (id, player1_id, player2_id)
values
  ('b6810000-0000-0000-0000-0000000000b1','b6810000-0000-0000-0000-0000000000a1','b6810000-0000-0000-0000-000000000002'),
  ('b6810000-0000-0000-0000-0000000000b2','b6810000-0000-0000-0000-000000000003','b6810000-0000-0000-0000-000000000004');

-- Eerst gepland, zodat u3 er echt op kan tippen; daarna afgerond.
insert into public.matches
  (id, team_a_id, team_b_id, group_id, status, created_by, played_at, format)
values
  ('b6810000-0000-0000-0000-0000000000c1','b6810000-0000-0000-0000-0000000000b1','b6810000-0000-0000-0000-0000000000b2',
   'b6810000-0000-0000-0000-0000000000f1','scheduled','b6810000-0000-0000-0000-000000000001', now() + interval '1 day','2v2');

set local role authenticated;
set local request.jwt.claims = '{"sub":"b6810000-0000-0000-0000-000000000003","role":"authenticated"}';
insert into public.match_predictions (match_id, player_id, group_id, predicted_team_id)
values ('b6810000-0000-0000-0000-0000000000c1','b6810000-0000-0000-0000-000000000003',
        'b6810000-0000-0000-0000-0000000000f1','b6810000-0000-0000-0000-0000000000b1');
reset role;

update public.matches
   set status = 'completed',
       winner_team_id = 'b6810000-0000-0000-0000-0000000000b1',
       score_a = 6, score_b = 3,
       played_at = now() - interval '2 days'
 where id = 'b6810000-0000-0000-0000-0000000000c1';

insert into public.match_points (match_id, set_number, game_number, point_number, won_by_team_id)
values ('b6810000-0000-0000-0000-0000000000c1',1,1,1,'b6810000-0000-0000-0000-0000000000b1');

create temp table tip_voor as
  select win_chance, points from public.match_predictions
   where match_id = 'b6810000-0000-0000-0000-0000000000c1';

------------------------------------------------------------------------
-- Baseline.
------------------------------------------------------------------------
select is(
  (select games from public.player_ratings where player_id = 'b6810000-0000-0000-0000-0000000000a1'),
  1, 'de gast heeft de match op zijn naam');
select is(
  (select count(*)::int from public.player_ratings where player_id = 'b6810000-0000-0000-0000-000000000005'),
  0, 'de echte speler heeft nog geen rating');
select cmp_ok(
  (select points::int from tip_voor), '>', 0,
  'de tip op team A stond juist en leverde punten op');

------------------------------------------------------------------------
-- Autorisatie en weigeringen.
------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated"}';
select throws_ok(
  $$ select public.replace_match_player('b6810000-0000-0000-0000-0000000000c1',
       'b6810000-0000-0000-0000-0000000000a1','b6810000-0000-0000-0000-000000000005') $$,
  'P0001', 'Niet ingelogd', 'zonder sessie vervang je niemand');

set local request.jwt.claims = '{"sub":"b6810000-0000-0000-0000-000000000009","role":"authenticated"}';
select throws_ok(
  $$ select public.replace_match_player('b6810000-0000-0000-0000-0000000000c1',
       'b6810000-0000-0000-0000-0000000000a1','b6810000-0000-0000-0000-000000000005') $$,
  'P0001', 'Een afgeronde wedstrijd herbezet alleen de aanmaker of de groepseigenaar',
  'een buitenstaander kan de match niet herschrijven');

-- Ook een gewone deelnemer niet. Sinds #1327 mag de brede kring (spelers,
-- groepsleden) de bezetting van een gepláánde match wijzigen, maar deze match
-- is gespeeld: dan herschrijf je de Elo-geschiedenis van vier mensen, en dat
-- blijft bij de aanmaker en de groepseigenaar.
set local request.jwt.claims = '{"sub":"b6810000-0000-0000-0000-000000000002","role":"authenticated"}';
select throws_ok(
  $$ select public.replace_match_player('b6810000-0000-0000-0000-0000000000c1',
       'b6810000-0000-0000-0000-0000000000a1','b6810000-0000-0000-0000-000000000005') $$,
  'P0001', 'Een afgeronde wedstrijd herbezet alleen de aanmaker of de groepseigenaar',
  'een medespeler mag de opstelling niet herschrijven');

-- En een groepsgenoot die er zelf niet in stond evenmin.
set local request.jwt.claims = '{"sub":"b6810000-0000-0000-0000-000000000005","role":"authenticated"}';
select throws_ok(
  $$ select public.replace_match_player('b6810000-0000-0000-0000-0000000000c1',
       'b6810000-0000-0000-0000-0000000000a1','b6810000-0000-0000-0000-000000000005') $$,
  'P0001', 'Een afgeronde wedstrijd herbezet alleen de aanmaker of de groepseigenaar',
  'een groepsgenoot ook niet — die kring geldt alleen voor geplande wedstrijden');

set local request.jwt.claims = '{"sub":"b6810000-0000-0000-0000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ select public.replace_match_player('b6810000-0000-0000-0000-00000000ffff',
       'b6810000-0000-0000-0000-0000000000a1','b6810000-0000-0000-0000-000000000005') $$,
  'P0001', 'Match niet gevonden', 'onbestaande match geeft een nette fout');

-- Vervangen kan sinds #1327 ook een echt account betreffen, maar alleen wie
-- écht meespeelde: een naam die er niet in staat levert een nette fout op.
select throws_ok(
  $$ select public.replace_match_player('b6810000-0000-0000-0000-0000000000c1',
       'b6810000-0000-0000-0000-000000000005','b6810000-0000-0000-0000-000000000001') $$,
  'P0001', 'Die speler speelde niet in deze match',
  'wie niet meespeelde kun je ook niet vervangen');

select throws_ok(
  $$ select public.replace_match_player('b6810000-0000-0000-0000-0000000000c1',
       'b6810000-0000-0000-0000-0000000000a1','b6810000-0000-0000-0000-000000000004') $$,
  'P0001', 'Die speler staat al in deze match',
  'de vervanger mag niet al meespelen');

------------------------------------------------------------------------
-- De vervanging zelf.
------------------------------------------------------------------------
select lives_ok(
  $$ select public.replace_match_player('b6810000-0000-0000-0000-0000000000c1',
       'b6810000-0000-0000-0000-0000000000a1','b6810000-0000-0000-0000-000000000005') $$,
  'de aanmaker vervangt de gast door de echte speler');
reset role;

select is(
  (select t.player1_id from public.matches m join public.teams t on t.id = m.team_a_id
    where m.id = 'b6810000-0000-0000-0000-0000000000c1'),
  'b6810000-0000-0000-0000-000000000005'::uuid,
  'team A bestaat nu uit de echte speler');
select is(
  (select t.player2_id from public.matches m join public.teams t on t.id = m.team_a_id
    where m.id = 'b6810000-0000-0000-0000-0000000000c1'),
  'b6810000-0000-0000-0000-000000000002'::uuid,
  'de partner staat er nog gewoon in');
select is(
  (select winner_team_id = team_a_id from public.matches
    where id = 'b6810000-0000-0000-0000-0000000000c1'),
  true, 'de winnaar wijst mee naar het nieuwe team');
select isnt(
  (select team_a_id from public.matches where id = 'b6810000-0000-0000-0000-0000000000c1'),
  'b6810000-0000-0000-0000-0000000000b1'::uuid,
  'de oude team-rij is niet ter plekke omgehangen');
select is(
  (select count(*)::int from public.teams where id = 'b6810000-0000-0000-0000-0000000000b1'),
  1, 'het oude team blijft bestaan — andere matches kunnen er nog naar wijzen');
select is(
  (select count(*)::int from public.teams
    where id = 'b6810000-0000-0000-0000-0000000000b1'
      and player1_id = 'b6810000-0000-0000-0000-0000000000a1'),
  1, 'en bevat nog steeds de gast');

select is(
  (select won_by_team_id from public.match_points
    where match_id = 'b6810000-0000-0000-0000-0000000000c1'),
  (select team_a_id from public.matches where id = 'b6810000-0000-0000-0000-0000000000c1'),
  'de puntenlog verwijst mee naar het nieuwe team');

-- De toto: het getipte team verhuist mee en de punten blijven staan.
select is(
  (select predicted_team_id from public.match_predictions
    where match_id = 'b6810000-0000-0000-0000-0000000000c1'),
  (select team_a_id from public.matches where id = 'b6810000-0000-0000-0000-0000000000c1'),
  'de tip wijst naar het nieuwe team');
select is(
  (select points from public.match_predictions
    where match_id = 'b6810000-0000-0000-0000-0000000000c1'),
  (select points from tip_voor),
  'en houdt zijn punten — de tip zat nog steeds juist');

-- Ratings: de match telt nu voor de echte speler en niet meer voor de gast.
select is(
  (select games from public.player_ratings where player_id = 'b6810000-0000-0000-0000-000000000005'),
  1, 'de echte speler heeft de match nu in zijn rating');
select is(
  (select count(*)::int from public.player_ratings where player_id = 'b6810000-0000-0000-0000-0000000000a1'),
  0, 'de gast houdt er niets van over');
select is(
  (select played::int from public.group_player_standings
    where group_id = 'b6810000-0000-0000-0000-0000000000f1'
      and player_id = 'b6810000-0000-0000-0000-000000000005'),
  1, 'en staat in het groepsklassement');

select * from finish();

rollback;
