-- pgTAP-tests voor het koppelen van een gastspeler aan een echt account (#681).
--
-- Scenario: u1 heeft een gast aangemaakt ("Gast Bram") die in drie matches
-- speelde. Bram maakt later zelf een account (u2) en neemt de historie over.
-- Getest wordt de hele keten: autorisatie op het verzoek, de bevestiging door
-- het echte account, het verhuizen van teams/matches/punten/tips/leden, de
-- botsingen (bestaand teampaar, gast en speler in dezelfde match, dubbel
-- groepslidmaatschap) en de rating-herberekening.
begin;

select plan(48);

------------------------------------------------------------------------
-- Fixtures (als superuser). De trigger handle_new_user maakt de profielen.
--   u1 = eigenaar van de gast, speelt zelf mee   u2 = het echte account
--   u3/u4 = medespelers                          u9 = buitenstaander
------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
values
  ('00000000-0000-0000-0000-000000000000','a6810000-0000-0000-0000-000000000001','authenticated','authenticated','k1@test.nl','x',now(),'{}','{"username":"k1"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','a6810000-0000-0000-0000-000000000002','authenticated','authenticated','k2@test.nl','x',now(),'{}','{"username":"k2"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','a6810000-0000-0000-0000-000000000003','authenticated','authenticated','k3@test.nl','x',now(),'{}','{"username":"k3"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','a6810000-0000-0000-0000-000000000004','authenticated','authenticated','k4@test.nl','x',now(),'{}','{"username":"k4"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','a6810000-0000-0000-0000-000000000009','authenticated','authenticated','k9@test.nl','x',now(),'{}','{"username":"k9"}',now(),now(),'','','','');

-- Drie gasten van u1: de gast die gekoppeld wordt, één die met u2 in dezelfde
-- match stond (botsing) en één zonder historie (weiger-pad).
insert into public.profiles (id, username, full_name, is_guest, owner_id, discoverable, allow_friend_requests)
values
  ('a6810000-0000-0000-0000-0000000000a1','gast_bram','Gast Bram',true,'a6810000-0000-0000-0000-000000000001',false,false),
  ('a6810000-0000-0000-0000-0000000000a2','gast_twee','Gast Twee',true,'a6810000-0000-0000-0000-000000000001',false,false),
  ('a6810000-0000-0000-0000-0000000000a3','gast_drie','Gast Drie',true,'a6810000-0000-0000-0000-000000000001',false,false);

-- G1: u2 is nog géén lid — dat lidmaatschap erft hij van de gast.
-- G2: gast én u2 zijn allebei lid, de gast met de hoogste rol.
insert into public.groups (id, name, created_by)
values
  ('a6810000-0000-0000-0000-0000000000f1','Groep één','a6810000-0000-0000-0000-000000000001'),
  ('a6810000-0000-0000-0000-0000000000f2','Groep twee','a6810000-0000-0000-0000-000000000001');
insert into public.group_members (group_id, player_id, role)
values
  ('a6810000-0000-0000-0000-0000000000f1','a6810000-0000-0000-0000-000000000003','member'),
  ('a6810000-0000-0000-0000-0000000000f1','a6810000-0000-0000-0000-000000000004','member'),
  ('a6810000-0000-0000-0000-0000000000f1','a6810000-0000-0000-0000-0000000000a1','member'),
  ('a6810000-0000-0000-0000-0000000000f2','a6810000-0000-0000-0000-0000000000a1','owner'),
  ('a6810000-0000-0000-0000-0000000000f2','a6810000-0000-0000-0000-000000000002','member');

-- Teams. b4 (u2+u3) bestaat al en is precies het paar waar b3 (gast+u3) na de
-- koppeling op uitkomt: de teams_unique_pair-botsing uit de issue.
insert into public.teams (id, player1_id, player2_id)
values
  ('a6810000-0000-0000-0000-0000000000b1','a6810000-0000-0000-0000-0000000000a1','a6810000-0000-0000-0000-000000000001'),
  ('a6810000-0000-0000-0000-0000000000b2','a6810000-0000-0000-0000-000000000003','a6810000-0000-0000-0000-000000000004'),
  ('a6810000-0000-0000-0000-0000000000b3','a6810000-0000-0000-0000-0000000000a1','a6810000-0000-0000-0000-000000000003'),
  ('a6810000-0000-0000-0000-0000000000b4','a6810000-0000-0000-0000-000000000002','a6810000-0000-0000-0000-000000000003'),
  ('a6810000-0000-0000-0000-0000000000b5','a6810000-0000-0000-0000-000000000001','a6810000-0000-0000-0000-000000000004'),
  ('a6810000-0000-0000-0000-0000000000b6','a6810000-0000-0000-0000-0000000000a1',null),
  ('a6810000-0000-0000-0000-0000000000b7','a6810000-0000-0000-0000-000000000004',null),
  ('a6810000-0000-0000-0000-0000000000b8','a6810000-0000-0000-0000-0000000000a2','a6810000-0000-0000-0000-000000000002');

-- M1 (G1): gast+u1 winnen. M3 (G1): u2+u3 winnen — de enige match die u2 zelf
-- al op zijn naam heeft. M4: losse singles-match van de gast.
insert into public.matches
  (id, team_a_id, team_b_id, group_id, status, winner_team_id, score_a, score_b, played_at, format)
values
  ('a6810000-0000-0000-0000-0000000000c1','a6810000-0000-0000-0000-0000000000b1','a6810000-0000-0000-0000-0000000000b2',
   'a6810000-0000-0000-0000-0000000000f1','completed','a6810000-0000-0000-0000-0000000000b1',6,2, now() - interval '30 days','2v2'),
  ('a6810000-0000-0000-0000-0000000000c3','a6810000-0000-0000-0000-0000000000b4','a6810000-0000-0000-0000-0000000000b5',
   'a6810000-0000-0000-0000-0000000000f1','completed','a6810000-0000-0000-0000-0000000000b4',6,3, now() - interval '20 days','2v2'),
  ('a6810000-0000-0000-0000-0000000000c4','a6810000-0000-0000-0000-0000000000b6','a6810000-0000-0000-0000-0000000000b7',
   null,'completed','a6810000-0000-0000-0000-0000000000b6',6,4, now() - interval '5 days','1v1');

-- M5 blijft gepland: hij telt niet mee voor de ratings, maar blokkeert wél de
-- koppeling van gast2 aan u2 (ze staan samen in een team).
insert into public.matches
  (id, team_a_id, team_b_id, group_id, status, played_at, format)
values
  ('a6810000-0000-0000-0000-0000000000c5','a6810000-0000-0000-0000-0000000000b8','a6810000-0000-0000-0000-0000000000b2',
   'a6810000-0000-0000-0000-0000000000f1','scheduled', now() + interval '7 days','2v2');

-- M2 (G1) wordt eerst gepland, zodat u4 er echt op kan tippen; daarna afgerond.
-- Zijn team b3 loopt na de koppeling op de bestaande b4 vast — precies de match
-- waarvan de tip mee moet verhuizen.
insert into public.matches
  (id, team_a_id, team_b_id, group_id, status, played_at, format)
values
  ('a6810000-0000-0000-0000-0000000000c2','a6810000-0000-0000-0000-0000000000b3','a6810000-0000-0000-0000-0000000000b5',
   'a6810000-0000-0000-0000-0000000000f1','scheduled', now() + interval '1 day','2v2');

set local role authenticated;
set local request.jwt.claims = '{"sub":"a6810000-0000-0000-0000-000000000003","role":"authenticated"}';
insert into public.match_predictions (match_id, player_id, group_id, predicted_team_id)
values ('a6810000-0000-0000-0000-0000000000c2','a6810000-0000-0000-0000-000000000003',
        'a6810000-0000-0000-0000-0000000000f1','a6810000-0000-0000-0000-0000000000b3');
reset role;

update public.matches
   set status = 'completed',
       winner_team_id = 'a6810000-0000-0000-0000-0000000000b3',
       score_a = 6, score_b = 1,
       played_at = now() - interval '10 days'
 where id = 'a6810000-0000-0000-0000-0000000000c2';

-- Puntenlog van M2: verwijst naar het team dat straks opgeruimd wordt.
insert into public.match_points (match_id, set_number, game_number, point_number, won_by_team_id)
values
  ('a6810000-0000-0000-0000-0000000000c2',1,1,1,'a6810000-0000-0000-0000-0000000000b3'),
  ('a6810000-0000-0000-0000-0000000000c2',1,1,2,'a6810000-0000-0000-0000-0000000000b5');

-- Aanwezigheid: één dag die botst met een bestaande rij van u2, één die vrij is.
insert into public.attendance (group_id, player_id, date, status)
values
  ('a6810000-0000-0000-0000-0000000000f1','a6810000-0000-0000-0000-0000000000a1', date '2026-08-01','yes'),
  ('a6810000-0000-0000-0000-0000000000f1','a6810000-0000-0000-0000-000000000002', date '2026-08-01','no'),
  ('a6810000-0000-0000-0000-0000000000f1','a6810000-0000-0000-0000-0000000000a1', date '2026-08-08','yes');

-- Vriendschappen: de gast is bevriend met u3 (moet meeverhuizen) en met u2 zelf
-- (zou een zelfverwijzing worden en moet verdwijnen).
insert into public.friendships (requester_id, addressee_id, status)
values
  ('a6810000-0000-0000-0000-0000000000a1','a6810000-0000-0000-0000-000000000003','accepted'),
  ('a6810000-0000-0000-0000-0000000000a1','a6810000-0000-0000-0000-000000000002','accepted');

-- Momentopname van de tip, om te bewijzen dat alleen het team wijzigt.
create temp table tip_voor as
  select predicted_team_id, win_chance, points
    from public.match_predictions
   where match_id = 'a6810000-0000-0000-0000-0000000000c2';

------------------------------------------------------------------------
-- Baseline: de gast speelt volwaardig mee in de ratings, maar telt (#468)
-- niet mee in het groepsklassement — dat is precies het probleem.
------------------------------------------------------------------------
select is(
  (select games from public.player_ratings where player_id = 'a6810000-0000-0000-0000-0000000000a1'),
  3, 'de gast heeft drie afgeronde matches in zijn rating');
select is(
  (select games from public.player_ratings where player_id = 'a6810000-0000-0000-0000-000000000002'),
  1, 'het echte account heeft er één');
select is(
  (select count(*)::int from public.group_player_standings
    where group_id = 'a6810000-0000-0000-0000-0000000000f1'
      and player_id = 'a6810000-0000-0000-0000-0000000000a1'),
  0, 'de gast staat niet in het groepsklassement (#468)');
select is(
  (select count(*)::int from public.group_player_standings
    where group_id = 'a6810000-0000-0000-0000-0000000000f1'
      and player_id = 'a6810000-0000-0000-0000-000000000002'),
  1, 'het echte account staat er met alleen zijn eigen match');

------------------------------------------------------------------------
-- Het verzoek: wie mag het starten, en op wie?
------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated"}';
select throws_ok(
  $$ select public.request_guest_claim('a6810000-0000-0000-0000-0000000000a1',
                                       'a6810000-0000-0000-0000-000000000002') $$,
  'P0001', 'Niet ingelogd', 'zonder sessie geen koppelverzoek');

set local request.jwt.claims = '{"sub":"a6810000-0000-0000-0000-000000000009","role":"authenticated"}';
select throws_ok(
  $$ select public.request_guest_claim('a6810000-0000-0000-0000-0000000000a1',
                                       'a6810000-0000-0000-0000-000000000002') $$,
  'P0001', 'Alleen wie de gast aanmaakte kan hem koppelen',
  'een ander dan de eigenaar kan de gast niet koppelen');

set local request.jwt.claims = '{"sub":"a6810000-0000-0000-0000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ select public.request_guest_claim('a6810000-0000-0000-0000-000000000003',
                                       'a6810000-0000-0000-0000-000000000002') $$,
  'P0001', 'Dit profiel is geen gastspeler',
  'een echt account is geen gast');

