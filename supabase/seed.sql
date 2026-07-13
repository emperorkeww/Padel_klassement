-- Testdata voor lokale ontwikkeling.
-- Wordt automatisch geladen door `supabase db reset`.
-- LET OP: enkel voor lokaal gebruik — niet pushen als productiedata.
--
-- Doel: élke feature van de webapp tot zijn recht laten komen tijdens dev —
-- ratings/tiers (Big Daddy t/m de onderklasse), reeksen, upsets, pias van de
-- week, zwarte piet, seizoenen/kwartalen, trends, Wrapped, badges, Coach Rudy
-- (feed + dashboard + toast + pre-match), groepen met verschillende roast-
-- intensiteit, roast-schild, toto/voorspellingen, speel-polls, beschikbaarheid,
-- vrienden + suggesties en geplande matches.
--
-- De meeste afgeleide data (player_ratings, rating_history, standings, pias,
-- zwarte piet) wordt door triggers/views uit de matches berekend — we vullen
-- dus vooral matches en laten de database de rest doen.

-- 1) Testgebruikers in auth.users.
--    De trigger handle_new_user() maakt hieruit automatisch de profiles aan
--    (username/full_name komen uit raw_user_meta_data).
--    BELANGRIJK: de token-kolommen (confirmation_token, recovery_token,
--    email_change, email_change_token_new) MOETEN '' zijn i.p.v. NULL.
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
  ('00000000-0000-0000-0000-000000000000', '55555555-5555-5555-5555-555555555555', 'authenticated', 'authenticated', 'erik@example.com',  extensions.crypt('password123', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"username":"erik","full_name":"Erik Elzinga"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '66666666-6666-6666-6666-666666666666', 'authenticated', 'authenticated', 'frank@example.com', extensions.crypt('password123', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"username":"frank","full_name":"Frank Feyen"}',   now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '77777777-7777-7777-7777-777777777777', 'authenticated', 'authenticated', 'grace@example.com', extensions.crypt('password123', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"username":"grace","full_name":"Grace Gielen"}',  now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '88888888-8888-8888-8888-888888888888', 'authenticated', 'authenticated', 'henk@example.com',  extensions.crypt('password123', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"username":"henk","full_name":"Henk Hendriks"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '99999999-9999-9999-9999-999999999999', 'authenticated', 'authenticated', 'iris@example.com',  extensions.crypt('password123', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"username":"iris","full_name":"Iris Ilic"}',      now(), now(), '', '', '', '');

-- 1b) Bijbehorende identities (nieuwere GoTrue verwacht een identity-rij per user).
insert into auth.identities (
  id, user_id, provider_id, provider, identity_data, created_at, updated_at, last_sign_in_at
)
values
  (extensions.gen_random_uuid(), '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'email', '{"sub":"11111111-1111-1111-1111-111111111111","email":"alice@example.com","email_verified":true}', now(), now(), now()),
  (extensions.gen_random_uuid(), '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'email', '{"sub":"22222222-2222-2222-2222-222222222222","email":"bob@example.com","email_verified":true}',   now(), now(), now()),
  (extensions.gen_random_uuid(), '33333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333', 'email', '{"sub":"33333333-3333-3333-3333-333333333333","email":"carol@example.com","email_verified":true}', now(), now(), now()),
  (extensions.gen_random_uuid(), '44444444-4444-4444-4444-444444444444', '44444444-4444-4444-4444-444444444444', 'email', '{"sub":"44444444-4444-4444-4444-444444444444","email":"dave@example.com","email_verified":true}',  now(), now(), now()),
  (extensions.gen_random_uuid(), '55555555-5555-5555-5555-555555555555', '55555555-5555-5555-5555-555555555555', 'email', '{"sub":"55555555-5555-5555-5555-555555555555","email":"erik@example.com","email_verified":true}',  now(), now(), now()),
  (extensions.gen_random_uuid(), '66666666-6666-6666-6666-666666666666', '66666666-6666-6666-6666-666666666666', 'email', '{"sub":"66666666-6666-6666-6666-666666666666","email":"frank@example.com","email_verified":true}', now(), now(), now()),
  (extensions.gen_random_uuid(), '77777777-7777-7777-7777-777777777777', '77777777-7777-7777-7777-777777777777', 'email', '{"sub":"77777777-7777-7777-7777-777777777777","email":"grace@example.com","email_verified":true}', now(), now(), now()),
  (extensions.gen_random_uuid(), '88888888-8888-8888-8888-888888888888', '88888888-8888-8888-8888-888888888888', 'email', '{"sub":"88888888-8888-8888-8888-888888888888","email":"henk@example.com","email_verified":true}',  now(), now(), now()),
  (extensions.gen_random_uuid(), '99999999-9999-9999-9999-999999999999', '99999999-9999-9999-9999-999999999999', 'email', '{"sub":"99999999-9999-9999-9999-999999999999","email":"iris@example.com","email_verified":true}',   now(), now(), now());

-- 1c) Profiel-extra's: een foto-avatar, een roast-schild (Coach Rudy toont dan
--     de neutrale variant) en uitgelichte badges.
update public.profiles
  set avatar_url = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" rx="40" fill="%232b6cb0"/><text x="40" y="53" font-size="38" font-family="sans-serif" text-anchor="middle" fill="white">B</text></svg>'
  where id = '22222222-2222-2222-2222-222222222222';
update public.profiles set roast_schild = true where id = '99999999-9999-9999-9999-999999999999';
update public.profiles set featured_badges = '{eerste-overwinning,monsterzege,winsten-10}'
  where id = '11111111-1111-1111-1111-111111111111';

-- 2) Vaste teams voor de showcase-match (de generator hergebruikt ze via
--    _ensure_team wanneer dezelfde paren opnieuw spelen).
insert into public.teams (id, name, player1_id, player2_id)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Alice & Bob',  '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Carol & Dave', '33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444');

-- 3) Groepen met elk een andere roast-intensiteit (Coach Rudy's toon) en een
--    andere eigenaar. De trigger on_group_created voegt de eigenaar al toe.
insert into public.groups (id, name, created_by, roast_intensiteit)
values
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Vrijdagavond Padel',      '11111111-1111-1111-1111-111111111111', 'gemeen'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'De Radioactieve Rakkers', '22222222-2222-2222-2222-222222222222', 'radioactief'),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'Zen Padel Club',          '33333333-3333-3333-3333-333333333333', 'mild');

insert into public.group_members (group_id, player_id, role)
values
  -- Vrijdagavond Padel (alice = owner)
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '22222222-2222-2222-2222-222222222222', 'member'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '33333333-3333-3333-3333-333333333333', 'member'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '44444444-4444-4444-4444-444444444444', 'member'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '55555555-5555-5555-5555-555555555555', 'member'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '66666666-6666-6666-6666-666666666666', 'member'),
  -- De Radioactieve Rakkers (bob = owner)
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '11111111-1111-1111-1111-111111111111', 'member'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '44444444-4444-4444-4444-444444444444', 'member'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '77777777-7777-7777-7777-777777777777', 'member'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '88888888-8888-8888-8888-888888888888', 'member'),
  -- Zen Padel Club (carol = owner)
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', '44444444-4444-4444-4444-444444444444', 'member'),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', '55555555-5555-5555-5555-555555555555', 'member'),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', '77777777-7777-7777-7777-777777777777', 'member'),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', '99999999-9999-9999-9999-999999999999', 'member')
on conflict do nothing;

