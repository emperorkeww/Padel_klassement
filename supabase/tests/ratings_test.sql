-- pgTAP-tests voor de ELO-berekening (#61): incrementeel pad voor nieuwe
-- matches, volledige recompute als fallback bij correcties/verwijderingen,
-- en consistentie van rating_history.
--
-- Detectie van "geen volledige recompute": een recompute wist rating_history
-- en bouwt hem opnieuw op, dus alle id's (gen_random_uuid) worden dan nieuw.
-- We snapshotten de id's vooraf en asserten dat ze blijven bestaan.
begin;

select plan(40);

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
  ('00000000-0000-0000-0000-000000000000','e0000000-0000-0000-0000-000000000001','authenticated','authenticated','e1@test.nl','x',now(),'{}','{"username":"e1"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','e0000000-0000-0000-0000-000000000002','authenticated','authenticated','e2@test.nl','x',now(),'{}','{"username":"e2"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','e0000000-0000-0000-0000-000000000003','authenticated','authenticated','e3@test.nl','x',now(),'{}','{"username":"e3"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','e0000000-0000-0000-0000-000000000004','authenticated','authenticated','e4@test.nl','x',now(),'{}','{"username":"e4"}',now(),now(),'','','','');

-- Teams: EA = e1+e2, EB = e3+e4.
insert into public.teams (id, player1_id, player2_id)
values
  ('ee000000-0000-0000-0000-00000000000a','e0000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-000000000002'),
  ('ee000000-0000-0000-0000-00000000000b','e0000000-0000-0000-0000-000000000003','e0000000-0000-0000-0000-000000000004');

-- played_at ligt steeds in de toekomst zodat onze matches gegarandeerd ná
-- eventuele seed-matches sorteren (behalve waar we bewust antidateren).

------------------------------------------------------------------------
-- 1. Basiswiskunde: eerste match, iedereen op 1000, EA wint → ±12.
------------------------------------------------------------------------
insert into public.matches (id, team_a_id, team_b_id, status, winner_team_id, played_at)
values ('ec000000-0000-0000-0000-000000000001',
        'ee000000-0000-0000-0000-00000000000a','ee000000-0000-0000-0000-00000000000b',
        'completed','ee000000-0000-0000-0000-00000000000a', now() + interval '1 day');

select is((select rating from public.player_ratings where player_id = 'e0000000-0000-0000-0000-000000000001'),
  1012, 'winnaar stijgt van 1000 naar 1012 (K=24, gelijke ratings)');
select is((select rating from public.player_ratings where player_id = 'e0000000-0000-0000-0000-000000000003'),
  988, 'verliezer daalt van 1000 naar 988');
select is((select games from public.player_ratings where player_id = 'e0000000-0000-0000-0000-000000000001'),
  1, 'games telt de eerste match');
select is((select count(*)::int from public.rating_history
    where match_id = 'ec000000-0000-0000-0000-000000000001' and rating_before = 1000),
  4, 'vier history-rijen, allemaal vanaf de basisrating');

------------------------------------------------------------------------
-- 2. Acceptatie 1: nieuwe match aan het einde van de keten → fast path,
--    bestaande historiek blijft onaangeroerd.
------------------------------------------------------------------------
create temp table hist_snap as select id from public.rating_history;

insert into public.matches (id, team_a_id, team_b_id, status, winner_team_id, played_at)
values ('ec000000-0000-0000-0000-000000000002',
        'ee000000-0000-0000-0000-00000000000a','ee000000-0000-0000-0000-00000000000b',
        'completed','ee000000-0000-0000-0000-00000000000b', now() + interval '2 days');

select is((select count(*)::int from hist_snap s
    where not exists (select 1 from public.rating_history h where h.id = s.id)),
  0, 'nieuwe match herschrijft de bestaande historiek niet (fast path)');
select is((select count(*)::int from public.rating_history
    where match_id = 'ec000000-0000-0000-0000-000000000002'),
  4, 'exact vier nieuwe history-rijen voor de nieuwe match');
select is((select rating from public.player_ratings where player_id = 'e0000000-0000-0000-0000-000000000001'),
  999, 'underdog-verlies kost de favoriet 13 punten (1012 → 999)');
select is((select rating from public.player_ratings where player_id = 'e0000000-0000-0000-0000-000000000003'),
  1001, 'underdog-winst levert 13 punten op (988 → 1001)');
select is((select games from public.player_ratings where player_id = 'e0000000-0000-0000-0000-000000000001'),
  2, 'games telt incrementeel door');

------------------------------------------------------------------------
-- 3. Acceptatie 2 (drift-test): incrementeel opgebouwde staat is exact
--    gelijk aan een volledige recompute.
------------------------------------------------------------------------
create temp table ratings_snap as
  select player_id, rating, games from public.player_ratings;
create temp table history_snap as
  select player_id, match_id, rating_before, rating_after, delta, played_at
  from public.rating_history;

select public.recompute_ratings();

select bag_eq(
  $$ select player_id, rating, games from public.player_ratings $$,
  $$ select player_id, rating, games from ratings_snap $$,
  'incrementele ratings zijn identiek aan een volledige recompute');
select bag_eq(
  $$ select player_id, match_id, rating_before, rating_after, delta, played_at from public.rating_history $$,
  $$ select player_id, match_id, rating_before, rating_after, delta, played_at from history_snap $$,
  'incrementele historiek is identiek aan een volledige recompute');

------------------------------------------------------------------------
-- 4. Acceptatie 2: correctie van een oude match (winnaarswissel op m1)
--    valt terug op een volledige recompute met correct resultaat.
------------------------------------------------------------------------
update public.matches
   set winner_team_id = 'ee000000-0000-0000-0000-00000000000b'
 where id = 'ec000000-0000-0000-0000-000000000001';

select is((select rating from public.player_ratings where player_id = 'e0000000-0000-0000-0000-000000000001'),
  977, 'na winnaarscorrectie is de hele keten herrekend (e1: 977)');
select is((select rating from public.player_ratings where player_id = 'e0000000-0000-0000-0000-000000000003'),
  1023, 'na winnaarscorrectie is de hele keten herrekend (e3: 1023)');

drop table ratings_snap;
drop table history_snap;
create temp table ratings_snap as
  select player_id, rating, games from public.player_ratings;
create temp table history_snap as
  select player_id, match_id, rating_before, rating_after, delta, played_at
  from public.rating_history;

select public.recompute_ratings();

select bag_eq(
  $$ select player_id, rating, games from public.player_ratings $$,
  $$ select player_id, rating, games from ratings_snap $$,
  'correctie-resultaat is identiek aan een handmatige volledige recompute (ratings)');
select bag_eq(
  $$ select player_id, match_id, rating_before, rating_after, delta, played_at from public.rating_history $$,
  $$ select player_id, match_id, rating_before, rating_after, delta, played_at from history_snap $$,
  'correctie-resultaat is identiek aan een handmatige volledige recompute (historiek)');

------------------------------------------------------------------------
-- 5. No-op-paden: geplande matches en score-only correcties raken de
--    ratings niet.
------------------------------------------------------------------------
drop table hist_snap;
create temp table hist_snap as select id from public.rating_history;

insert into public.matches (id, team_a_id, team_b_id, status, played_at)
values ('ec000000-0000-0000-0000-000000000003',
        'ee000000-0000-0000-0000-00000000000a','ee000000-0000-0000-0000-00000000000b',
        'scheduled', now() + interval '3 days');

select is((select count(*)::int from public.rating_history) - (select count(*)::int from hist_snap),
  0, 'geplande match voegt geen history toe');

update public.matches
   set played_at = played_at + interval '1 hour'
 where id = 'ec000000-0000-0000-0000-000000000003';

select is((select count(*)::int from public.rating_history) - (select count(*)::int from hist_snap),
  0, 'tijdstip verplaatsen van een geplande match doet niets');

-- Score-correctie op m2 zonder winnaarswissel (winner_team_id staat wel in de
-- SET-clausule, zoals updateMatchScore doet, maar de waarde wijzigt niet).
update public.matches
   set score_a = 3, score_b = 6, winner_team_id = 'ee000000-0000-0000-0000-00000000000b'
 where id = 'ec000000-0000-0000-0000-000000000002';

select is((select count(*)::int from hist_snap s
    where not exists (select 1 from public.rating_history h where h.id = s.id)),
  0, 'score-correctie met dezelfde winnaar herrekent niets');
select is((select rating from public.player_ratings where player_id = 'e0000000-0000-0000-0000-000000000001'),
  977, 'score-correctie met dezelfde winnaar wijzigt geen rating');
select is((select count(*)::int from public.rating_history
    where match_id = 'ec000000-0000-0000-0000-000000000002'),
  4, 'score-correctie voegt geen dubbele history-rijen toe');

------------------------------------------------------------------------
-- 6. Afronden van een geplande match (setMatchResult-vorm) → fast path.
------------------------------------------------------------------------
drop table hist_snap;
create temp table hist_snap as select id from public.rating_history;

update public.matches
   set status = 'completed', winner_team_id = 'ee000000-0000-0000-0000-00000000000a',
       score_a = 6, score_b = 4
 where id = 'ec000000-0000-0000-0000-000000000003';

select is((select count(*)::int from hist_snap s
    where not exists (select 1 from public.rating_history h where h.id = s.id)),
  0, 'geplande match afronden herschrijft de bestaande historiek niet (fast path)');
select is((select rating from public.player_ratings where player_id = 'e0000000-0000-0000-0000-000000000001'),
  991, 'underdog-winst levert 14 punten op (977 → 991)');
select is((select rating from public.player_ratings where player_id = 'e0000000-0000-0000-0000-000000000003'),
  1009, 'favoriet-verlies kost 14 punten (1023 → 1009)');

------------------------------------------------------------------------
-- 7. Geantidateerde match (vóór de bestaande keten) → volledige recompute.
------------------------------------------------------------------------
drop table hist_snap;
create temp table hist_snap as select id from public.rating_history;

insert into public.matches (id, team_a_id, team_b_id, status, winner_team_id, played_at)
values ('ec000000-0000-0000-0000-000000000004',
        'ee000000-0000-0000-0000-00000000000a','ee000000-0000-0000-0000-00000000000b',
        'completed','ee000000-0000-0000-0000-00000000000a', now() + interval '1 hour');

select is((select count(*)::int from hist_snap s
    where exists (select 1 from public.rating_history h where h.id = s.id)),
  0, 'geantidateerde match dwingt een volledige recompute af');
select is((select count(*)::int from public.rating_history
    where match_id = 'ec000000-0000-0000-0000-000000000004' and rating_before = 1000),
  4, 'geantidateerde match staat vooraan in de keten (rating_before = 1000)');
select is((select count(*)::int from public.rating_history
    where match_id in ('ec000000-0000-0000-0000-000000000001','ec000000-0000-0000-0000-000000000002',
                       'ec000000-0000-0000-0000-000000000003','ec000000-0000-0000-0000-000000000004')),
  16, 'alle vier de matches hebben elk vier history-rijen');

------------------------------------------------------------------------
-- 8. completed → cancelled: match telt niet meer mee.
------------------------------------------------------------------------
update public.matches
   set status = 'cancelled'
 where id = 'ec000000-0000-0000-0000-000000000004';

select is((select count(*)::int from public.rating_history
    where match_id = 'ec000000-0000-0000-0000-000000000004'),
  0, 'geannuleerde match heeft geen history-rijen meer');
select is((select rating from public.player_ratings where player_id = 'e0000000-0000-0000-0000-000000000001'),
  991, 'ratings alsof de geannuleerde match nooit bestond');

------------------------------------------------------------------------
-- 9. DELETE van de laatste en van een oudere match → volledige recompute.
------------------------------------------------------------------------
delete from public.matches where id = 'ec000000-0000-0000-0000-000000000003';

select is((select count(*)::int from public.rating_history
    where match_id = 'ec000000-0000-0000-0000-000000000003'),
  0, 'verwijderde match laat geen wees-history achter');
select is((select rating from public.player_ratings where player_id = 'e0000000-0000-0000-0000-000000000001'),
  977, 'na verwijderen van de laatste match kloppen de ratings weer');

delete from public.matches where id = 'ec000000-0000-0000-0000-000000000001';

select is((select rating from public.player_ratings where player_id = 'e0000000-0000-0000-0000-000000000001'),
  988, 'na verwijderen van een oudere match is de rest herrekend (e1: 988)');
select is((select rating from public.player_ratings where player_id = 'e0000000-0000-0000-0000-000000000003'),
  1012, 'na verwijderen van een oudere match is de rest herrekend (e3: 1012)');
select is((select games from public.player_ratings where player_id = 'e0000000-0000-0000-0000-000000000001'),
  1, 'games telt alleen de overgebleven match');

------------------------------------------------------------------------
-- 10. Bulk: twee matches in één statement afronden → één doorgang,
--     correct resultaat, fast path.
------------------------------------------------------------------------
insert into public.matches (id, team_a_id, team_b_id, status, played_at)
values
  ('ec000000-0000-0000-0000-000000000005',
   'ee000000-0000-0000-0000-00000000000a','ee000000-0000-0000-0000-00000000000b',
   'scheduled', now() + interval '4 days'),
  ('ec000000-0000-0000-0000-000000000006',
   'ee000000-0000-0000-0000-00000000000a','ee000000-0000-0000-0000-00000000000b',
   'scheduled', now() + interval '5 days');

drop table hist_snap;
create temp table hist_snap as select id from public.rating_history;

update public.matches
   set status = 'completed', winner_team_id = 'ee000000-0000-0000-0000-00000000000a',
       score_a = 6, score_b = 2
 where id in ('ec000000-0000-0000-0000-000000000005','ec000000-0000-0000-0000-000000000006');

select is((select count(*)::int from hist_snap s
    where not exists (select 1 from public.rating_history h where h.id = s.id)),
  0, 'bulk-afronding gebruikt het fast path');
select is((select count(*)::int from public.rating_history) - (select count(*)::int from hist_snap),
  8, 'bulk-afronding voegt exact acht history-rijen toe');
select is((select rating from public.player_ratings where player_id = 'e0000000-0000-0000-0000-000000000001'),
  1013, 'bulk-afronding past de matches in chronologische volgorde toe');

drop table ratings_snap;
create temp table ratings_snap as
  select player_id, rating, games from public.player_ratings;

select public.recompute_ratings();

select bag_eq(
  $$ select player_id, rating, games from public.player_ratings $$,
  $$ select player_id, rating, games from ratings_snap $$,
  'bulk-resultaat is identiek aan een volledige recompute');

------------------------------------------------------------------------
-- 11. Acceptatie 3: rating_history is consistent (geen gaten/duplicaten).
------------------------------------------------------------------------
select is_empty(
  $$ select player_id, match_id from public.rating_history
     group by player_id, match_id having count(*) > 1 $$,
  'geen dubbele history-rijen per speler+match');

select is_empty(
  $$ select 1 from (
       select rating_before,
              lag(rating_after) over (partition by player_id order by played_at) as prev_after
       from public.rating_history
       where player_id in ('e0000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-000000000002',
                           'e0000000-0000-0000-0000-000000000003','e0000000-0000-0000-0000-000000000004')
     ) x
     where x.prev_after is not null and x.prev_after <> x.rating_before $$,
  'history vormt per speler een gesloten ketting (geen gaten)');

select is_empty(
  $$ select 1 from public.rating_history where rating_after - rating_before <> delta $$,
  'delta klopt overal met before/after');

select * from finish();

rollback;