select throws_ok(
  $$ select public.request_guest_claim('a6810000-0000-0000-0000-0000000000a1',
                                       'a6810000-0000-0000-0000-0000000000a2') $$,
  'P0001', 'Een gast koppel je aan een echt account, niet aan een andere gast',
  'koppelen aan een andere gast kan niet');

select throws_ok(
  $$ select public.request_guest_claim('a6810000-0000-0000-0000-0000000000a1',
                                       'a6810000-0000-0000-0000-000000000009') $$,
  'P0001', 'Koppelen kan alleen met een vriend of een groepsgenoot',
  'een wildvreemde kun je geen koppelverzoek sturen');

-- Botsing: gast2 en u2 stonden samen in een team (M5).
select throws_ok(
  $$ select public.request_guest_claim('a6810000-0000-0000-0000-0000000000a2',
                                       'a6810000-0000-0000-0000-000000000002') $$,
  'P0001',
  'De gast en deze speler stonden samen in 1 match(es). Die zouden na het koppelen onzinnig worden — vervang de gast eerst in die matches.',
  'gast en speler in dezelfde match: nette melding, geen constraint-fout');

-- Het echte verzoek, en nog eens versturen is een no-op.
select isnt(
  (select public.request_guest_claim('a6810000-0000-0000-0000-0000000000a1',
                                     'a6810000-0000-0000-0000-000000000002')),
  null, 'de eigenaar start het koppelverzoek');
