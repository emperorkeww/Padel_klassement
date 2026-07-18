-- pgTAP-test voor #468: gasten (is_guest) horen niet in het groepsklassement,
-- gelijk aan player_standings en de client-mirror computePlayerStandings. Vóór
-- de fix miste public.group_player_standings het `where not p.is_guest`-filter,
-- waardoor gasten wél in het groepsklassement verschenen en niet in het globale.
begin;

select plan(4);

------------------------------------------------------------------------
-- Fixtures. De gast-eigenaar heeft een auth-account nodig (owner_id FK't
-- naar auth.users); de overige profielen mogen rechtstreeks (de FK van
-- profiles.id naar auth.users verviel met de gastmigratie).
------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
values
  ('00000000-0000-0000-0000-000000000000','e0000000-0000-0000-0000-000000000001','authenticated','authenticated','e1@test.nl','x',now(),'{}','{"username":"e1"}',now(),now(),'','','','');

-- e1 bestaat al (via de handle_new_user-trigger). e2 en e3 zijn echte spelers,
-- g1 is een gast van e1.
insert into public.profiles (id, username, full_name, is_guest, owner_id) values
  ('e0000000-0000-0000-0000-000000000002','e2','Speler Twee', false, null),
  ('e0000000-0000-0000-0000-000000000003','e3','Speler Drie', false, null),
  ('e0000000-0000-0000-0000-0000000000a1','gast_gil','Gil de Gast', true,
   'e0000000-0000-0000-0000-000000000001');

-- Groep met e1 als eigenaar (trigger voegt e1 als lid toe).
insert into public.groups (id, name, created_by)
values ('e0000000-0000-0000-0000-0000000000f0','Gastgroep',
        'e0000000-0000-0000-0000-000000000001');

-- Team A = e1 + de gast, team B = e2 + e3.
insert into public.teams (id, player1_id, player2_id) values
  ('e0000000-0000-0000-0000-0000000000b1',
   'e0000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-0000000000a1'),
  ('e0000000-0000-0000-0000-0000000000b2',
   'e0000000-0000-0000-0000-000000000002','e0000000-0000-0000-0000-000000000003');

-- Eén afgeronde groepsmatch: team A wint 6-3.
insert into public.matches
  (id, team_a_id, team_b_id, status, winner_team_id,
   score_a, score_b, played_at, created_by, group_id, format)
values
  ('e0000000-0000-0000-0000-0000000000c1',
   'e0000000-0000-0000-0000-0000000000b1','e0000000-0000-0000-0000-0000000000b2',
   'completed','e0000000-0000-0000-0000-0000000000b1',
   6, 3, now(), 'e0000000-0000-0000-0000-000000000001',
   'e0000000-0000-0000-0000-0000000000f0','2v2');

------------------------------------------------------------------------
-- Assertions op group_player_standings voor de groep.
------------------------------------------------------------------------
select is_empty(
  $$ select 1 from public.group_player_standings
      where group_id = 'e0000000-0000-0000-0000-0000000000f0'
        and player_id = 'e0000000-0000-0000-0000-0000000000a1' $$,
  'de gast verschijnt niet in het groepsklassement (#468)');

select is(
  (select count(*)::int from public.group_player_standings
    where group_id = 'e0000000-0000-0000-0000-0000000000f0'),
  3, 'het groepsklassement telt exact de drie echte spelers');

select is(
  (select won::int from public.group_player_standings
    where group_id = 'e0000000-0000-0000-0000-0000000000f0'
      and player_id = 'e0000000-0000-0000-0000-000000000001'),
  1, 'de echte medespeler (e1) telt zijn winst gewoon mee');

select is(
  (select lost::int from public.group_player_standings
    where group_id = 'e0000000-0000-0000-0000-0000000000f0'
      and player_id = 'e0000000-0000-0000-0000-000000000002'),
  1, 'de tegenstander (e2) telt zijn verlies gewoon mee');

select * from finish();

rollback;
