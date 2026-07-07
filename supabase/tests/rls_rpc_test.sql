-- pgTAP-tests voor de RLS-policies en SECURITY DEFINER RPC's.
-- Simuleert gebruikers via request.jwt.claims (auth.uid()) en role-switches.
begin;

select plan(17);

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
  ('00000000-0000-0000-0000-000000000000','a0000000-0000-0000-0000-000000000001','authenticated','authenticated','t1@test.nl','x',now(),'{}','{"username":"t1"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','a0000000-0000-0000-0000-000000000002','authenticated','authenticated','t2@test.nl','x',now(),'{}','{"username":"t2"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','a0000000-0000-0000-0000-000000000003','authenticated','authenticated','t3@test.nl','x',now(),'{}','{"username":"t3"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','a0000000-0000-0000-0000-000000000004','authenticated','authenticated','t4@test.nl','x',now(),'{}','{"username":"t4"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','a0000000-0000-0000-0000-000000000005','authenticated','authenticated','t5@test.nl','x',now(),'{}','{"username":"t5"}',now(),now(),'','','','');

-- t1 is bevriend met t2, t3, t4 (geaccepteerd); t5 niet.
insert into public.friendships (requester_id, addressee_id, status)
values
  ('a0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000002','accepted'),
  ('a0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000003','accepted'),
  ('a0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000004','accepted');

-- Groep met t1 als eigenaar (trigger voegt t1 toe) + t2,t3,t4 als leden.
insert into public.groups (id, name, created_by)
values ('a0000000-0000-0000-0000-0000000000f0','Testgroep','a0000000-0000-0000-0000-000000000001');
insert into public.group_members (group_id, player_id, role)
values
  ('a0000000-0000-0000-0000-0000000000f0','a0000000-0000-0000-0000-000000000002','member'),
  ('a0000000-0000-0000-0000-0000000000f0','a0000000-0000-0000-0000-000000000003','member'),
  ('a0000000-0000-0000-0000-0000000000f0','a0000000-0000-0000-0000-000000000004','member');

------------------------------------------------------------------------
-- are_friends
------------------------------------------------------------------------
select is(
  public.are_friends('a0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000002'),
  true, 'are_friends: t1 en t2 zijn vrienden'
);
select is(
  public.are_friends('a0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000005'),
  false, 'are_friends: t1 en t5 zijn geen vrienden'
);

------------------------------------------------------------------------
-- create_completed_match (als t1)
------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';

-- Winst voor team A (t1+t2 verslaan t3+t4)
select isnt(
  public.create_completed_match(
    'a0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000004',
    'a', 6::smallint, 3::smallint, null),
  null, 'create_completed_match: winst aangemaakt'
);
select is(
  (select points::int from public.player_standings where player_id = 'a0000000-0000-0000-0000-000000000001'),
  3, 'winnaar t1 heeft 3 punten'
);
select is(
  (select points::int from public.player_standings where player_id = 'a0000000-0000-0000-0000-000000000003'),
  0, 'verliezer t3 heeft 0 punten'
);

-- Gelijkspel (winner_team_id NULL) -> beide teams +1
select isnt(
  public.create_completed_match(
    'a0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000004',
    'draw', 6::smallint, 6::smallint, null),
  null, 'create_completed_match: gelijkspel aangemaakt'
);
select is(
  (select points::int from public.player_standings where player_id = 'a0000000-0000-0000-0000-000000000001'),
  4, 't1 heeft 4 punten na winst + gelijkspel'
);

-- Niet-vriend (t5) mag niet meespelen
select throws_ok(
  $$ select public.create_completed_match(
       'a0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000002',
       'a0000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000005',
       'a', 6::smallint, 3::smallint, null) $$,
  'P0001'
);

------------------------------------------------------------------------
-- RLS: friendships zijn alleen zichtbaar voor de betrokkenen
------------------------------------------------------------------------
set local role authenticated;

set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';
select is(
  (select count(*)::int from public.friendships),
  3, 't1 ziet enkel de eigen 3 vriendschappen'
);

set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000005","role":"authenticated"}';
select is(
  (select count(*)::int from public.friendships),
  0, 't5 ziet geen vriendschappen'
);

-- Directe writes op matches/teams zijn geblokkeerd (moeten via de RPC's)
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ insert into public.matches (team_a_id, team_b_id, status, created_by)
     values ('a0000000-0000-0000-0000-0000000000fa','a0000000-0000-0000-0000-0000000000fb','scheduled','a0000000-0000-0000-0000-000000000001') $$,
  '42501'
);
select throws_ok(
  $$ insert into public.teams (player1_id, player2_id)
     values ('a0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000002') $$,
  '42501'
);

reset role;

------------------------------------------------------------------------
-- generate_americano_round
------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';
select ok(
  (select count(*) from public.generate_americano_round('a0000000-0000-0000-0000-0000000000f0')) >= 1,
  'lid kan een Americano-ronde genereren'
);

set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000005","role":"authenticated"}';
select throws_ok(
  $$ select public.generate_americano_round('a0000000-0000-0000-0000-0000000000f0') $$,
  'P0001'
);

------------------------------------------------------------------------
-- get_friend_suggestions
-- t1 is bevriend met t2, t3, t4. Als t2 suggesties opvraagt, zijn t3 en t4
-- kandidaten met 1 gemeenschappelijke vriend (t1); t2 zelf en t1 (al bevriend)
-- vallen weg.
------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}';

-- t3 en t4 worden voorgesteld, met mutual_count = 1 (via t1).
select is(
  (select count(*)::int from public.get_friend_suggestions(12)
     where mutual_count = 1
       and id in ('a0000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000004')),
  2, 'get_friend_suggestions: t3 en t4 hebben 1 gemeenschappelijke vriend voor t2'
);

-- t2 stelt zichzelf nooit voor.
select is(
  (select count(*)::int from public.get_friend_suggestions(12)
     where id = 'a0000000-0000-0000-0000-000000000002'),
  0, 'get_friend_suggestions: t2 zit niet in de eigen suggesties'
);

-- t1 is al een vriend van t2 en valt dus weg als suggestie.
select is(
  (select count(*)::int from public.get_friend_suggestions(12)
     where id = 'a0000000-0000-0000-0000-000000000001'),
  0, 'get_friend_suggestions: bestaande vriend t1 wordt niet voorgesteld'
);

reset role;

select * from finish();

rollback;
