-- pgTAP-tests voor het wijzigen van de bezetting van een wedstrijd (#1327):
-- vervangen, van team wisselen en ruilen tussen twee banen.
--
-- De kern is de poort. Op een gepláánde match mag de hele kring die erbij
-- betrokken is (spelers, groepsleden, aanmaker, groepseigenaar); op een
-- afgeronde blijft het bij de aanmaker en de groepseigenaar, want daar
-- herschrijf je de Elo-geschiedenis van vier mensen.
begin;

select plan(35);

------------------------------------------------------------------------
-- Fixtures.
--
--   a1        groepseigenaar van g1 (en dus aanmaker van alle matches)
--   a2 … a8   groepsleden, staan op de baan
--   a9        groepslid op de bank — de invaller, en tegelijk het bewijs dat
--             een groepsgenoot die niet meespeelt ook mag ingrijpen
--   b1 … b3   leden van een tweede groep
--   x1        buitenstaander zonder groep
------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
values
  ('00000000-0000-0000-0000-000000000000','13270000-0000-0000-0000-0000000000a1','authenticated','authenticated','bz1@test.nl','x',now(),'{}','{"username":"bz1"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','13270000-0000-0000-0000-0000000000a2','authenticated','authenticated','bz2@test.nl','x',now(),'{}','{"username":"bz2"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','13270000-0000-0000-0000-0000000000a3','authenticated','authenticated','bz3@test.nl','x',now(),'{}','{"username":"bz3"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','13270000-0000-0000-0000-0000000000a4','authenticated','authenticated','bz4@test.nl','x',now(),'{}','{"username":"bz4"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','13270000-0000-0000-0000-0000000000a5','authenticated','authenticated','bz5@test.nl','x',now(),'{}','{"username":"bz5"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','13270000-0000-0000-0000-0000000000a6','authenticated','authenticated','bz6@test.nl','x',now(),'{}','{"username":"bz6"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','13270000-0000-0000-0000-0000000000a7','authenticated','authenticated','bz7@test.nl','x',now(),'{}','{"username":"bz7"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','13270000-0000-0000-0000-0000000000a8','authenticated','authenticated','bz8@test.nl','x',now(),'{}','{"username":"bz8"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','13270000-0000-0000-0000-0000000000a9','authenticated','authenticated','bz9@test.nl','x',now(),'{}','{"username":"bz9"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','13270000-0000-0000-0000-0000000000b1','authenticated','authenticated','bzb1@test.nl','x',now(),'{}','{"username":"bzb1"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','13270000-0000-0000-0000-0000000000b2','authenticated','authenticated','bzb2@test.nl','x',now(),'{}','{"username":"bzb2"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','13270000-0000-0000-0000-0000000000b3','authenticated','authenticated','bzb3@test.nl','x',now(),'{}','{"username":"bzb3"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','13270000-0000-0000-0000-0000000000f9','authenticated','authenticated','bzx@test.nl','x',now(),'{}','{"username":"bzx"}',now(),now(),'','','','');

-- De aanmaker wordt door de groepstrigger zelf als eigenaar-lid toegevoegd.
insert into public.groups (id, name, created_by)
values
  ('13270000-0000-0000-0000-0000000000e1','Bezetting één','13270000-0000-0000-0000-0000000000a1'),
  ('13270000-0000-0000-0000-0000000000e2','Bezetting twee','13270000-0000-0000-0000-0000000000a1');

insert into public.group_members (group_id, player_id, role)
values
  ('13270000-0000-0000-0000-0000000000e1','13270000-0000-0000-0000-0000000000a2','member'),
  ('13270000-0000-0000-0000-0000000000e1','13270000-0000-0000-0000-0000000000a3','member'),
  ('13270000-0000-0000-0000-0000000000e1','13270000-0000-0000-0000-0000000000a4','member'),
  ('13270000-0000-0000-0000-0000000000e1','13270000-0000-0000-0000-0000000000a5','member'),
  ('13270000-0000-0000-0000-0000000000e1','13270000-0000-0000-0000-0000000000a6','member'),
  ('13270000-0000-0000-0000-0000000000e1','13270000-0000-0000-0000-0000000000a7','member'),
  ('13270000-0000-0000-0000-0000000000e1','13270000-0000-0000-0000-0000000000a8','member'),
  ('13270000-0000-0000-0000-0000000000e1','13270000-0000-0000-0000-0000000000a9','member'),
  ('13270000-0000-0000-0000-0000000000e2','13270000-0000-0000-0000-0000000000b1','member'),
  ('13270000-0000-0000-0000-0000000000e2','13270000-0000-0000-0000-0000000000b2','member'),
  ('13270000-0000-0000-0000-0000000000e2','13270000-0000-0000-0000-0000000000b3','member');

insert into public.teams (id, player1_id, player2_id)
values
  ('13270000-0000-0000-0000-0000000000c1','13270000-0000-0000-0000-0000000000a1','13270000-0000-0000-0000-0000000000a2'),
  ('13270000-0000-0000-0000-0000000000c2','13270000-0000-0000-0000-0000000000a3','13270000-0000-0000-0000-0000000000a4'),
  ('13270000-0000-0000-0000-0000000000c3','13270000-0000-0000-0000-0000000000a5','13270000-0000-0000-0000-0000000000a6'),
  ('13270000-0000-0000-0000-0000000000c4','13270000-0000-0000-0000-0000000000a7','13270000-0000-0000-0000-0000000000a8'),
  ('13270000-0000-0000-0000-0000000000c5','13270000-0000-0000-0000-0000000000b1','13270000-0000-0000-0000-0000000000b2'),
  ('13270000-0000-0000-0000-0000000000c6','13270000-0000-0000-0000-0000000000b3','13270000-0000-0000-0000-0000000000a1');

-- m1/m2: de twee banen van ronde 1, nog te spelen.
-- m3/m5: al gespeeld. m4: een wedstrijd van de tweede groep.
insert into public.matches
  (id, team_a_id, team_b_id, group_id, round_number, status, created_by, played_at, format)
values
  ('13270000-0000-0000-0000-0000000000d1','13270000-0000-0000-0000-0000000000c1','13270000-0000-0000-0000-0000000000c2',
   '13270000-0000-0000-0000-0000000000e1',1,'scheduled','13270000-0000-0000-0000-0000000000a1',now() + interval '1 day','2v2'),
  ('13270000-0000-0000-0000-0000000000d2','13270000-0000-0000-0000-0000000000c3','13270000-0000-0000-0000-0000000000c4',
   '13270000-0000-0000-0000-0000000000e1',1,'scheduled','13270000-0000-0000-0000-0000000000a1',now() + interval '1 day','2v2'),
  ('13270000-0000-0000-0000-0000000000d3','13270000-0000-0000-0000-0000000000c1','13270000-0000-0000-0000-0000000000c2',
   '13270000-0000-0000-0000-0000000000e1',null,'scheduled','13270000-0000-0000-0000-0000000000a1',now() + interval '1 day','2v2'),
  ('13270000-0000-0000-0000-0000000000d4','13270000-0000-0000-0000-0000000000c5','13270000-0000-0000-0000-0000000000c6',
   '13270000-0000-0000-0000-0000000000e2',1,'scheduled','13270000-0000-0000-0000-0000000000a1',now() + interval '1 day','2v2'),
  ('13270000-0000-0000-0000-0000000000d5','13270000-0000-0000-0000-0000000000c3','13270000-0000-0000-0000-0000000000c4',
   '13270000-0000-0000-0000-0000000000e1',null,'scheduled','13270000-0000-0000-0000-0000000000a1',now() + interval '1 day','2v2');

-- Een tip op m5, gezet zolang hij nog gepland stond.
set local role authenticated;
set local request.jwt.claims = '{"sub":"13270000-0000-0000-0000-0000000000a9","role":"authenticated"}';
insert into public.match_predictions (match_id, player_id, group_id, predicted_team_id)
values ('13270000-0000-0000-0000-0000000000d5','13270000-0000-0000-0000-0000000000a9',
        '13270000-0000-0000-0000-0000000000e1','13270000-0000-0000-0000-0000000000c3');
reset role;

update public.matches
   set status = 'completed',
       winner_team_id = '13270000-0000-0000-0000-0000000000c1',
       score_a = 6, score_b = 3,
       played_at = now() - interval '2 days'
 where id = '13270000-0000-0000-0000-0000000000d3';

update public.matches
   set status = 'completed',
       winner_team_id = '13270000-0000-0000-0000-0000000000c3',
       score_a = 6, score_b = 2,
       played_at = now() - interval '1 day'
 where id = '13270000-0000-0000-0000-0000000000d5';

insert into public.match_points (match_id, set_number, game_number, point_number, won_by_team_id)
values ('13270000-0000-0000-0000-0000000000d3',1,1,1,'13270000-0000-0000-0000-0000000000c1');

create temp table tip_voor as
  select points from public.match_predictions
   where match_id = '13270000-0000-0000-0000-0000000000d5';

-- Wie staat er aan één kant van een wedstrijd? Gesorteerd, zodat de assertie
-- niets zegt over de volgorde binnen het team.
create function pg_temp.bezetting(p_match uuid, p_kant text)
returns uuid[]
language sql
as $$
  select array(
    select s
      from public.matches m
      join public.teams t
        on t.id = case when p_kant = 'a' then m.team_a_id else m.team_b_id end
      cross join lateral unnest(array[t.player1_id, t.player2_id]) as s
     where m.id = p_match and s is not null
     order by s
  );
$$;

create function pg_temp.sorteer(p uuid[])
returns uuid[]
language sql
as $$ select array(select unnest(p) order by 1) $$;

------------------------------------------------------------------------
-- Weigeringen.
------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated"}';
select throws_ok(
  $$ select public.ruil_match_spelers(
       '13270000-0000-0000-0000-0000000000d1','13270000-0000-0000-0000-0000000000a1',
       '13270000-0000-0000-0000-0000000000d2','13270000-0000-0000-0000-0000000000a5') $$,
  'P0001', 'Niet ingelogd', 'zonder sessie ruil je niemand');

set local request.jwt.claims = '{"sub":"13270000-0000-0000-0000-0000000000f9","role":"authenticated"}';
select throws_ok(
  $$ select public.replace_match_player(
       '13270000-0000-0000-0000-0000000000d1','13270000-0000-0000-0000-0000000000a3',
       '13270000-0000-0000-0000-0000000000a9') $$,
  'P0001', 'Alleen de spelers, de groepsleden, de aanmaker of de groepseigenaar kunnen de bezetting wijzigen',
  'een buitenstaander vervangt niemand');
select throws_ok(
  $$ select public.ruil_match_spelers(
       '13270000-0000-0000-0000-0000000000d1','13270000-0000-0000-0000-0000000000a1',
       '13270000-0000-0000-0000-0000000000d2','13270000-0000-0000-0000-0000000000a5') $$,
  'P0001', 'Alleen de spelers, de groepsleden, de aanmaker of de groepseigenaar kunnen de bezetting wijzigen',
  'een buitenstaander ruilt niemand');

-- De kern van de asymmetrie: dezelfde speler mag wél op de geplande match
-- hieronder, maar niet op een die al gespeeld is.
set local request.jwt.claims = '{"sub":"13270000-0000-0000-0000-0000000000a2","role":"authenticated"}';
select throws_ok(
  $$ select public.replace_match_player(
       '13270000-0000-0000-0000-0000000000d3','13270000-0000-0000-0000-0000000000a3',
       '13270000-0000-0000-0000-0000000000a9') $$,
  'P0001', 'Een afgeronde wedstrijd herbezet alleen de aanmaker of de groepseigenaar',
  'een medespeler herschrijft geen gespeelde wedstrijd');

set local request.jwt.claims = '{"sub":"13270000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select throws_ok(
  $$ select public.ruil_match_spelers(
       '13270000-0000-0000-0000-0000000000d1','13270000-0000-0000-0000-0000000000a1',
       '13270000-0000-0000-0000-0000000000d4','13270000-0000-0000-0000-0000000000b1') $$,
  'P0001', 'Ruilen kan alleen tussen wedstrijden van dezelfde groep',
  'ruilen blijft binnen één groep');
