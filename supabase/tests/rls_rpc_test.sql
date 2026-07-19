-- pgTAP-tests voor de RLS-policies en SECURITY DEFINER RPC's.
-- Simuleert gebruikers via request.jwt.claims (auth.uid()) en role-switches.
begin;

select plan(23);

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
  ('00000000-0000-0000-0000-000000000000','a0000000-0000-0000-0000-000000000005','authenticated','authenticated','t5@test.nl','x',now(),'{}','{"username":"t5"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','a0000000-0000-0000-0000-000000000006','authenticated','authenticated','t6@test.nl','x',now(),'{}','{"username":"t6"}',now(),now(),'','','',''),
  -- t7: niet-vindbaar profiel voor discoverable-test (issue #564)
  ('00000000-0000-0000-0000-000000000000','a0000000-0000-0000-0000-000000000007','authenticated','authenticated','t7@test.nl','x',now(),'{}','{"username":"t7"}',now(),now(),'','','','');

-- t1 is bevriend met t2, t3, t4 én t6 (geaccepteerd); t5 niet. t6 zit NIET in de
-- groep — bewust, om de netwerk-regel (#326) te onderscheiden van de oude
-- beide-partijen-regel.
insert into public.friendships (requester_id, addressee_id, status)
values
  ('a0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000002','accepted'),
  ('a0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000003','accepted'),
  ('a0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000004','accepted'),
  ('a0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000006','accepted'),
  -- t7 is bevriend met t1 voor discoverable-test (issue #564)
  ('a0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000007','accepted');

-- Groep met t1 als eigenaar (trigger voegt t1 toe) + t2,t3,t4 als leden.
insert into public.groups (id, name, created_by)
values ('a0000000-0000-0000-0000-0000000000f0','Testgroep','a0000000-0000-0000-0000-000000000001');
insert into public.group_members (group_id, player_id, role)
values
  ('a0000000-0000-0000-0000-0000000000f0','a0000000-0000-0000-0000-000000000002','member'),
  ('a0000000-0000-0000-0000-0000000000f0','a0000000-0000-0000-0000-000000000003','member'),
  ('a0000000-0000-0000-0000-0000000000f0','a0000000-0000-0000-0000-000000000004','member');

-- t7 is niet vindbaar (discoverable=false) voor issue #564
update public.profiles set discoverable = false where id = 'a0000000-0000-0000-0000-000000000007';

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
-- Idempotentie: p_client_token maakt replay van een offline write veilig (#462)
------------------------------------------------------------------------
-- Twee identieke calls met dezelfde token geven dezelfde match-id terug…
select is(
  public.create_completed_match(
    'a0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000004',
    'a', 6::smallint, 3::smallint, null, null, null,
    'cccccccc-0000-0000-0000-000000000462'),
  public.create_completed_match(
    'a0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000004',
    'a', 6::smallint, 3::smallint, null, null, null,
    'cccccccc-0000-0000-0000-000000000462'),
  'create_completed_match: replay met dezelfde token geeft dezelfde id'
);
-- …en er staat precies één match-rij met die token (geen duplicaat → geen
-- dubbele punten/ratings).
select is(
  (select count(*)::int from public.matches
     where client_token = 'cccccccc-0000-0000-0000-000000000462'),
  1, 'create_completed_match: token levert precies één match-rij'
);

------------------------------------------------------------------------
-- RLS: zichtbaarheid van vriendschappen (#326 netwerk-regel)
------------------------------------------------------------------------
set local role authenticated;

-- t1 is partij in alle 5 z'n vriendschappen (t2,t3,t4,t6,t7).
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';
select is(
  (select count(*)::int from public.friendships),
  5, 't1 ziet de eigen 5 vriendschappen'
);

-- t2 zit met t1 in de groep. Netwerk-regel: t2 ziet ook t1-t6/t1-t7 (deelt een
-- groep met t1, één partij), terwijl de oude beide-partijen-regel dat verborg.
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}';
select is(
  (select count(*)::int from public.friendships),
  5, 't2 ziet alle 5 vriendschappen (netwerk via gedeelde groep met t1)'
);

-- t6 zit in geen enkele groep, maar is bevriend met t1. Via de is_accepted_friend-
-- tak ziet t6 alle vriendschappen waarin t1 partij is (t1-t2/t3/t4/t7) plus de
-- eigen t1-t6. Oude regel zou enkel t1-t6 tonen.
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000006","role":"authenticated"}';
select is(
  (select count(*)::int from public.friendships),
  5, 't6 ziet t1s vriendschappen via de vriend-tak (#326)'
);

-- t5 heeft geen netwerkband: geen groep, geen vrienden → ziet niets.
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

-- De gemeenschappelijke vriend van t2 en t3 is t1.
select is(
  (select mutual_ids from public.get_friend_suggestions(12)
     where id = 'a0000000-0000-0000-0000-000000000003'),
  array['a0000000-0000-0000-0000-000000000001']::uuid[],
  'get_friend_suggestions: mutual_ids voor t3 bevat t1'
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

-- t7 heeft discoverable=false en mag NIET in de suggesties verschijnen,
-- ook al is t7 bevriend met t1 (gemeenschappelijke vriend met t2).
select is(
  (select count(*)::int from public.get_friend_suggestions(12)
     where id = 'a0000000-0000-0000-0000-000000000007'),
  0, 'get_friend_suggestions: discoverable=false-profiel (t7) wordt niet voorgesteld (issue #564)'
);

reset role;

select * from finish();

rollback;
