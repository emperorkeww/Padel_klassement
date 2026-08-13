-- pgTAP-tests voor de rondenummering per speeldag (#1271).
--
-- `round_number` was max+1 over de hele groep: de tiende speeldag begon bij
-- "Ronde 37", en de app droeg twee guards om te voorkomen dat er "ronde 4 van
-- 3" kwam te staan. Een ronde hoort te tellen binnen zijn eigen avond.
--
-- De dag komt uit het starttijdstip van de ronde (#827), in clubtijd.
begin;

select plan(6);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
values
  ('00000000-0000-0000-0000-000000000000','b0000000-0000-0000-0000-000000000001','authenticated','authenticated','rn1@test.nl','x',now(),'{}','{"username":"rn1"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','b0000000-0000-0000-0000-000000000002','authenticated','authenticated','rn2@test.nl','x',now(),'{}','{"username":"rn2"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','b0000000-0000-0000-0000-000000000003','authenticated','authenticated','rn3@test.nl','x',now(),'{}','{"username":"rn3"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','b0000000-0000-0000-0000-000000000004','authenticated','authenticated','rn4@test.nl','x',now(),'{}','{"username":"rn4"}',now(),now(),'','','','');

insert into public.groups (id, name, created_by)
values ('b0000000-0000-0000-0000-0000000000f0','Nummergroep','b0000000-0000-0000-0000-000000000001');
insert into public.group_members (group_id, player_id, role)
values
  ('b0000000-0000-0000-0000-0000000000f0','b0000000-0000-0000-0000-000000000002','member'),
  ('b0000000-0000-0000-0000-0000000000f0','b0000000-0000-0000-0000-000000000003','member'),
  ('b0000000-0000-0000-0000-0000000000f0','b0000000-0000-0000-0000-000000000004','member');

set local request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-000000000001","role":"authenticated"}';

-- Twee rondes op de avond van 20 augustus.
select is(
  (select count(*)::int from public.create_fair_round(
     'b0000000-0000-0000-0000-0000000000f0',
     array['b0000000-0000-0000-0000-000000000001',
           'b0000000-0000-0000-0000-000000000002',
           'b0000000-0000-0000-0000-000000000003',
           'b0000000-0000-0000-0000-000000000004']::uuid[],
     '2026-08-20 18:00:00+00')),
  1, 'ronde 1 van 20 augustus staat er'
);
select is(
  (select round_number::int from public.matches
   where played_at = '2026-08-20 18:00:00+00'),
  1, 'de eerste ronde van een speeldag heet 1'
);

select public.create_fair_round(
  'b0000000-0000-0000-0000-0000000000f0',
  array['b0000000-0000-0000-0000-000000000001',
        'b0000000-0000-0000-0000-000000000002',
        'b0000000-0000-0000-0000-000000000003',
        'b0000000-0000-0000-0000-000000000004']::uuid[],
  '2026-08-20 18:10:00+00');
select is(
  (select round_number::int from public.matches
   where played_at = '2026-08-20 18:10:00+00'),
  2, 'de tweede ronde van dezelfde avond heet 2'
);

-- En een week later begint het opnieuw bij 1 — dát is de hele fix.
select public.create_fair_round(
  'b0000000-0000-0000-0000-0000000000f0',
  array['b0000000-0000-0000-0000-000000000001',
        'b0000000-0000-0000-0000-000000000002',
        'b0000000-0000-0000-0000-000000000003',
        'b0000000-0000-0000-0000-000000000004']::uuid[],
  '2026-08-27 18:00:00+00');
select is(
  (select round_number::int from public.matches
   where played_at = '2026-08-27 18:00:00+00'),
  1, 'een volgende speeldag begint weer bij 1'
);

-- De oude rondes blijven staan zoals ze waren.
select is(
  (select count(*)::int from public.matches
   where group_id = 'b0000000-0000-0000-0000-0000000000f0'
     and round_number = 1),
  2, 'twee speeldagen dragen allebei een ronde 1'
);

-- Mexicano telt op dezelfde manier. De blokkade eist eerst alle uitslagen.
update public.matches
   set status = 'completed', winner_team_id = team_a_id, score_a = 6, score_b = 3
 where group_id = 'b0000000-0000-0000-0000-0000000000f0';
select public.generate_mexicano_round(
  'b0000000-0000-0000-0000-0000000000f0',
  '2026-08-27 18:10:00+00');
select is(
  (select round_number::int from public.matches
   where played_at = '2026-08-27 18:10:00+00'),
  2, 'Mexicano telt binnen dezelfde speeldag door'
);

select * from finish();

rollback;