select throws_ok(
  $$ select public.ruil_match_spelers(
       '13270000-0000-0000-0000-0000000000d1','13270000-0000-0000-0000-0000000000a1',
       '13270000-0000-0000-0000-0000000000d1','13270000-0000-0000-0000-0000000000a2') $$,
  'P0001', 'Die twee spelers staan al in hetzelfde team',
  'twee teamgenoten ruilen levert niets op');
select throws_ok(
  $$ select public.ruil_match_spelers(
       '13270000-0000-0000-0000-0000000000d1','13270000-0000-0000-0000-0000000000a1',
       '13270000-0000-0000-0000-0000000000d2','13270000-0000-0000-0000-0000000000a1') $$,
  'P0001', 'Kies twee verschillende spelers',
  'jezelf met jezelf ruilen bestaat niet');
select throws_ok(
  $$ select public.ruil_match_spelers(
       '13270000-0000-0000-0000-0000000000d1','13270000-0000-0000-0000-0000000000a1',
       '13270000-0000-0000-0000-0000000000d3','13270000-0000-0000-0000-0000000000a3') $$,
  'P0001', 'Die speler staat al in de andere wedstrijd',
  'niemand komt twee keer in dezelfde wedstrijd te staan');

------------------------------------------------------------------------
-- Vervangen op een geplande wedstrijd: door een medespeler, en door een
-- groepsgenoot die er zelf niet in staat.
------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"13270000-0000-0000-0000-0000000000a2","role":"authenticated"}';
select lives_ok(
  $$ select public.replace_match_player(
       '13270000-0000-0000-0000-0000000000d1','13270000-0000-0000-0000-0000000000a3',
       '13270000-0000-0000-0000-0000000000a9') $$,
  'een medespeler zet de invaller in de plaats van wie afzegde');
