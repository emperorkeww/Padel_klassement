-- Testdata voor lokale ontwikkeling.
-- Wordt automatisch geladen door `supabase db reset`.
-- LET OP: enkel voor lokaal gebruik — niet pushen als productiedata.

-- 1) Testgebruikers in auth.users.
--    De trigger handle_new_user() maakt hieruit automatisch de profiles aan
--    (username/full_name komen uit raw_user_meta_data).
--    BELANGRIJK: de token-kolommen (confirmation_token, recovery_token,
--    email_change, email_change_token_new) MOETEN '' zijn i.p.v. NULL.
--    GoTrue kan NULL niet in een string scannen en geeft anders bij het
--    inloggen een 500 "Database error querying schema".
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', 'alice@example.com', extensions.crypt('password123', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"username":"alice","full_name":"Alice Anders"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated', 'bob@example.com',   extensions.crypt('password123', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"username":"bob","full_name":"Bob Boers"}',     now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-3333-3333-333333333333', 'authenticated', 'authenticated', 'carol@example.com', extensions.crypt('password123', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"username":"carol","full_name":"Carol Claes"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '44444444-4444-4444-4444-444444444444', 'authenticated', 'authenticated', 'dave@example.com',  extensions.crypt('password123', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"username":"dave","full_name":"Dave De Vos"}',  now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '55555555-5555-5555-5555-555555555555', 'authenticated', 'authenticated', 'erik@example.com',  extensions.crypt('password123', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"username":"erik","full_name":"Erik Elzinga"}', now(), now(), '', '', '', '');

-- 1b) Bijbehorende identities. Nieuwere GoTrue verwacht voor e-mail/wachtwoord
--     login een identity-rij per user (met sub + email in identity_data).
insert into auth.identities (
  id, user_id, provider_id, provider, identity_data, created_at, updated_at, last_sign_in_at
)
values
  (extensions.gen_random_uuid(), '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'email', '{"sub":"11111111-1111-1111-1111-111111111111","email":"alice@example.com","email_verified":true}', now(), now(), now()),
  (extensions.gen_random_uuid(), '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'email', '{"sub":"22222222-2222-2222-2222-222222222222","email":"bob@example.com","email_verified":true}',   now(), now(), now()),
  (extensions.gen_random_uuid(), '33333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333', 'email', '{"sub":"33333333-3333-3333-3333-333333333333","email":"carol@example.com","email_verified":true}', now(), now(), now()),
  (extensions.gen_random_uuid(), '44444444-4444-4444-4444-444444444444', '44444444-4444-4444-4444-444444444444', 'email', '{"sub":"44444444-4444-4444-4444-444444444444","email":"dave@example.com","email_verified":true}',  now(), now(), now()),
  (extensions.gen_random_uuid(), '55555555-5555-5555-5555-555555555555', '55555555-5555-5555-5555-555555555555', 'email', '{"sub":"55555555-5555-5555-5555-555555555555","email":"erik@example.com","email_verified":true}',  now(), now(), now());

-- 2) Teams (vaste paren)
insert into public.teams (id, name, player1_id, player2_id)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Alice & Bob',   '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Carol & Dave',  '33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444');

-- 3) Een afgeronde match: Alice & Bob winnen van Carol & Dave
insert into public.matches (id, team_a_id, team_b_id, status, winner_team_id, played_at, created_by)
values
  ('cccccccc-cccc-cccc-cccc-cccccccccccc',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   'completed',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   now() - interval '1 day',
   '11111111-1111-1111-1111-111111111111');

-- 4) Score per punt voor de eerste game (set 1, game 1) van die match.
--    Team A wint de game met een gouden punt op het laatste punt.
insert into public.match_points (match_id, set_number, game_number, point_number, won_by_team_id, is_golden_point)
values
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 1, 1, 1, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', false),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 1, 1, 2, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', false),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 1, 1, 3, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', false),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 1, 1, 4, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', false),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 1, 1, 5, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);

-- 5) Een groep met alle vier de spelers (alice is eigenaar).
--    De trigger on_group_created voegt alice al toe als owner-lid.
insert into public.groups (id, name, created_by)
values ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Vrijdagavond Padel', '11111111-1111-1111-1111-111111111111');

insert into public.group_members (group_id, player_id, role)
values
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '22222222-2222-2222-2222-222222222222', 'member'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '33333333-3333-3333-3333-333333333333', 'member'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '44444444-4444-4444-4444-444444444444', 'member')
on conflict do nothing;

-- 6) Vriendschappen. Alle leden van de groep zijn geaccepteerde vrienden van
--    alice (de eigenaar), zodat het datamodel consistent is met de regel
--    "je voegt alleen vrienden toe". Erik stuurt alice een openstaand verzoek
--    (en zit niet in de groep) om de inkomende-verzoeken-UI te demonstreren.
insert into public.friendships (requester_id, addressee_id, status)
values
  ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'accepted'),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'accepted'),
  ('11111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444444', 'accepted'),
  ('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', 'pending');