-- pgTAP-tests voor delete_round (#1271).
--
-- Er was geen weg terug van een verkeerd gegenereerde ronde: alleen match voor
-- match via ⋯ → "Verwijderen", zes seconden undo, keer drie banen keer N
-- rondes. Wat deze suite vastlegt is waar de grens ligt — een ronde mét
-- uitslagen blijft buiten bereik, want die raakt de stand en de Elo-keten.
begin;

select plan(7);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
values
  ('00000000-0000-0000-0000-000000000000','e1000000-0000-0000-0000-000000000001','authenticated','authenticated','dr1@test.nl','x',now(),'{}','{"username":"dr1"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','e1000000-0000-0000-0000-000000000002','authenticated','authenticated','dr2@test.nl','x',now(),'{}','{"username":"dr2"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','e1000000-0000-0000-0000-000000000003','authenticated','authenticated','dr3@test.nl','x',now(),'{}','{"username":"dr3"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','e1000000-0000-0000-0000-000000000004','authenticated','authenticated','dr4@test.nl','x',now(),'{}','{"username":"dr4"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','e1000000-0000-0000-0000-000000000009','authenticated','authenticated','dr9@test.nl','x',now(),'{}','{"username":"dr9"}',now(),now(),'','','','');

-- e…01 bezit de groep; e…02 is gewoon lid en zet ronde 1 klaar.
insert into public.groups (id, name, created_by)
values ('e1000000-0000-0000-0000-0000000000f0','Wisgroep','e1000000-0000-0000-0000-000000000001');
insert into public.group_members (group_id, player_id, role)
values
  ('e1000000-0000-0000-0000-0000000000f0','e1000000-0000-0000-0000-000000000002','member'),
  ('e1000000-0000-0000-0000-0000000000f0','e1000000-0000-0000-0000-000000000003','member'),
  ('e1000000-0000-0000-0000-0000000000f0','e1000000-0000-0000-0000-000000000004','member');

set local role authenticated;
set local request.jwt.claims = '{"sub":"e1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select public.create_fair_round(
  'e1000000-0000-0000-0000-0000000000f0',
  array['e1000000-0000-0000-0000-000000000001',
        'e1000000-0000-0000-0000-000000000002',
        'e1000000-0000-0000-0000-000000000003',
        'e1000000-0000-0000-0000-000000000004']::uuid[],
  '2026-09-04 18:00:00+00');
select public.create_fair_round(
  'e1000000-0000-0000-0000-0000000000f0',
  array['e1000000-0000-0000-0000-000000000001',
        'e1000000-0000-0000-0000-000000000002',
        'e1000000-0000-0000-0000-000000000003',
        'e1000000-0000-0000-0000-000000000004']::uuid[],
  '2026-09-04 18:10:00+00');
-- En dezelfde ronde 1 op een ándere avond: die mag niet meesneuvelen.
select public.create_fair_round(
  'e1000000-0000-0000-0000-0000000000f0',
  array['e1000000-0000-0000-0000-000000000001',
        'e1000000-0000-0000-0000-000000000002',
        'e1000000-0000-0000-0000-000000000003',
        'e1000000-0000-0000-0000-000000000004']::uuid[],
  '2026-09-11 18:00:00+00');

-- Een buitenstaander komt er niet in.
set local request.jwt.claims = '{"sub":"e1000000-0000-0000-0000-000000000009","role":"authenticated"}';
select throws_ok(
  $$ select public.delete_round('e1000000-0000-0000-0000-0000000000f0', 1::smallint, '2026-09-04') $$,
  'Geen toegang tot deze groep',
  'een niet-lid kan geen ronde wissen'
);

-- Een lid dat de ronde niet aanmaakte evenmin.
set local request.jwt.claims = '{"sub":"e1000000-0000-0000-0000-000000000003","role":"authenticated"}';
select throws_ok(
  $$ select public.delete_round('e1000000-0000-0000-0000-0000000000f0', 1::smallint, '2026-09-04') $$,
  'Alleen wie de ronde klaarzette of de groepseigenaar kan hem wissen',
  'een ander lid kan de ronde niet wissen'
);

-- De aanmaker wel.
set local request.jwt.claims = '{"sub":"e1000000-0000-0000-0000-000000000002","role":"authenticated"}';
select is(
  public.delete_round('e1000000-0000-0000-0000-0000000000f0', 1::smallint, '2026-09-04'),
  1, 'de aanmaker wist ronde 1 van die avond'
);

select is(
  (select count(*)::int from public.matches
   where group_id = 'e1000000-0000-0000-0000-0000000000f0'
     and played_at = '2026-09-11 18:00:00+00'),
  1, 'de ronde 1 van een andere avond blijft staan'
);

select is(
  (select count(*)::int from public.matches
   where group_id = 'e1000000-0000-0000-0000-0000000000f0'
     and played_at = '2026-09-04 18:10:00+00'),
  1, 'ronde 2 van dezelfde avond blijft staan'
);

-- Een ronde met een uitslag blijft buiten bereik: dat raakt de stand.
update public.matches
   set status = 'completed', winner_team_id = team_a_id, score_a = 6, score_b = 2
 where played_at = '2026-09-04 18:10:00+00';
select throws_ok(
  $$ select public.delete_round('e1000000-0000-0000-0000-0000000000f0', 2::smallint, '2026-09-04') $$,
  'Deze ronde heeft al uitslagen; verwijder die matches los.',
  'een ronde met uitslagen wordt geweigerd'
);

-- De groepseigenaar mag ook zonder zelf aangemaakt te hebben.
set local request.jwt.claims = '{"sub":"e1000000-0000-0000-0000-000000000001","role":"authenticated"}';
select is(
  public.delete_round('e1000000-0000-0000-0000-0000000000f0', 1::smallint, '2026-09-11'),
  1, 'de groepseigenaar wist andermans ronde'
);

reset role;

select * from finish();

rollback;