select is(
  pg_temp.bezetting('13270000-0000-0000-0000-0000000000d1','b'),
  pg_temp.sorteer(array['13270000-0000-0000-0000-0000000000a9','13270000-0000-0000-0000-0000000000a4']::uuid[]),
  'de invaller staat er, de partner blijft staan');

set local request.jwt.claims = '{"sub":"13270000-0000-0000-0000-0000000000a7","role":"authenticated"}';
select lives_ok(
  $$ select public.replace_match_player(
       '13270000-0000-0000-0000-0000000000d1','13270000-0000-0000-0000-0000000000a9',
       '13270000-0000-0000-0000-0000000000a3') $$,
  'een groepsgenoot van een andere baan draait het terug');
select is(
  pg_temp.bezetting('13270000-0000-0000-0000-0000000000d1','b'),
  pg_temp.sorteer(array['13270000-0000-0000-0000-0000000000a3','13270000-0000-0000-0000-0000000000a4']::uuid[]),
  'en de oorspronkelijke bezetting staat er weer');

------------------------------------------------------------------------
-- Van team wisselen binnen dezelfde wedstrijd.
------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"13270000-0000-0000-0000-0000000000a4","role":"authenticated"}';
select lives_ok(
  $$ select public.ruil_match_spelers(
       '13270000-0000-0000-0000-0000000000d1','13270000-0000-0000-0000-0000000000a1',
       '13270000-0000-0000-0000-0000000000d1','13270000-0000-0000-0000-0000000000a3') $$,
  'twee spelers uit dezelfde wedstrijd wisselen van team');
