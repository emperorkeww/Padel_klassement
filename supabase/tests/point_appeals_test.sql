-- pgTAP-tests voor Rudy's VAR (#1025): de guards op point_appeals en
-- point_appeal_votes, de stemtelling, en — het echte werk — of de uitslag én de
-- ratings kloppen ná een toegekend beroep, inclusief het geval waarin de
-- winnaar van de match omdraait.
begin;

select plan(44);

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
  ('00000000-0000-0000-0000-000000000000','d0000000-0000-0000-0000-000000000001','authenticated','authenticated','var1@test.nl','x',now(),'{}','{"username":"var1"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','d0000000-0000-0000-0000-000000000002','authenticated','authenticated','var2@test.nl','x',now(),'{}','{"username":"var2"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','d0000000-0000-0000-0000-000000000003','authenticated','authenticated','var3@test.nl','x',now(),'{}','{"username":"var3"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','d0000000-0000-0000-0000-000000000004','authenticated','authenticated','var4@test.nl','x',now(),'{}','{"username":"var4"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','d0000000-0000-0000-0000-000000000005','authenticated','authenticated','var5@test.nl','x',now(),'{}','{"username":"var5"}',now(),now(),'','','','');

-- Een gast: een profiel zonder account. Kan nooit stemmen.
insert into public.profiles (id, username, full_name, is_guest, owner_id)
values ('d0000000-0000-0000-0000-00000000000a','varGast','Gast','true','d0000000-0000-0000-0000-000000000001');

-- Teams: A = 1+2, B = 3+4. S1/S2 = singles (speler 1 tegen de gast).
insert into public.teams (id, player1_id, player2_id)
values
  ('e0000000-0000-0000-0000-00000000000a','d0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000002'),
  ('e0000000-0000-0000-0000-00000000000b','d0000000-0000-0000-0000-000000000003','d0000000-0000-0000-0000-000000000004'),
  ('e0000000-0000-0000-0000-00000000000c','d0000000-0000-0000-0000-000000000001',null),
  ('e0000000-0000-0000-0000-00000000000d','d0000000-0000-0000-0000-00000000000a',null);

-- m1 t/m m9. Alles op dezelfde speeldag (now() - 1 uur), behalve m4 dat buiten
-- het venster van 24 u valt en m3 dat nog gepland staat.
insert into public.matches (
  id, team_a_id, team_b_id, status, winner_team_id,
  score_a, score_b, set_scores, format, played_at, created_by
)
values
  -- m1: krap gewonnen door A. Eén punt draait de winnaar om.
  ('f0000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-00000000000a','e0000000-0000-0000-0000-00000000000b','completed','e0000000-0000-0000-0000-00000000000a',16,15,null,'2v2',now() - interval '1 hour','d0000000-0000-0000-0000-000000000001'),
  -- m2: mét set-stand.
  ('f0000000-0000-0000-0000-000000000002','e0000000-0000-0000-0000-00000000000a','e0000000-0000-0000-0000-00000000000b','completed','e0000000-0000-0000-0000-00000000000a',6,4,'[[6,4]]','2v2',now() - interval '1 hour','d0000000-0000-0000-0000-000000000001'),
  -- m3: nog niet gespeeld.
  ('f0000000-0000-0000-0000-000000000003','e0000000-0000-0000-0000-00000000000a','e0000000-0000-0000-0000-00000000000b','scheduled',null,null,null,null,'2v2',now() + interval '1 day','d0000000-0000-0000-0000-000000000001'),
  -- m4: buiten het venster.
  ('f0000000-0000-0000-0000-000000000004','e0000000-0000-0000-0000-00000000000a','e0000000-0000-0000-0000-00000000000b','completed','e0000000-0000-0000-0000-00000000000a',5,3,null,'2v2',now() - interval '30 hours','d0000000-0000-0000-0000-000000000001'),
  -- m5: singles tegen een gast — niemand om te overtuigen.
  ('f0000000-0000-0000-0000-000000000005','e0000000-0000-0000-0000-00000000000c','e0000000-0000-0000-0000-00000000000d','completed','e0000000-0000-0000-0000-00000000000c',6,2,null,'1v1',now() - interval '1 hour','d0000000-0000-0000-0000-000000000001'),
  -- m6: tweede beroep van dezelfde speler op dezelfde speeldag (tegoed).
  ('f0000000-0000-0000-0000-000000000006','e0000000-0000-0000-0000-00000000000a','e0000000-0000-0000-0000-00000000000b','completed','e0000000-0000-0000-0000-00000000000a',10,2,null,'2v2',now() - interval '1 hour','d0000000-0000-0000-0000-000000000001'),
  -- m7: wordt afgewezen.
  ('f0000000-0000-0000-0000-000000000007','e0000000-0000-0000-0000-00000000000a','e0000000-0000-0000-0000-00000000000b','completed','e0000000-0000-0000-0000-00000000000a',12,8,null,'2v2',now() - interval '1 hour','d0000000-0000-0000-0000-000000000001'),
  -- m8: de uitslag wijzigt terwijl het beroep openstaat.
  ('f0000000-0000-0000-0000-000000000008','e0000000-0000-0000-0000-00000000000a','e0000000-0000-0000-0000-00000000000b','completed','e0000000-0000-0000-0000-00000000000a',9,4,null,'2v2',now() - interval '1 hour','d0000000-0000-0000-0000-000000000001'),
  -- m9: er wordt niet gestemd; het venster loopt af.
  ('f0000000-0000-0000-0000-000000000009','e0000000-0000-0000-0000-00000000000a','e0000000-0000-0000-0000-00000000000b','completed','e0000000-0000-0000-0000-00000000000a',7,6,null,'2v2',now() - interval '1 hour','d0000000-0000-0000-0000-000000000001'),
  -- m10: ruim gewonnen door A; één punt erbij draait de winnaar niet om.
  ('f0000000-0000-0000-0000-000000000010','e0000000-0000-0000-0000-00000000000a','e0000000-0000-0000-0000-00000000000b','completed','e0000000-0000-0000-0000-00000000000a',20,10,null,'2v2',now() - interval '1 hour','d0000000-0000-0000-0000-000000000001');

