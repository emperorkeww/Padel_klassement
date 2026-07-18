-- pgTAP-tests voor de matches-UPDATE-policies (#413): deelnemers mogen de
-- uitslag van hun eigen match invullen (scheduled -> completed); corrigeren
-- achteraf en het tijdstip wijzigen blijven bij de aanmaker.
begin;

select plan(13);

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

-- #432: de kolom-grant beperkt de UPDATE tot de uitslag-kolommen. Een deelnemer
-- die bij het invullen van de uitslag ook created_by of group_id probeert mee te
-- schrijven, wordt door de grant geweigerd (42501) — nog vóór RLS. Zonder deze
-- grant zou de rij-policy de write toestaan (status wordt 'completed').
select throws_ok(
  $$ update public.matches
        set status = 'completed', winner_team_id = team_a_id, score_a = 6, score_b = 1,
            created_by = 'b0000000-0000-0000-0000-000000000003'
      where played_at = '2026-01-01 11:00:00+00' $$,
  '42501', null, 'deelnemer kan created_by niet meeschrijven (#432)'
);
select throws_ok(
  $$ update public.matches
        set status = 'completed', winner_team_id = team_a_id, score_a = 6, score_b = 1,
            group_id = null
      where played_at = '2026-01-01 11:00:00+00' $$,
  '42501', null, 'deelnemer kan group_id niet meeschrijven (#432)'
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

-- Regressie #432: played_at valt binnen de kolom-grant, dus de aanmaker kan het
-- tijdstip van een geplande match nog steeds verplaatsen (updatePlannedMatchTime).
update public.matches
   set played_at = '2026-01-03 09:00:00+00'
 where played_at = '2026-01-01 11:00:00+00';
select is(
  (select count(*)::int from public.matches where played_at = '2026-01-03 09:00:00+00'),
  1, 'aanmaker kan het tijdstip van een geplande match verplaatsen (#432)'
);

reset role;

select * from finish();

rollback;