-- 4) Showcase-match met per-punt-score (gouden punt) en set-scores voor de
--    match-detailpagina. Alice & Bob winnen van Carol & Dave.
insert into public.matches (id, team_a_id, team_b_id, status, winner_team_id, score_a, score_b, set_scores, played_at, created_by, group_id)
values
  ('cccccccc-cccc-cccc-cccc-cccccccccccc',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   'completed', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 6, 4,
   '[{"a":6,"b":4}]'::jsonb, now() - interval '2 days', '11111111-1111-1111-1111-111111111111',
   'dddddddd-dddd-dddd-dddd-dddddddddddd');

insert into public.match_points (match_id, set_number, game_number, point_number, won_by_team_id, is_golden_point)
values
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 1, 1, 1, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', false),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 1, 1, 2, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', false),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 1, 1, 3, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', false),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 1, 1, 4, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', false),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 1, 1, 5, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);

-- 5) Een heel seizoen aan afgeronde matches, generatief opgebouwd. De twee
--    sterkste van elk viertal vormen samen het favoriete team en winnen ~80%
--    (soms een upset). Zo krijgen de spelers een oplopende rating-spreiding
--    (Big Daddy bovenaan, de onderklasse onderaan), reeksen, bagels,
--    monsterzeges, upsets en genoeg groepsmatches voor pias + zwarte piet.
--    Gespreid over ~9 maanden → seizoenen/kwartalen, trends en Wrapped.
do $$
declare
  ids uuid[] := array[
    '11111111-1111-1111-1111-111111111111', -- alice  (sterkst)
    '22222222-2222-2222-2222-222222222222', -- bob
    '33333333-3333-3333-3333-333333333333', -- carol
    '44444444-4444-4444-4444-444444444444', -- dave
    '55555555-5555-5555-5555-555555555555', -- erik
    '66666666-6666-6666-6666-666666666666', -- frank
    '77777777-7777-7777-7777-777777777777', -- grace
    '88888888-8888-8888-8888-888888888888', -- henk
    '99999999-9999-9999-9999-999999999999'  -- iris   (zwakst)
  ];
  grps uuid[] := array[
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    'ffffffff-ffff-ffff-ffff-ffffffffffff'
  ];
  n int := 9;
  seed bigint := 20260712;
  wk int; k int; matches_this_week int;
  pick int[]; x int;
  skill_a int; skill_b int; gap int;
  team_a uuid; team_b uuid; winner_team uuid;
  a_wins boolean; rnd double precision;
  sa int; sb int; gid uuid; played timestamptz;