------------------------------------------------------------------------
-- Guard: wanneer mag er betwist worden.
------------------------------------------------------------------------
select throws_ok(
  $$ insert into public.point_appeals (match_id, claimant_id, reden)
     values ('f0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000005','ons-punt') $$,
  'alleen spelers uit deze match kunnen betwisten',
  'een buitenstaander kan niet betwisten'
);

select throws_ok(
  $$ insert into public.point_appeals (match_id, claimant_id, reden)
     values ('f0000000-0000-0000-0000-000000000003','d0000000-0000-0000-0000-000000000003','ons-punt') $$,
  'je kunt alleen een afgeronde match betwisten',
  'een geplande match valt niets te betwisten'
);

select throws_ok(
  $$ insert into public.point_appeals (match_id, claimant_id, reden)
     values ('f0000000-0000-0000-0000-000000000004','d0000000-0000-0000-0000-000000000003','ons-punt') $$,
  'het VAR-venster van 24 uur is gesloten',
  'na 24 uur is de historie dicht'
);

select throws_ok(
  $$ insert into public.point_appeals (match_id, claimant_id, reden)
     values ('f0000000-0000-0000-0000-000000000002','d0000000-0000-0000-0000-000000000003','ons-punt') $$,
  'geef aan in welke set het punt viel',
  'met een set-stand moet de set erbij'
);

select throws_ok(
  $$ insert into public.point_appeals (match_id, claimant_id, set_number, reden)
     values ('f0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000003',1,'ons-punt') $$,
  'deze match heeft geen set-stand',
  'zonder set-stand hoort er geen set bij'
);

select throws_ok(
  $$ insert into public.point_appeals (match_id, claimant_id, reden)
     values ('f0000000-0000-0000-0000-000000000005','d0000000-0000-0000-0000-000000000001','ons-punt') $$,
  'er is niemand die over dit beroep kan stemmen',
  'tegen alleen gasten valt niets te winnen'
);

------------------------------------------------------------------------
-- Het beroep zelf: serverside kolommen en één open zaak per match.
------------------------------------------------------------------------
insert into public.point_appeals (id, match_id, claimant_id, reden, toelichting)
values ('11111111-0000-0000-0000-000000000001','f0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000003','ons-punt','die bal was echt binnen');

select is(
  (select status from public.point_appeals where id = '11111111-0000-0000-0000-000000000001'),
  'open', 'een nieuw beroep staat open'
);

select is(
  (select array[snapshot_a, snapshot_b] from public.point_appeals
    where id = '11111111-0000-0000-0000-000000000001'),
  array[16, 15]::smallint[], 'de stand is als snapshot vastgelegd'
);

select is(
  (select play_date from public.point_appeals where id = '11111111-0000-0000-0000-000000000001'),
  ((now() - interval '1 hour') at time zone 'Europe/Brussels')::date,
  'de speeldag staat in clubtijd'
);

