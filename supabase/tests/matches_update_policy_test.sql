-- pgTAP-tests voor de matches-UPDATE-policies (#413): deelnemers mogen de
-- uitslag van hun eigen match invullen (scheduled -> completed); corrigeren
-- achteraf en het tijdstip wijzigen blijven bij de aanmaker.
begin;

select plan(10);

------------------------------------------------------------------------
-- Fixtures (als superuser). De trigger handle_new_user maakt de profielen.
-- t1 organiseert, t1+t2 vs t3+t4 spelen; t5 is groepslid aan de kant.
------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
values
  ('00000000-0000-0000-0000-000000000000','b0000000-0000-0000-0000-000000000001','authenticated','authenticated','u1@test.nl','x',now(),'{}','{"username":"u1"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','b0000000-0000-0000-0000-000000000002','authenticated','authenticated','u2@test.nl','x',now(),'{}','{"username":"u2"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','b0000000-0000-0000-0000-000000000003','authenticated','authenticated','u3@test.nl','x',now(),'{}','{"username":"u3"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','b0000000-0000-0000-0000-000000000004','authenticated','authenticated','u4@test.nl','x',now(),'{}','{"username":"u4"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','b0000000-0000-0000-0000-000000000005','authenticated','authenticated','u5@test.nl','x',now(),'{}','{"username":"u5"}',now(),now(),'','','','');

-- Groep met t1 als eigenaar (trigger voegt t1 toe) + t2..t5 als leden.
insert into public.groups (id, name, created_by)
values ('b0000000-0000-0000-0000-0000000000f0','Testgroep 413','b0000000-0000-0000-0000-000000000001');
insert into public.group_members (group_id, player_id, role)
values
  ('b0000000-0000-0000-0000-0000000000f0','b0000000-0000-0000-0000-000000000002','member'),
  ('b0000000-0000-0000-0000-0000000000f0','b0000000-0000-0000-0000-000000000003','member'),
  ('b0000000-0000-0000-0000-0000000000f0','b0000000-0000-0000-0000-000000000004','member'),
  ('b0000000-0000-0000-0000-0000000000f0','b0000000-0000-0000-0000-000000000005','member');

-- t1 plant twee groepsmatches t1+t2 vs t3+t4; played_at onderscheidt ze.
set local request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-000000000001","role":"authenticated"}';
select isnt(
  public.create_planned_match(
    'b0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000002',
    'b0000000-0000-0000-0000-000000000003','b0000000-0000-0000-0000-000000000004',
    '2026-01-01 10:00:00+00','b0000000-0000-0000-0000-0000000000f0',null),
  null, 'fixture: match 1 gepland'
);
select isnt(
  public.create_planned_match(
    'b0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000002',
    'b0000000-0000-0000-0000-000000000003','b0000000-0000-0000-0000-000000000004',
    '2026-01-01 11:00:00+00','b0000000-0000-0000-0000-0000000000f0',null),
  null, 'fixture: match 2 gepland'
);

------------------------------------------------------------------------
-- is_team_member
------------------------------------------------------------------------
select is(
  public.is_team_member(
    (select team_a_id from public.matches where played_at = '2026-01-01 10:00:00+00'),
    'b0000000-0000-0000-0000-000000000002'),
  true, 'is_team_member: t2 speelt in team A'
);
select is(
  public.is_team_member(
    (select team_a_id from public.matches where played_at = '2026-01-01 10:00:00+00'),
    'b0000000-0000-0000-0000-000000000005'),
  false, 'is_team_member: t5 speelt niet in team A'
);

------------------------------------------------------------------------
-- RLS-gedrag onder de rol authenticated
------------------------------------------------------------------------
set local role authenticated;

-- Deelnemer t3 (niet-aanmaker) vult de uitslag van match 1 in.
set local request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-000000000003","role":"authenticated"}';
update public.matches
   set status = 'completed', winner_team_id = team_a_id, score_a = 6, score_b = 3
 where played_at = '2026-01-01 10:00:00+00';
select is(
  (select status::text from public.matches where played_at = '2026-01-01 10:00:00+00'),
  'completed', 'deelnemer (niet-aanmaker) kan de uitslag invullen (#413)'
);

-- Groepslid t5 staat niet op de baan: RLS geeft geruisloos 0 rijen.
set local request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-000000000005","role":"authenticated"}';
update public.matches
   set status = 'completed', winner_team_id = team_a_id, score_a = 6, score_b = 0
 where played_at = '2026-01-01 11:00:00+00';
select is(
  (select status::text from public.matches where played_at = '2026-01-01 11:00:00+00'),
  'scheduled', 'groepslid dat niet meespeelt kan geen uitslag invullen'
);

-- Deelnemer t3 kan een al afgeronde match niet meer corrigeren (0 rijen).
set local request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-000000000003","role":"authenticated"}';
update public.matches
   set score_a = 6, score_b = 4
 where played_at = '2026-01-01 10:00:00+00';
select is(
  (select score_b::int from public.matches where played_at = '2026-01-01 10:00:00+00'),
  3, 'deelnemer kan een afgeronde uitslag niet corrigeren'
);

-- Deelnemer mag alleen naar 'completed': elke andere schrijfactie op een
-- geplande match (status cancelled, of enkel het tijdstip) faalt op with check.
select throws_ok(
  $$ update public.matches set status = 'cancelled'
     where played_at = '2026-01-01 11:00:00+00' $$,
  '42501', null, 'deelnemer kan een match niet annuleren'
);
select throws_ok(
  $$ update public.matches set played_at = '2026-01-02 10:00:00+00'
     where played_at = '2026-01-01 11:00:00+00' $$,
  '42501', null, 'deelnemer kan het tijdstip niet wijzigen'
);

-- De aanmaker (t1) corrigeert de afgeronde uitslag wél.
set local request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-000000000001","role":"authenticated"}';
update public.matches
   set score_a = 6, score_b = 2
 where played_at = '2026-01-01 10:00:00+00';
select is(
  (select score_b::int from public.matches where played_at = '2026-01-01 10:00:00+00'),
  2, 'aanmaker kan de afgeronde uitslag corrigeren'
);

reset role;

select * from finish();

rollback;