select is(
  pg_temp.bezetting('13270000-0000-0000-0000-0000000000d1','a'),
  pg_temp.sorteer(array['13270000-0000-0000-0000-0000000000a3','13270000-0000-0000-0000-0000000000a2']::uuid[]),
  'team A kreeg de speler van de overkant');
select is(
  pg_temp.bezetting('13270000-0000-0000-0000-0000000000d1','b'),
  pg_temp.sorteer(array['13270000-0000-0000-0000-0000000000a1','13270000-0000-0000-0000-0000000000a4']::uuid[]),
  'en team B die van team A');

------------------------------------------------------------------------
-- Ruilen tussen twee banen van dezelfde ronde.
------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"13270000-0000-0000-0000-0000000000a9","role":"authenticated"}';
select lives_ok(
  $$ select public.ruil_match_spelers(
       '13270000-0000-0000-0000-0000000000d1','13270000-0000-0000-0000-0000000000a3',
       '13270000-0000-0000-0000-0000000000d2','13270000-0000-0000-0000-0000000000a5') $$,
  'een groepsgenoot ruilt twee spelers tussen de banen');
select is(
  pg_temp.bezetting('13270000-0000-0000-0000-0000000000d1','a'),
  pg_temp.sorteer(array['13270000-0000-0000-0000-0000000000a5','13270000-0000-0000-0000-0000000000a2']::uuid[]),
  'de speler van de andere baan staat nu op deze');
select is(
  pg_temp.bezetting('13270000-0000-0000-0000-0000000000d2','a'),
  pg_temp.sorteer(array['13270000-0000-0000-0000-0000000000a3','13270000-0000-0000-0000-0000000000a6']::uuid[]),
  'en omgekeerd, met beide partners op hun plek');

------------------------------------------------------------------------
-- Afgeronde wedstrijd: de aanmaker mag wél, en alles wat eraan hangt
-- verhuist mee.
------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"13270000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select lives_ok(
  $$ select public.replace_match_player(
       '13270000-0000-0000-0000-0000000000d3','13270000-0000-0000-0000-0000000000a2',
       '13270000-0000-0000-0000-0000000000a9') $$,
  'de aanmaker corrigeert wie er in de gespeelde wedstrijd stond');