select ok(
  (select votes_close_at > now() from public.point_appeals
    where id = '11111111-0000-0000-0000-000000000001'),
  'het stemvenster loopt nog'
);

select throws_ok(
  $$ insert into public.point_appeals (match_id, claimant_id, reden)
     values ('f0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000004','buiten') $$,
  '23505',
  null,
  'er kan maar één beroep tegelijk openstaan per match'
);

-- Tweede beroep van dezelfde speler op dezelfde speeldag, maar op een ándere
-- match: dat mag openstaan — het tegoed gaat pas op bij een toekenning.
select lives_ok(
  $$ insert into public.point_appeals (id, match_id, claimant_id, reden)
     values ('11111111-0000-0000-0000-000000000006','f0000000-0000-0000-0000-000000000006','d0000000-0000-0000-0000-000000000003','net') $$,
  'een tweede beroep op een andere match van dezelfde dag mag openstaan'
);

------------------------------------------------------------------------
-- Stemmen: wie mag, en wanneer valt de uitspraak.
------------------------------------------------------------------------
select throws_ok(
  $$ insert into public.point_appeal_votes (appeal_id, voter_id, akkoord)
     values ('11111111-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000003', true) $$,
  'je stemt niet over je eigen beroep',
  'de klager stemt niet mee'
);

select throws_ok(
  $$ insert into public.point_appeal_votes (appeal_id, voter_id, akkoord)
     values ('11111111-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000005', true) $$,
  'alleen de andere spelers uit deze match kunnen stemmen',
  'een buitenstaander stemt niet mee'
);

-- Eén stem vóór van de drie: nog niets beslist.
insert into public.point_appeal_votes (appeal_id, voter_id, akkoord)
values ('11111111-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000001', true);

select is(
  (select status from public.point_appeals where id = '11111111-0000-0000-0000-000000000001'),
  'open', 'één stem van de drie beslist nog niets'
);

-- De tweede stem vóór maakt de meerderheid.
insert into public.point_appeal_votes (appeal_id, voter_id, akkoord)
values ('11111111-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000004', true);

select is(
  (select status from public.point_appeals where id = '11111111-0000-0000-0000-000000000001'),
  'toegekend', 'een meerderheid van de overige deelnemers kent het beroep toe'
);

select isnt(
  (select resolved_at from public.point_appeals where id = '11111111-0000-0000-0000-000000000001'),
  null, 'de uitspraak is gedateerd'
);

------------------------------------------------------------------------
-- De correctie: score, winnaar en de hele afgeleide keten.
------------------------------------------------------------------------
select is(
  (select array[score_a, score_b] from public.matches
    where id = 'f0000000-0000-0000-0000-000000000001'),
  array[15, 16]::smallint[], 'het punt is verschoven: 16-15 wordt 15-16'
);

select is(
  (select winner_team_id from public.matches where id = 'f0000000-0000-0000-0000-000000000001'),
  'e0000000-0000-0000-0000-00000000000b'::uuid,
  'de winnaar van de match is omgedraaid'
);

select is(
  (select count(*)::int from public.rating_history
    where match_id = 'f0000000-0000-0000-0000-000000000001'
      and player_id = 'd0000000-0000-0000-0000-000000000003'
      and delta > 0),
  1, 'de nieuwe winnaar heeft rating gewonnen op deze match'
);

select ok(
  (select delta from public.rating_history
    where match_id = 'f0000000-0000-0000-0000-000000000001'
      and player_id = 'd0000000-0000-0000-0000-000000000001') < 0,
  'en de verliezer levert er rating op in'
);

------------------------------------------------------------------------
-- Toekenning zonder winnaarwissel. De Elo-kern kijkt alleen naar
-- winner_team_id en niet naar de marge (zie 09_ratings.sql), dus hier hoort
-- exact niets aan het klassement te veranderen. Een groene test die "er
-- verandert niets" bewijst is hier de bedoeling, geen kapotte test.
------------------------------------------------------------------------
create temp table elo_voor as
  select player_id, rating from public.player_ratings;

insert into public.point_appeals (id, match_id, claimant_id, reden)
values ('11111111-0000-0000-0000-000000000010','f0000000-0000-0000-0000-000000000010','d0000000-0000-0000-0000-000000000002','buiten');