begin
  for wk in reverse 38..0 loop
    matches_this_week := 1 + (wk % 2);
    for k in 1..matches_this_week loop
      -- kies 4 unieke spelers via een deterministische LCG
      pick := array[]::int[];
      while array_length(pick, 1) is distinct from 4 loop
        seed := (seed * 1103515245 + 12345) % 2147483648;
        x := 1 + (seed % n)::int;
        if not (x = any(pick)) then pick := pick || x; end if;
      end loop;
      pick := (select array_agg(v order by v) from unnest(pick) as t(v));
      -- team A = twee sterkste (laagste index), team B = twee zwakste
      team_a := public._ensure_team(ids[pick[1]], ids[pick[2]]);
      team_b := public._ensure_team(ids[pick[3]], ids[pick[4]]);
      skill_a := (n - pick[1]) + (n - pick[2]);
      skill_b := (n - pick[3]) + (n - pick[4]);
      gap := skill_a - skill_b;
      -- favoriet (team A) wint 80%, anders upset
      seed := (seed * 1103515245 + 12345) % 2147483648;
      rnd := (seed % 1000) / 1000.0;
      a_wins := rnd > 0.2;
      -- score naar kloofgrootte: soms een bagel of monsterzege
      if gap >= 6 then sa := 6; sb := 0;
      elsif gap >= 3 then sa := 6; sb := 2;
      else sa := 6; sb := 4; end if;
      if not a_wins then x := sa; sa := sb; sb := x; end if;
      winner_team := case when a_wins then team_a else team_b end;
      -- ~2/3 in een groep (roteert), rest casual
      seed := (seed * 1103515245 + 12345) % 2147483648;
      if (seed % 3) = 0 then gid := null;
      else gid := grps[1 + (seed % 3)::int]; end if;
      played := now() - (wk * interval '7 days') - (k * interval '30 hours');
      insert into public.matches
        (team_a_id, team_b_id, status, winner_team_id, score_a, score_b, played_at, created_by, group_id)
      values
        (team_a, team_b, 'completed', winner_team, sa, sb, played, ids[pick[1]], gid);
    end loop;
  end loop;

  -- 5b) Verse, dikke upset in een groep: sterke favorieten (bob & carol) gaan
  --     onderuit tegen de hekkensluiters (henk & iris). Voedt pias van de week
  --     (verliezer was favoriet) én zwarte piet.
  insert into public.matches
    (team_a_id, team_b_id, status, winner_team_id, score_a, score_b, played_at, created_by, group_id)
  values
    (public._ensure_team(ids[2], ids[3]), public._ensure_team(ids[8], ids[9]),
     'completed', public._ensure_team(ids[8], ids[9]), 4, 6,
     now() - interval '20 hours', ids[8], 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee');

  -- 5c) Recente winreeks voor alice (de standaard dev-login): naar de top met
  --     een actieve reeks → Big Daddy, streak-badge, dashboard-hype, feed.
  for k in 1..5 loop
    team_a := public._ensure_team(ids[1], ids[2 + (k % 4)]);
    team_b := public._ensure_team(ids[8], ids[9]);
    insert into public.matches
      (team_a_id, team_b_id, status, winner_team_id, score_a, score_b, played_at, created_by, group_id)
    values
      (team_a, team_b, 'completed', team_a, 6, 2,
       now() - ((6 - k) * interval '1 day'), ids[1], grps[1 + (k % 3)]);
  end loop;

  -- 5d) Recente verliesreeks voor grace → duidelijke onderklasse + Coach Rudy's
  --     "oei, alweer verloren"-briefing op haar dashboard.
  for k in 1..3 loop
    insert into public.matches
      (team_a_id, team_b_id, status, winner_team_id, score_a, score_b, played_at, created_by, group_id)
    values
      (public._ensure_team(ids[3], ids[4]), public._ensure_team(ids[7], ids[9]),
       'completed', public._ensure_team(ids[3], ids[4]), 6, 1,
       now() - ((4 - k) * interval '1 day') - interval '4 hours', ids[3],
       grps[1 + (k % 3)]);
  end loop;