reset role;

select is(
  pg_temp.bezetting('13270000-0000-0000-0000-0000000000d3','a'),
  pg_temp.sorteer(array['13270000-0000-0000-0000-0000000000a1','13270000-0000-0000-0000-0000000000a9']::uuid[]),
  'de gecorrigeerde speler staat in het winnende team');
select is(
  (select winner_team_id = team_a_id from public.matches
    where id = '13270000-0000-0000-0000-0000000000d3'),
  true, 'de winnaar wijst mee naar het nieuwe team');
select is(
  (select won_by_team_id from public.match_points
    where match_id = '13270000-0000-0000-0000-0000000000d3'),
  (select team_a_id from public.matches where id = '13270000-0000-0000-0000-0000000000d3'),
  'de puntenlog verwijst mee naar het nieuwe team');
select is(
  (select games from public.player_ratings
    where player_id = '13270000-0000-0000-0000-0000000000a9'),
  1, 'de invaller heeft de gespeelde wedstrijd nu in zijn rating');
select is(
  (select count(*)::int from public.player_ratings
    where player_id = '13270000-0000-0000-0000-0000000000a2'),
  0, 'en wie er niet stond houdt er niets van over');

------------------------------------------------------------------------
-- Ruilen op een afgeronde wedstrijd: mag alleen de aanmaker, en de tips
-- verhuizen mee zonder hun punten te verliezen.
------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"13270000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select lives_ok(
  $$ select public.ruil_match_spelers(
       '13270000-0000-0000-0000-0000000000d5','13270000-0000-0000-0000-0000000000a5',
       '13270000-0000-0000-0000-0000000000d5','13270000-0000-0000-0000-0000000000a7') $$,
  'de aanmaker draait twee spelers om in een gespeelde wedstrijd');
reset role;

select is(
  pg_temp.bezetting('13270000-0000-0000-0000-0000000000d5','a'),
  pg_temp.sorteer(array['13270000-0000-0000-0000-0000000000a7','13270000-0000-0000-0000-0000000000a6']::uuid[]),
  'team A van de gespeelde wedstrijd klopt');
select is(
  pg_temp.bezetting('13270000-0000-0000-0000-0000000000d5','b'),
  pg_temp.sorteer(array['13270000-0000-0000-0000-0000000000a5','13270000-0000-0000-0000-0000000000a8']::uuid[]),
  'en team B ook');
select is(
  (select winner_team_id = team_a_id from public.matches
    where id = '13270000-0000-0000-0000-0000000000d5'),
  true, 'de winnaar blijft aan dezelfde kant van het net');
select is(
  (select predicted_team_id from public.match_predictions
    where match_id = '13270000-0000-0000-0000-0000000000d5'),
  (select team_a_id from public.matches where id = '13270000-0000-0000-0000-0000000000d5'),
  'de tip wijst naar het nieuwe team');
select is(
  (select points from public.match_predictions
    where match_id = '13270000-0000-0000-0000-0000000000d5'),
  (select points from tip_voor),
  'en houdt zijn punten — de tip zat nog steeds juist');

------------------------------------------------------------------------
-- De beheerdersingangen zijn service-role-only. Een `revoke … from public`
-- alleen is niet genoeg: anon en authenticated houden hun eigen grant.
------------------------------------------------------------------------
select is(
  has_function_privilege('authenticated', 'public.admin_vervang_match_speler(uuid,uuid,uuid)', 'execute'),
  false, 'authenticated kan de beheerdersvervanging niet aanroepen');
select is(
  has_function_privilege('anon', 'public.admin_vervang_match_speler(uuid,uuid,uuid)', 'execute'),
  false, 'anon evenmin');
select is(
  has_function_privilege('authenticated', 'public.admin_ruil_match_spelers(uuid,uuid,uuid,uuid)', 'execute'),
  false, 'authenticated kan de beheerdersruil niet aanroepen');
select is(
  has_function_privilege('anon', 'public.admin_ruil_match_spelers(uuid,uuid,uuid,uuid)', 'execute'),
  false, 'anon evenmin');
select is(
  has_function_privilege('authenticated', 'public.ruil_match_spelers(uuid,uuid,uuid,uuid)', 'execute'),
  true, 'de gewone ruil staat wél open voor ingelogde gebruikers');

select * from finish();
rollback;