insert into public.point_appeal_votes (appeal_id, voter_id, akkoord)
values
  ('11111111-0000-0000-0000-000000000010','d0000000-0000-0000-0000-000000000003', true),
  ('11111111-0000-0000-0000-000000000010','d0000000-0000-0000-0000-000000000004', true);

select is(
  (select array[score_a, score_b] from public.matches
    where id = 'f0000000-0000-0000-0000-000000000010'),
  array[21, 9]::smallint[], 'het punt verschuift ook als de winnaar dezelfde blijft'
);

select is(
  (select winner_team_id from public.matches where id = 'f0000000-0000-0000-0000-000000000010'),
  'e0000000-0000-0000-0000-00000000000a'::uuid, 'de winnaar blijft staan'
);

select is(
  (select count(*)::int from public.player_ratings r
     join elo_voor v using (player_id)
    where r.rating is distinct from v.rating),
  0, 'en geen enkele rating beweegt: de marge telt niet mee'
);

------------------------------------------------------------------------
-- Het tegoed: de groep geeft je gelijk, maar je VAR is op.
------------------------------------------------------------------------
insert into public.point_appeal_votes (appeal_id, voter_id, akkoord)
values
  ('11111111-0000-0000-0000-000000000006','d0000000-0000-0000-0000-000000000001', true),
  ('11111111-0000-0000-0000-000000000006','d0000000-0000-0000-0000-000000000002', true);

select is(
  (select status from public.point_appeals where id = '11111111-0000-0000-0000-000000000006'),
  'tegoed-op', 'een tweede toekenning op dezelfde speeldag valt op het tegoed'
);

select is(
  (select array[score_a, score_b] from public.matches
    where id = 'f0000000-0000-0000-0000-000000000006'),
  array[10, 2]::smallint[], 'en die uitslag blijft dus ongemoeid'
);

------------------------------------------------------------------------
-- Afwijzing: gelijkspel of meerderheid tegen laat de uitslag staan.
------------------------------------------------------------------------
insert into public.point_appeals (id, match_id, claimant_id, reden)
values ('11111111-0000-0000-0000-000000000007','f0000000-0000-0000-0000-000000000007','d0000000-0000-0000-0000-000000000001','dubbele-stuit');

insert into public.point_appeal_votes (appeal_id, voter_id, akkoord)
values
  ('11111111-0000-0000-0000-000000000007','d0000000-0000-0000-0000-000000000003', false),
  ('11111111-0000-0000-0000-000000000007','d0000000-0000-0000-0000-000000000004', false);

select is(
  (select status from public.point_appeals where id = '11111111-0000-0000-0000-000000000007'),
  'afgewezen', 'een meerderheid tegen wijst het beroep af'
);

select is(
  (select array[score_a, score_b] from public.matches
    where id = 'f0000000-0000-0000-0000-000000000007'),
  array[12, 8]::smallint[], 'een afgewezen beroep laat de uitslag staan'
);

select throws_ok(
  $$ insert into public.point_appeal_votes (appeal_id, voter_id, akkoord)
     values ('11111111-0000-0000-0000-000000000007','d0000000-0000-0000-0000-000000000002', true) $$,
  'over dit beroep is al uitspraak gedaan',
  'na de uitspraak kan er niet meer gestemd worden'
);

