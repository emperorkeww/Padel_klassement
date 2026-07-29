-- pgTAP-tests voor de netrollers (#809): RLS, kolomgrants en de guard-trigger
-- op public.match_net_touches.
begin;

select plan(16);

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

-- Teams: A = p1+p2, B = p3+p4. p5 speelt nergens mee.
insert into public.teams (id, player1_id, player2_id)
values
  ('b0000000-0000-0000-0000-00000000000a','a0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000002'),
  ('b0000000-0000-0000-0000-00000000000b','a0000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000004');

-- m1: afgerond (netrollers mogen), m2: nog gepland (mag niet).
insert into public.matches (id, team_a_id, team_b_id, status, winner_team_id, score_a, score_b, played_at, created_by)
values
  ('c0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-00000000000a','b0000000-0000-0000-0000-00000000000b','completed','b0000000-0000-0000-0000-00000000000a',6,3, now() - interval '1 day','a0000000-0000-0000-0000-000000000001'),
  ('c0000000-0000-0000-0000-000000000002','b0000000-0000-0000-0000-00000000000a','b0000000-0000-0000-0000-00000000000b','scheduled', null, null, null, now() + interval '1 day','a0000000-0000-0000-0000-000000000001');

------------------------------------------------------------------------
-- Eigen netrollers invullen op een afgeronde match.
------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';

select lives_ok(
  $$ insert into public.match_net_touches (match_id, player_id, aantal)
     values ('c0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001', 3) $$,
  'deelnemer vult zijn eigen netrollers in'
);

select is(
  (select aantal from public.match_net_touches
    where match_id = 'c0000000-0000-0000-0000-000000000001'
      and player_id = 'a0000000-0000-0000-0000-000000000001'),
  3::smallint, 'het aantal is bewaard'
);

select isnt(
  (select updated_at from public.match_net_touches
    where match_id = 'c0000000-0000-0000-0000-000000000001'
      and player_id = 'a0000000-0000-0000-0000-000000000001'),
  null, 'updated_at is serverside gezet'
);

select lives_ok(
  $$ update public.match_net_touches set aantal = 5
      where match_id = 'c0000000-0000-0000-0000-000000000001'
        and player_id = 'a0000000-0000-0000-0000-000000000001' $$,
  'eigen aantal is achteraf corrigeerbaar'
);

-- created_at/updated_at zijn serverside: geen kolomgrant voor de client.
select throws_ok(
  $$ update public.match_net_touches set updated_at = now() - interval '1 year'
      where match_id = 'c0000000-0000-0000-0000-000000000001'
        and player_id = 'a0000000-0000-0000-0000-000000000001' $$,
  '42501'
);

-- De check-constraint houdt onzin tegen.
select throws_ok(
  $$ update public.match_net_touches set aantal = 100
      where match_id = 'c0000000-0000-0000-0000-000000000001'
        and player_id = 'a0000000-0000-0000-0000-000000000001' $$,
  '23514'
);

------------------------------------------------------------------------
-- Guard: alleen voor jezelf, alleen als je meespeelde, alleen na afloop.
------------------------------------------------------------------------
select throws_ok(
  $$ insert into public.match_net_touches (match_id, player_id, aantal)
     values ('c0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000003', 2) $$,
  '42501'
);

select throws_ok(
  $$ insert into public.match_net_touches (match_id, player_id, aantal)
     values ('c0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000001', 2) $$,
  'netrollers kunnen pas na afloop ingevuld worden'
);

-- p5 stond niet in de match: RLS laat de eigen-rij door, de guard stopt hem.
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000005","role":"authenticated"}';
select throws_ok(
  $$ insert into public.match_net_touches (match_id, player_id, aantal)
     values ('c0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000005', 2) $$,
  'speler stond niet in deze match'
);

------------------------------------------------------------------------
-- Zichtbaarheid: volgt de match. m1 heeft geen groep, dus publiek leesbaar.
------------------------------------------------------------------------
select is(
  (select count(*)::int from public.match_net_touches),
  1, 'buitenstaander ziet de netrollers van een groeploze match'
);

set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000003","role":"authenticated"}';
select is(
  (select aantal from public.match_net_touches
    where player_id = 'a0000000-0000-0000-0000-000000000001'),
  5::smallint, 'tegenstander ziet elkaars netrollers'
);

-- Andermans rij aanpassen of wissen kan niet. RLS filtert de rij weg, dus de
-- statements slagen maar raken niets — vandaar dat we de nastand controleren
-- in plaats van een fout te verwachten.
update public.match_net_touches set aantal = 0
 where player_id = 'a0000000-0000-0000-0000-000000000001';
select is(
  (select aantal from public.match_net_touches
    where player_id = 'a0000000-0000-0000-0000-000000000001'),
  5::smallint, 'update van andermans netrollers verandert niets'
);

delete from public.match_net_touches
 where player_id = 'a0000000-0000-0000-0000-000000000001';
select is(
  (select count(*)::int from public.match_net_touches),
  1, 'delete van andermans netrollers wist niets'
);

------------------------------------------------------------------------
-- Eigen rij wissen mag wel; de match cascadeert de rest weg.
------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';
delete from public.match_net_touches
 where player_id = 'a0000000-0000-0000-0000-000000000001';
select is(
  (select count(*)::int from public.match_net_touches),
  0, 'eigen netrollers zijn te wissen'
);

reset role;
insert into public.match_net_touches (match_id, player_id, aantal)
values ('c0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000002', 4);
select is(
  (select count(*)::int from public.match_net_touches),
  1, 'rij staat er weer'
);
delete from public.matches where id = 'c0000000-0000-0000-0000-000000000001';
select is(
  (select count(*)::int from public.match_net_touches),
  0, 'match verwijderd: netrollers cascaderen mee'
);

select * from finish();

rollback;
