-- Testdata voor lokale ontwikkeling.
-- Wordt automatisch geladen door `supabase db reset`.
-- LET OP: enkel voor lokaal gebruik — niet pushen als productiedata.

-- 1) Testgebruikers in auth.users.
--    De trigger handle_new_user() maakt hieruit automatisch de profiles aan
--    (username/full_name komen uit raw_user_meta_data).
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', 'alice@example.com', extensions.crypt('password123', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"username":"alice","full_name":"Alice Anders"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated', 'bob@example.com',   extensions.crypt('password123', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"username":"bob","full_name":"Bob Boers"}',     now(), now()),
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-3333-3333-333333333333', 'authenticated', 'authenticated', 'carol@example.com', extensions.crypt('password123', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"username":"carol","full_name":"Carol Claes"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '44444444-4444-4444-4444-444444444444', 'authenticated', 'authenticated', 'dave@example.com',  extensions.crypt('password123', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"username":"dave","full_name":"Dave De Vos"}',  now(), now());

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