end $$;

-- 6) Geplande matches (status 'scheduled') voor "Te spelen", de volgende-match
--    op het dashboard en Coach Rudy's pre-match hype.
do $$
declare
  a uuid := '11111111-1111-1111-1111-111111111111';
  b uuid := '22222222-2222-2222-2222-222222222222';
  c uuid := '33333333-3333-3333-3333-333333333333';
  d uuid := '44444444-4444-4444-4444-444444444444';
  e uuid := '55555555-5555-5555-5555-555555555555';
  f uuid := '66666666-6666-6666-6666-666666666666';
begin
  -- casual geplande match (alice & carol vs bob & dave), over 2 dagen
  insert into public.matches (team_a_id, team_b_id, status, played_at, created_by)
  values (public._ensure_team(a, c), public._ensure_team(b, d), 'scheduled',
          now() + interval '2 days', a);
  -- groepsmatch zonder tijd (nog te plannen) in Vrijdagavond Padel
  insert into public.matches (team_a_id, team_b_id, status, created_by, group_id, round_number)
  values (public._ensure_team(a, f), public._ensure_team(c, e), 'scheduled',
          a, 'dddddddd-dddd-dddd-dddd-dddddddddddd', 1);
end $$;

-- 7) Toto / voorspellingen (#116). Twee scenario's:
--    a) een OPEN toto op een geplande groepsmatch (tips staan open);
--    b) een AFGEHANDELDE toto: tips geplaatst terwijl de match nog gepland was,
--       daarna afgerond → punten worden automatisch toegekend (grade-trigger).
--    De guard-trigger overschrijft win_chance zelf; wij geven 0.5 als plaatshouder.
do $$
declare
  a uuid := '11111111-1111-1111-1111-111111111111';
  b uuid := '22222222-2222-2222-2222-222222222222';
  d uuid := '44444444-4444-4444-4444-444444444444';
  g uuid := '77777777-7777-7777-7777-777777777777';
  h uuid := '88888888-8888-8888-8888-888888888888';
  grp uuid := 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
  ta uuid; tb uuid; mid uuid;
begin
  -- a) OPEN toto: geplande groepsmatch over 3 dagen, met twee tips.
  ta := public._ensure_team(a, d);
  tb := public._ensure_team(g, h);
  insert into public.matches (team_a_id, team_b_id, status, played_at, created_by, group_id)
  values (ta, tb, 'scheduled', now() + interval '3 days', b, grp)
  returning id into mid;
  insert into public.match_predictions (match_id, player_id, group_id, predicted_team_id, win_chance)
  values (mid, b, grp, ta, 0.5),
         (mid, g, grp, tb, 0.5);

  -- b) AFGEHANDELDE toto: eerst gepland (zodat tips mogen), tips geplaatst,
  --    daarna afgerond → grade-trigger vult de punten.
  ta := public._ensure_team(b, g);
  tb := public._ensure_team(a, h);
  insert into public.matches (team_a_id, team_b_id, status, played_at, created_by, group_id)
  values (ta, tb, 'scheduled', now() + interval '1 day', b, grp)
  returning id into mid;
  insert into public.match_predictions (match_id, player_id, group_id, predicted_team_id, win_chance)
  values (mid, b, grp, ta, 0.5),
         (mid, h, grp, tb, 0.5),
         (mid, a, grp, tb, 0.5);
  update public.matches
    set status = 'completed', winner_team_id = tb, score_a = 3, score_b = 6,
        played_at = now() - interval '1 day'
    where id = mid;
