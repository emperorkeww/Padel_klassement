-- pgTAP-tests voor de policy "Groepseigenaar kan uitslag invullen": de eigenaar
-- van de groep mag de uitslag van een groepsmatch invullen, ook als hij zelf
-- niet meespeelt en de match niet aanmaakte. Dezelfde begrenzing als bij een
-- deelnemer: alleen de overgang naar 'completed' op een nog niet afgeronde
-- match — corrigeren, annuleren en verplaatsen blijven bij de aanmaker.
begin;

select plan(14);

------------------------------------------------------------------------
-- Fixtures (als superuser). De trigger handle_new_user maakt de profielen.
-- c1 maakt de matches en speelt met c2 tegen c3+c4; c5 bezit de groep maar
-- staat niet op de baan; c6 is gewoon lid; c7 bezit een ándere groep.
------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
values
  ('00000000-0000-0000-0000-000000000000','c0000000-0000-0000-0000-000000000001','authenticated','authenticated','g1@test.nl','x',now(),'{}','{"username":"g1"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','c0000000-0000-0000-0000-000000000002','authenticated','authenticated','g2@test.nl','x',now(),'{}','{"username":"g2"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','c0000000-0000-0000-0000-000000000003','authenticated','authenticated','g3@test.nl','x',now(),'{}','{"username":"g3"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','c0000000-0000-0000-0000-000000000004','authenticated','authenticated','g4@test.nl','x',now(),'{}','{"username":"g4"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','c0000000-0000-0000-0000-000000000005','authenticated','authenticated','g5@test.nl','x',now(),'{}','{"username":"g5"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','c0000000-0000-0000-0000-000000000006','authenticated','authenticated','g6@test.nl','x',now(),'{}','{"username":"g6"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','c0000000-0000-0000-0000-000000000007','authenticated','authenticated','g7@test.nl','x',now(),'{}','{"username":"g7"}',now(),now(),'','','','');

-- Groep met c5 als eigenaar (de trigger maakt hem owner-lid) + c1..c4 en c6.
insert into public.groups (id, name, created_by)
values ('c0000000-0000-0000-0000-0000000000f0','Testgroep eigenaar','c0000000-0000-0000-0000-000000000005');
insert into public.group_members (group_id, player_id, role)
values
  ('c0000000-0000-0000-0000-0000000000f0','c0000000-0000-0000-0000-000000000001','member'),
  ('c0000000-0000-0000-0000-0000000000f0','c0000000-0000-0000-0000-000000000002','member'),
  ('c0000000-0000-0000-0000-0000000000f0','c0000000-0000-0000-0000-000000000003','member'),
  ('c0000000-0000-0000-0000-0000000000f0','c0000000-0000-0000-0000-000000000004','member'),
  ('c0000000-0000-0000-0000-0000000000f0','c0000000-0000-0000-0000-000000000006','member');

-- Tweede groep, met c7 als eigenaar. Die groep heeft niets met de matches te maken.
insert into public.groups (id, name, created_by)
values ('c0000000-0000-0000-0000-0000000000f1','Andere groep','c0000000-0000-0000-0000-000000000007');

-- c1 plant twee groepsmatches c1+c2 vs c3+c4; played_at onderscheidt ze.
set local request.jwt.claims = '{"sub":"c0000000-0000-0000-0000-000000000001","role":"authenticated"}';
select isnt(
  public.create_planned_match(
    'c0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000002',
    'c0000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000004',
    '2026-02-01 10:00:00+00','c0000000-0000-0000-0000-0000000000f0',null),
  null, 'fixture: match 1 gepland'
);
select isnt(
  public.create_planned_match(
    'c0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000002',
    'c0000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000004',
    '2026-02-01 11:00:00+00','c0000000-0000-0000-0000-0000000000f0',null),
  null, 'fixture: match 2 gepland'
);

------------------------------------------------------------------------
-- is_group_owner: c5 bezit de groep, c6 (gewoon lid) niet.
------------------------------------------------------------------------
select is(
  public.is_group_owner('c0000000-0000-0000-0000-0000000000f0','c0000000-0000-0000-0000-000000000005'),
  true, 'is_group_owner: c5 bezit de groep'
);
select is(
  public.is_group_owner('c0000000-0000-0000-0000-0000000000f0','c0000000-0000-0000-0000-000000000006'),
  false, 'is_group_owner: c6 is lid maar geen eigenaar'
);

------------------------------------------------------------------------
-- RLS-gedrag onder de rol authenticated
------------------------------------------------------------------------
set local role authenticated;