------------------------------------------------------------------------
-- De uitslag wijzigt terwijl het beroep openstaat (#978/#681).
------------------------------------------------------------------------
insert into public.point_appeals (id, match_id, claimant_id, reden)
values ('11111111-0000-0000-0000-000000000008','f0000000-0000-0000-0000-000000000008','d0000000-0000-0000-0000-000000000001','verkeerd-ingetikt');

update public.matches set score_a = 10
 where id = 'f0000000-0000-0000-0000-000000000008';

insert into public.point_appeal_votes (appeal_id, voter_id, akkoord)
values
  ('11111111-0000-0000-0000-000000000008','d0000000-0000-0000-0000-000000000002', true),
  ('11111111-0000-0000-0000-000000000008','d0000000-0000-0000-0000-000000000003', true);

select is(
  (select status from public.point_appeals where id = '11111111-0000-0000-0000-000000000008'),
  'verlopen', 'een beroep op een intussen gewijzigde stand vervalt'
);

select is(
  (select array[score_a, score_b] from public.matches
    where id = 'f0000000-0000-0000-0000-000000000008'),
  array[10, 4]::smallint[], 'en stapelt dus geen tweede correctie'
);

------------------------------------------------------------------------
-- Zwijgen is geen instemming: het venster loopt af.
------------------------------------------------------------------------
insert into public.point_appeals (id, match_id, claimant_id, reden)
values ('11111111-0000-0000-0000-000000000009','f0000000-0000-0000-0000-000000000009','d0000000-0000-0000-0000-000000000001','buiten');

update public.point_appeals set votes_close_at = now() - interval '1 minute'
 where id = '11111111-0000-0000-0000-000000000009';

select is(
  (select public.expire_point_appeals()),
  1, 'de cron sluit precies het verlopen beroep'
);

select is(
  (select status from public.point_appeals where id = '11111111-0000-0000-0000-000000000009'),
  'afgewezen', 'niet gestemd binnen het venster = afgewezen'
);

------------------------------------------------------------------------
-- Toekenning mét set-stand: kopscore en set bewegen samen.
------------------------------------------------------------------------
insert into public.point_appeals (id, match_id, claimant_id, set_number, reden)
values ('11111111-0000-0000-0000-000000000002','f0000000-0000-0000-0000-000000000002','d0000000-0000-0000-0000-000000000004',1,'net');

insert into public.point_appeal_votes (appeal_id, voter_id, akkoord)
values
  ('11111111-0000-0000-0000-000000000002','d0000000-0000-0000-0000-000000000001', true),
  ('11111111-0000-0000-0000-000000000002','d0000000-0000-0000-0000-000000000002', true);

select is(
  (select status from public.point_appeals where id = '11111111-0000-0000-0000-000000000002'),
  'toegekend', 'ook een beroep met set-stand wordt toegekend'
);

select is(
  (select array[score_a, score_b] from public.matches
    where id = 'f0000000-0000-0000-0000-000000000002'),
  array[5, 5]::smallint[], 'de kopscore is verschoven'
);

select is(
  (select set_scores from public.matches where id = 'f0000000-0000-0000-0000-000000000002'),
  '[[5, 5]]'::jsonb, 'en de set-stand liep mee'
);

select is(
  (select winner_team_id from public.matches where id = 'f0000000-0000-0000-0000-000000000002'),
  null, 'een gelijke stand na de correctie is een gelijkspel'
);

------------------------------------------------------------------------
-- RLS: wie ziet de zaak.
------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"d0000000-0000-0000-0000-000000000002","role":"authenticated"}';

select ok(
  (select count(*) > 0 from public.point_appeals
    where match_id = 'f0000000-0000-0000-0000-000000000001'),
  'een deelnemer ziet het beroep op zijn match'
);

select ok(
  (select count(*) > 0 from public.point_appeal_votes
    where appeal_id = '11111111-0000-0000-0000-000000000001'),
  'en ziet met naam wie wat stemde'
);

set local request.jwt.claims = '{"sub":"d0000000-0000-0000-0000-000000000005","role":"authenticated"}';

select is(
  (select count(*)::int from public.point_appeals),
  0, 'een buitenstaander ziet geen enkel beroep'
);

-- Op naam van een deelnemer, zodat de guard tevreden is en de RLS-policy het
-- laatste woord heeft: claimant_id moet je eigen id zijn. (Zet je er een
-- niet-deelnemer neer, dan spreekt de BEFORE-trigger eerder dan RLS en krijg je
-- de guard-melding uit de eerste test hierboven.)
select throws_ok(
  $$ insert into public.point_appeals (match_id, claimant_id, reden)
     values ('f0000000-0000-0000-0000-000000000009','d0000000-0000-0000-0000-000000000001','buiten') $$,
  '42501',
  null,
  'en dient geen beroep in op andermans naam'
);

-- De uitspraak ligt buiten bereik van de client: geen update-policy, geen
-- update-grant, en de RPC is niet uitvoerbaar voor authenticated.
select throws_ok(
  $$ update public.point_appeals set status = 'toegekend'
      where id = '11111111-0000-0000-0000-000000000007' $$,
  '42501',
  null,
  'niemand draait zijn eigen afwijzing terug'
);

-- Supabase's default privileges geven elke nieuwe functie EXECUTE aan
-- authenticated; deze twee zijn expliciet weer afgenomen. Zonder dat zou
-- iedereen een openstaand beroep vroegtijdig kunnen laten afwijzen.
select throws_ok(
  $$ select public.resolve_point_appeal('11111111-0000-0000-0000-000000000007') $$,
  '42501',
  null,
  'en de afhandeling is geen client-RPC'
);

select throws_ok(
  $$ select public.expire_point_appeals() $$,
  '42501',
  null,
  'het sluiten van verlopen beroepen evenmin'
);

reset role;

select * from finish();
rollback;