select is(
  (select count(*)::int from public.guest_claims
    where guest_id = 'a6810000-0000-0000-0000-0000000000a1' and status = 'pending'),
  1, 'er staat precies één openstaand verzoek');
select is(
  (select public.request_guest_claim('a6810000-0000-0000-0000-0000000000a1',
                                     'a6810000-0000-0000-0000-000000000002')),
  (select id from public.guest_claims where guest_id = 'a6810000-0000-0000-0000-0000000000a1'),
  'hetzelfde verzoek nog eens sturen geeft het bestaande terug');

------------------------------------------------------------------------
-- De bevestiging: alleen het echte account zelf.
------------------------------------------------------------------------
select throws_ok(
  $$ select public.claim_guest_player('a6810000-0000-0000-0000-0000000000a1',
                                      'a6810000-0000-0000-0000-000000000002') $$,
  'P0001', 'Alleen het echte account kan de koppeling bevestigen',
  'de aanvrager kan zijn eigen verzoek niet bevestigen');

set local request.jwt.claims = '{"sub":"a6810000-0000-0000-0000-000000000009","role":"authenticated"}';
select throws_ok(
  $$ select public.claim_guest_player('a6810000-0000-0000-0000-0000000000a1',
                                      'a6810000-0000-0000-0000-000000000009') $$,
  'P0001', 'Geen openstaand koppelverzoek voor deze gast',
  'zonder verzoek neemt niemand een gast over');