-- De groepseigenaar (geen aanmaker, geen deelnemer) vult de uitslag in.
set local request.jwt.claims = '{"sub":"c0000000-0000-0000-0000-000000000005","role":"authenticated"}';
update public.matches
   set status = 'completed', winner_team_id = team_a_id, score_a = 6, score_b = 3
 where played_at = '2026-02-01 10:00:00+00';
select is(
  (select status::text from public.matches where played_at = '2026-02-01 10:00:00+00'),
  'completed', 'groepseigenaar kan de uitslag invullen'
);

-- Corrigeren achteraf blijft bij de aanmaker: RLS geeft geruisloos 0 rijen.
update public.matches
   set score_a = 6, score_b = 4
 where played_at = '2026-02-01 10:00:00+00';
select is(
  (select score_b::int from public.matches where played_at = '2026-02-01 10:00:00+00'),
  3, 'groepseigenaar kan een afgeronde uitslag niet corrigeren'
);

-- Alleen de overgang naar 'completed': annuleren of enkel het tijdstip
-- verzetten faalt op with check.
select throws_ok(
  $$ update public.matches set status = 'cancelled'
     where played_at = '2026-02-01 11:00:00+00' $$,
  '42501', null, 'groepseigenaar kan een match niet annuleren'
);
select throws_ok(
  $$ update public.matches set played_at = '2026-02-02 10:00:00+00'
     where played_at = '2026-02-01 11:00:00+00' $$,
  '42501', null, 'groepseigenaar kan het tijdstip niet wijzigen'
);

-- De kolom-grant (#432) geldt onverkort: created_by/group_id meeschrijven bij
-- het invullen wordt geweigerd nog vóór RLS eraan te pas komt. Zonder die
-- grant kon een groepseigenaar een match naar zich toe trekken.
select throws_ok(
  $$ update public.matches
        set status = 'completed', winner_team_id = team_a_id, score_a = 6, score_b = 1,
            created_by = 'c0000000-0000-0000-0000-000000000005'
      where played_at = '2026-02-01 11:00:00+00' $$,
  '42501', null, 'groepseigenaar kan created_by niet meeschrijven (#432)'
);
select throws_ok(
  $$ update public.matches
        set status = 'completed', winner_team_id = team_a_id, score_a = 6, score_b = 1,
            group_id = 'c0000000-0000-0000-0000-0000000000f1'
      where played_at = '2026-02-01 11:00:00+00' $$,
  '42501', null, 'groepseigenaar kan group_id niet meeschrijven (#432)'
);

-- Een gewoon groepslid dat niet meespeelt blijft buitengesloten.
set local request.jwt.claims = '{"sub":"c0000000-0000-0000-0000-000000000006","role":"authenticated"}';
update public.matches
   set status = 'completed', winner_team_id = team_a_id, score_a = 6, score_b = 0
 where played_at = '2026-02-01 11:00:00+00';
select is(
  (select status::text from public.matches where played_at = '2026-02-01 11:00:00+00'),
  'scheduled', 'gewoon groepslid kan nog steeds geen uitslag invullen'
);

-- De eigenaar van een ándere groep al helemaal niet (die ziet de rij niet eens).
set local request.jwt.claims = '{"sub":"c0000000-0000-0000-0000-000000000007","role":"authenticated"}';
update public.matches
   set status = 'completed', winner_team_id = team_a_id, score_a = 6, score_b = 0
 where played_at = '2026-02-01 11:00:00+00';
-- Controleren doen we weer als eigenaar: c7 mag de rij niet eens lézen (#461),
-- dus vanuit hem zou de select sowieso niets teruggeven.
set local request.jwt.claims = '{"sub":"c0000000-0000-0000-0000-000000000005","role":"authenticated"}';
select is(
  (select status::text from public.matches where played_at = '2026-02-01 11:00:00+00'),
  'scheduled', 'eigenaar van een andere groep kan de uitslag niet invullen'
);

-- Na alle geweigerde pogingen kan de eigenaar match 2 gewoon nog invullen.
update public.matches
   set status = 'completed', winner_team_id = team_b_id, score_a = 2, score_b = 6
 where played_at = '2026-02-01 11:00:00+00';
select is(
  (select status::text from public.matches where played_at = '2026-02-01 11:00:00+00'),
  'completed', 'groepseigenaar vult ook de tweede uitslag in'
);
select is(
  (select score_b::int from public.matches where played_at = '2026-02-01 11:00:00+00'),
  6, 'de door de groepseigenaar ingevulde score staat er'
);

reset role;

select * from finish();

rollback;