end $$;

-- 8) Speel-poll: één open poll in Vrijdagavond Padel met twee opties en wat
--    stemmen (ja/nee/misschien).
do $$
declare
  grp uuid := 'dddddddd-dddd-dddd-dddd-dddddddddddd';
  a uuid := '11111111-1111-1111-1111-111111111111';
  b uuid := '22222222-2222-2222-2222-222222222222';
  c uuid := '33333333-3333-3333-3333-333333333333';
  e uuid := '55555555-5555-5555-5555-555555555555';
  pid uuid; o1 uuid; o2 uuid;
begin
  insert into public.play_polls (group_id, created_by, status, club_id, club_name, club_city, club_timezone)
  values (grp, a, 'open',
          '91d8d419-3736-498e-90be-362de786d588', 'LAGO CLUB Padel Beveren', 'Beveren', 'Europe/Brussels')
  returning id into pid;
  insert into public.play_poll_options (poll_id, group_id, date, start_time, duration, courts_free)
  values (pid, grp, (now() + interval '5 days')::date, '19:00', 90, 3) returning id into o1;
  insert into public.play_poll_options (poll_id, group_id, date, start_time, duration, courts_free)
  values (pid, grp, (now() + interval '7 days')::date, '20:30', 90, 2) returning id into o2;
  insert into public.play_poll_votes (option_id, group_id, player_id, status)
  values (o1, grp, a, 'yes'), (o1, grp, b, 'yes'), (o1, grp, c, 'maybe'),
         (o2, grp, a, 'yes'), (o2, grp, e, 'no'), (o2, grp, b, 'maybe');
end $$;

-- 9) Beschikbaarheid: aanwezigheid per dag + per tijdslot in een groep.
insert into public.attendance (group_id, player_id, date, status)
values
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111', (now() + interval '5 days')::date, 'yes'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '22222222-2222-2222-2222-222222222222', (now() + interval '5 days')::date, 'yes'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '33333333-3333-3333-3333-333333333333', (now() + interval '5 days')::date, 'maybe')
on conflict do nothing;

insert into public.slot_availability (group_id, player_id, date, start_time, status)
values
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111', (now() + interval '5 days')::date, '19:00', 'yes'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '22222222-2222-2222-2222-222222222222', (now() + interval '5 days')::date, '19:00', 'yes'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '55555555-5555-5555-5555-555555555555', (now() + interval '5 days')::date, '20:30', 'maybe')
on conflict do nothing;

-- 10) Uitnodigingslink voor een groep (join-flow).
insert into public.group_invites (group_id, created_by, expires_at)
values ('dddddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111', now() + interval '14 days');

-- 11) Vriendschappen. De groepsleden zijn geaccepteerde vrienden van alice; erik
--     stuurt alice een openstaand verzoek (inkomende-verzoeken-UI). Daarnaast
--     vrienden-van-vrienden voor de "Misschien ken je"-suggesties.
insert into public.friendships (requester_id, addressee_id, status)
values
  ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'accepted'),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'accepted'),
  ('11111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444444', 'accepted'),
  ('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', 'pending'),
  -- vrienden-van-vrienden (niet direct met alice verbonden):
  ('66666666-6666-6666-6666-666666666666', '22222222-2222-2222-2222-222222222222', 'accepted'),
  ('66666666-6666-6666-6666-666666666666', '33333333-3333-3333-3333-333333333333', 'accepted'),
  ('66666666-6666-6666-6666-666666666666', '44444444-4444-4444-4444-444444444444', 'accepted'),
  ('77777777-7777-7777-7777-777777777777', '22222222-2222-2222-2222-222222222222', 'accepted'),
  ('77777777-7777-7777-7777-777777777777', '33333333-3333-3333-3333-333333333333', 'accepted'),
  ('88888888-8888-8888-8888-888888888888', '44444444-4444-4444-4444-444444444444', 'accepted');