-- De zichtbaarheid van het verzoek loopt via RLS: alleen de twee betrokkenen.
select is(
  (select count(*)::int from public.guest_claims),
  0, 'een buitenstaander ziet het koppelverzoek niet');
set local request.jwt.claims = '{"sub":"a6810000-0000-0000-0000-000000000002","role":"authenticated"}';
select is(
  (select count(*)::int from public.guest_claims),
  1, 'het echte account ziet zijn eigen verzoek');

select is(
  (select public.claim_guest_player('a6810000-0000-0000-0000-0000000000a1',
                                    'a6810000-0000-0000-0000-000000000002')),
  jsonb_build_object('matches', 3, 'groepen', 1),
  'de koppeling meldt drie overgenomen matches en één nieuw groepslidmaatschap');

reset role;

------------------------------------------------------------------------
-- Na de koppeling: de gast bestaat niet meer en alles staat op u2.
------------------------------------------------------------------------
select is(
  (select count(*)::int from public.profiles where id = 'a6810000-0000-0000-0000-0000000000a1'),
  0, 'het gastprofiel is weg');
select is(
  (select count(*)::int from public.guest_claims
    where guest_id = 'a6810000-0000-0000-0000-0000000000a1'),
  0, 'het verzoek verdwijnt met de gast');
select is(
  (select count(*)::int from public.teams
    where player1_id = 'a6810000-0000-0000-0000-0000000000a1'
       or player2_id = 'a6810000-0000-0000-0000-0000000000a1'),
  0, 'er zijn geen teams met de gast meer');
