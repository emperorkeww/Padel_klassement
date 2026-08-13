-- pgTAP-tests voor play_poll_presence (#1271).
--
-- Aanwezigheid stond in localStorage: onzichtbaar voor een tweede organisator,
-- weg na een apparaatwissel, en de speler die afzegde zag zichzelf gewoon in de
-- opstelling staan. In de database komt daar een rechtenvraag bij die er eerst
-- niet was, en die legt deze suite vast:
--
--   * een lid ziet de aanwezigheid van zijn eigen groep, en van een andere niet;
--   * je zet je eigen aanwezigheid — dat is het afmelden dat na het vastleggen
--     nergens meer kon;
--   * je zet die van een ander níét, tenzij je de speeldag beheert;
--   * de organisator zet die van iedereen, want dat is zijn correctie;
--   * en anon komt er helemaal niet in.
begin;

select plan(12);

------------------------------------------------------------------------
-- Fixtures. a1 bezit de groep en maakt de poll; a2 en a3 zijn lid; a4 zit in
-- een andere groep. De trigger op groups maakt de eigenaar owner-lid.
------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
values
  ('00000000-0000-0000-0000-000000000000','a0000000-0000-0000-0000-000000000001','authenticated','authenticated','aw1@test.nl','x',now(),'{}','{"username":"aw1"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','a0000000-0000-0000-0000-000000000002','authenticated','authenticated','aw2@test.nl','x',now(),'{}','{"username":"aw2"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','a0000000-0000-0000-0000-000000000003','authenticated','authenticated','aw3@test.nl','x',now(),'{}','{"username":"aw3"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','a0000000-0000-0000-0000-000000000004','authenticated','authenticated','aw4@test.nl','x',now(),'{}','{"username":"aw4"}',now(),now(),'','','','');

insert into public.groups (id, name, created_by)
values ('a0000000-0000-0000-0000-0000000000f0','Aanwezigheidsgroep','a0000000-0000-0000-0000-000000000001');
insert into public.group_members (group_id, player_id, role)
values
  ('a0000000-0000-0000-0000-0000000000f0','a0000000-0000-0000-0000-000000000002','member'),
  ('a0000000-0000-0000-0000-0000000000f0','a0000000-0000-0000-0000-000000000003','member');

insert into public.groups (id, name, created_by)
values ('a0000000-0000-0000-0000-0000000000f1','Andere groep','a0000000-0000-0000-0000-000000000004');

-- De poll is van a1 (de eigenaar), met één kandidaat-moment.
insert into public.play_polls (id, group_id, created_by, status, club_name, club_timezone)
values (
  'a0000000-0000-0000-0000-0000000000e0',
  'a0000000-0000-0000-0000-0000000000f0',
  'a0000000-0000-0000-0000-000000000001',
  'locked', 'Testclub', 'Europe/Brussels'
);
insert into public.play_poll_options (id, poll_id, group_id, date, start_time, duration)
values (
  'a0000000-0000-0000-0000-0000000000d0',
  'a0000000-0000-0000-0000-0000000000e0',
  'a0000000-0000-0000-0000-0000000000f0',
  '2026-08-20', '20:00', 90
);

------------------------------------------------------------------------
-- Als a3: een gewoon lid.
------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000003","role":"authenticated"}';

select lives_ok(
  $$ insert into public.play_poll_presence (option_id, group_id, player_id, aanwezig)
     values ('a0000000-0000-0000-0000-0000000000d0',
             'a0000000-0000-0000-0000-0000000000f0',
             'a0000000-0000-0000-0000-000000000003', false) $$,
  'een lid meldt zichzelf af, ook al staat het moment al vast'
);

select is(
  (select aanwezig from public.play_poll_presence
   where player_id = 'a0000000-0000-0000-0000-000000000003'),
  false, 'die afmelding staat er ook echt'
);

select throws_ok(
  $$ insert into public.play_poll_presence (option_id, group_id, player_id, aanwezig)
     values ('a0000000-0000-0000-0000-0000000000d0',
             'a0000000-0000-0000-0000-0000000000f0',
             'a0000000-0000-0000-0000-000000000002', false) $$,
  '42501', null, 'een lid meldt een ander niet af'
);

-- Het gedenormaliseerde group_id moet bij de optie horen, anders kun je een rij
-- in een groep hangen waar de optie niet thuishoort.
select throws_ok(
  $$ insert into public.play_poll_presence (option_id, group_id, player_id, aanwezig)
     values ('a0000000-0000-0000-0000-0000000000d0',
             'a0000000-0000-0000-0000-0000000000f1',
             'a0000000-0000-0000-0000-000000000003', true) $$,
  '42501', null, 'group_id moet bij de optie horen'
);

------------------------------------------------------------------------
-- Als a1: de organisator van de speeldag.
------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';

select lives_ok(
  $$ insert into public.play_poll_presence (option_id, group_id, player_id, aanwezig)
     values ('a0000000-0000-0000-0000-0000000000d0',
             'a0000000-0000-0000-0000-0000000000f0',
             'a0000000-0000-0000-0000-000000000002', false) $$,
  'de organisator meldt een ander af'
);

select lives_ok(
  $$ update public.play_poll_presence set aanwezig = true
     where player_id = 'a0000000-0000-0000-0000-000000000003' $$,
  'de organisator draait de afmelding van een lid terug'
);

select is(
  (select count(*)::int from public.play_poll_presence),
  2, 'de organisator ziet beide rijen'
);

-- Een niet-lid in de opstelling zetten kan niet: a4 zit in een andere groep.
select throws_ok(
  $$ insert into public.play_poll_presence (option_id, group_id, player_id, aanwezig)
     values ('a0000000-0000-0000-0000-0000000000d0',
             'a0000000-0000-0000-0000-0000000000f0',
             'a0000000-0000-0000-0000-000000000004', true) $$,
  '42501', null, 'iemand buiten de groep komt er niet in'
);

------------------------------------------------------------------------
-- Als a4: lid van een ándere groep.
------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000004","role":"authenticated"}';

select is(
  (select count(*)::int from public.play_poll_presence),
  0, 'een buitenstaander ziet niets'
);

-- Let op de vorm: RLS weigert dit niet met een fout maar met nul rijen — de
-- rijen bestaan voor hem niet. Een `throws_ok` zou hier dus groen worden om de
-- verkeerde reden; het bewijs zit in wat er ná afloop nog staat.
select lives_ok(
  $$ update public.play_poll_presence set aanwezig = false $$,
  'een update van een buitenstaander loopt leeg in plaats van fout'
);

set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';
select is(
  (select aanwezig from public.play_poll_presence
   where player_id = 'a0000000-0000-0000-0000-000000000003'),
  true, 'en heeft niets veranderd'
);

------------------------------------------------------------------------
-- Als anon. De les van #1049: `revoke ... from public` volstaat niet, anon
-- houdt zijn eigen grant. Deze assertie moet negatief blijven.
------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select is(
  (select count(*)::int from public.play_poll_presence),
  0, 'anon ziet niets'
);

reset role;

select * from finish();

rollback;