select is(
  (select count(*)::int from public.matches
    where id in ('a6810000-0000-0000-0000-0000000000c1','a6810000-0000-0000-0000-0000000000c2',
                 'a6810000-0000-0000-0000-0000000000c3','a6810000-0000-0000-0000-0000000000c4',
                 'a6810000-0000-0000-0000-0000000000c5')),
  5, 'alle vijf de matches bestaan nog');

-- b1 (gast+u1) had geen tegenhanger en is ter plekke omgehangen naar u2+u1.
select is(
  (select count(*)::int from public.teams t
    where t.id in (select team_a_id from public.matches where id = 'a6810000-0000-0000-0000-0000000000c1')
      and (t.player1_id = 'a6810000-0000-0000-0000-000000000002'
        or t.player2_id = 'a6810000-0000-0000-0000-000000000002')),
  1, 'M1 speelt nu met het echte account');

-- b3 (gast+u3) botste op het bestaande b4 (u2+u3): de match wijst nu naar b4.
select is(
  (select team_a_id from public.matches where id = 'a6810000-0000-0000-0000-0000000000c2'),
  'a6810000-0000-0000-0000-0000000000b4'::uuid,
  'het botsende teampaar is samengevoegd: M2 wijst naar het bestaande team');
select is(
  (select winner_team_id from public.matches where id = 'a6810000-0000-0000-0000-0000000000c2'),
  'a6810000-0000-0000-0000-0000000000b4'::uuid,
  'ook de winnaar van M2 wijst naar het bestaande team');
select is(
  (select count(*)::int from public.teams where id = 'a6810000-0000-0000-0000-0000000000b3'),
  0, 'het gast-team is opgeruimd');
select is(
  (select count(*)::int from public.match_points
    where match_id = 'a6810000-0000-0000-0000-0000000000c2'
      and won_by_team_id = 'a6810000-0000-0000-0000-0000000000b4'),
  1, 'de puntenlog verwijst mee naar het samengevoegde team');

-- Singles: de gast had een 1v1-team, u2 krijgt daar zijn eigen singles-team.
select is(
  (select t.player1_id from public.matches m join public.teams t on t.id = m.team_a_id
    where m.id = 'a6810000-0000-0000-0000-0000000000c4'),
  'a6810000-0000-0000-0000-000000000002'::uuid,
  'de singles-match staat nu op het echte account');
select is(
  (select t.player2_id from public.matches m join public.teams t on t.id = m.team_a_id
    where m.id = 'a6810000-0000-0000-0000-0000000000c4'),
  null, 'en blijft een singles-team');

-- De tip verhuist mee, met dezelfde winkans en punten (#681-uitzondering in
-- match_predictions_guard).
select is(
  (select predicted_team_id from public.match_predictions
    where match_id = 'a6810000-0000-0000-0000-0000000000c2'),
  'a6810000-0000-0000-0000-0000000000b4'::uuid,
  'de tip wijst naar het samengevoegde team');
select is(
  (select win_chance from public.match_predictions
    where match_id = 'a6810000-0000-0000-0000-0000000000c2'),
  (select win_chance from tip_voor),
  'de winkans-snapshot van de tip blijft staan');
select is(
  (select points from public.match_predictions
    where match_id = 'a6810000-0000-0000-0000-0000000000c2'),
  (select points from tip_voor),
  'de toegekende punten van de tip blijven staan');

-- Groepslidmaatschappen: nieuw in G1, gededupt in G2 met de hoogste rol.
select is(
  (select role from public.group_members
    where group_id = 'a6810000-0000-0000-0000-0000000000f1'
      and player_id = 'a6810000-0000-0000-0000-000000000002'),
  'member', 'het echte account erft het lidmaatschap van G1');
select is(
  (select count(*)::int from public.group_members
    where group_id = 'a6810000-0000-0000-0000-0000000000f2'
      and player_id = 'a6810000-0000-0000-0000-000000000002'),
  1, 'dubbel lidmaatschap van G2 levert één rij op');
select is(
  (select role from public.group_members
    where group_id = 'a6810000-0000-0000-0000-0000000000f2'
      and player_id = 'a6810000-0000-0000-0000-000000000002'),
  'owner', 'en de hoogste rol blijft behouden');

-- Aanwezigheid: de botsende dag houdt de eigen rij, de vrije dag verhuist.
select is(
  (select status from public.attendance
    where group_id = 'a6810000-0000-0000-0000-0000000000f1'
      and player_id = 'a6810000-0000-0000-0000-000000000002' and date = date '2026-08-01'),
  'no', 'bij een dubbele aanwezigheidsrij wint de eigen opgave');
select is(
  (select status from public.attendance
    where group_id = 'a6810000-0000-0000-0000-0000000000f1'
      and player_id = 'a6810000-0000-0000-0000-000000000002' and date = date '2026-08-08'),
  'yes', 'de overige aanwezigheid verhuist mee');

-- Vriendschappen: die met u3 verhuist, de zelfverwijzing verdwijnt.
select ok(
  public.are_friends('a6810000-0000-0000-0000-000000000002','a6810000-0000-0000-0000-000000000003'),
  'de vriendschap van de gast staat nu op het echte account');
select is(
  (select count(*)::int from public.friendships
    where requester_id = 'a6810000-0000-0000-0000-000000000002'
      and addressee_id = 'a6810000-0000-0000-0000-000000000002'),
  0, 'de vriendschap gast<->speler is geen zelfverwijzing geworden');

------------------------------------------------------------------------
-- Ratings: volledig herberekend, inclusief de matches die als gast gespeeld
-- zijn. Dat is de kern van de issue.
------------------------------------------------------------------------
select is(
  (select games from public.player_ratings where player_id = 'a6810000-0000-0000-0000-000000000002'),
  4, 'het echte account telt nu vier matches (drie van de gast + zijn eigen)');
select is(
  (select count(*)::int from public.rating_history
    where player_id = 'a6810000-0000-0000-0000-000000000002'),
  4, 'de rating_history bevat de matches uit de gastperiode');
select is(
  (select count(*)::int from public.player_ratings
    where player_id = 'a6810000-0000-0000-0000-0000000000a1'),
  0, 'de gast heeft geen rating meer');
select is(
  (select played::int from public.group_player_standings
    where group_id = 'a6810000-0000-0000-0000-0000000000f1'
      and player_id = 'a6810000-0000-0000-0000-000000000002'),
  3, 'het groepsklassement telt de gastmatches nu wél mee (#468)');

------------------------------------------------------------------------
-- Weigeren en intrekken.
------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"a6810000-0000-0000-0000-000000000001","role":"authenticated"}';
select isnt(
  (select public.request_guest_claim('a6810000-0000-0000-0000-0000000000a3',
                                     'a6810000-0000-0000-0000-000000000002')),
  null, 'tweede gast: verzoek gestart');

set local request.jwt.claims = '{"sub":"a6810000-0000-0000-0000-000000000009","role":"authenticated"}';
select throws_ok(
  $$ select public.cancel_guest_claim(
       (select id from public.guest_claims where guest_id = 'a6810000-0000-0000-0000-0000000000a3')) $$,
  'P0001', 'Koppelverzoek niet gevonden',
  'een buitenstaander kan het verzoek niet eens vinden (RLS + definer)');

set local request.jwt.claims = '{"sub":"a6810000-0000-0000-0000-000000000002","role":"authenticated"}';
select lives_ok(
  $$ select public.cancel_guest_claim(
       (select id from public.guest_claims where guest_id = 'a6810000-0000-0000-0000-0000000000a3')) $$,
  'het echte account weigert het verzoek');
select is(
  (select status from public.guest_claims where guest_id = 'a6810000-0000-0000-0000-0000000000a3'),
  'declined', 'het verzoek staat op geweigerd');
select throws_ok(
  $$ select public.claim_guest_player('a6810000-0000-0000-0000-0000000000a3',
                                      'a6810000-0000-0000-0000-000000000002') $$,
  'P0001', 'Geen openstaand koppelverzoek voor deze gast',
  'na weigeren kan de koppeling niet alsnog doorgaan');

select * from finish();

rollback;
