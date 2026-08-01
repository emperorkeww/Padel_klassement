-- pgTAP-tests voor de policy "Groepseigenaar kan groepsmatch bijwerken" (#978):
-- de eigenaar van de groep beheert elke match in die groep volledig, ook als
-- hij zelf niet meespeelt en de match niet aanmaakte — uitslag invullen én
-- achteraf corrigeren, tijdstip verplaatsen, annuleren. Dat is bewust dezelfde
-- vrijheid als de aanmaker heeft; #905 gaf hem alleen de overgang naar
-- 'completed' en dat bleek te krap.
--
-- De begrenzing zit in de kolom-grant uit #432, niet in de policy: created_by
-- en group_id blijven buiten bereik. Die twee tests zijn hier het hart van de
-- suite — zonder die grant kon een groepseigenaar een vreemde match naar zijn
-- eigen groep trekken en zich er vervolgens rechten op geven.
begin;

select plan(18);

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

-- c1 plant drie groepsmatches c1+c2 vs c3+c4; played_at onderscheidt ze.
-- Match 1 (10:00) is voor invullen + corrigeren, match 2 (11:00) voor de
-- geweigerde pogingen, match 3 (12:00) voor verplaatsen en annuleren. Match 4
-- (14:00) hangt bewust in géén groep.
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
select isnt(
  public.create_planned_match(
    'c0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000002',
    'c0000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000004',
    '2026-02-01 12:00:00+00','c0000000-0000-0000-0000-0000000000f0',null),
  null, 'fixture: match 3 gepland'
);
-- Match 4 wordt in de groep gepland en daarna als superuser losgekoppeld:
-- create_planned_match eist buiten een groep vriendschap tussen alle spelers
-- (_can_add_player), en die relaties zijn hier niet gelegd.
select isnt(
  public.create_planned_match(
    'c0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000002',
    'c0000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000004',
    '2026-02-01 14:00:00+00','c0000000-0000-0000-0000-0000000000f0',null),
  null, 'fixture: match 4 gepland (wordt zo losgekoppeld)'
);
update public.matches
   set group_id = null
 where played_at = '2026-02-01 14:00:00+00';

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

-- #978: en hij kan hem daarna corrigeren. Vóór deze issue gaf RLS hier
-- geruisloos 0 rijen terug.
update public.matches
   set score_a = 6, score_b = 4
 where played_at = '2026-02-01 10:00:00+00';
select is(
  (select score_b::int from public.matches where played_at = '2026-02-01 10:00:00+00'),
  4, 'groepseigenaar kan een afgeronde uitslag corrigeren'
);

-- Ook een correctie die de winnaar omdraait — het pad dat serverzijdig een
-- volledige recompute_ratings() en een herbeoordeling van de tips uitlokt.
update public.matches
   set winner_team_id = team_b_id, score_a = 3, score_b = 6
 where played_at = '2026-02-01 10:00:00+00';
select is(
  (select winner_team_id = team_b_id from public.matches
    where played_at = '2026-02-01 10:00:00+00'),
  true, 'groepseigenaar kan de winnaar achteraf omdraaien'
);

-- Verplaatsen mag nu ook (match 3, van 12:00 naar 13:00).
update public.matches
   set played_at = '2026-02-01 13:00:00+00'
 where played_at = '2026-02-01 12:00:00+00';
select is(
  (select count(*)::int from public.matches where played_at = '2026-02-01 13:00:00+00'),
  1, 'groepseigenaar kan het tijdstip verzetten'
);

-- En annuleren.
update public.matches
   set status = 'cancelled'
 where played_at = '2026-02-01 13:00:00+00';
select is(
  (select status::text from public.matches where played_at = '2026-02-01 13:00:00+00'),
  'cancelled', 'groepseigenaar kan een match annuleren'
);

-- De kolom-grant (#432) geldt onverkort: created_by/group_id meeschrijven
-- wordt geweigerd nog vóór RLS eraan te pas komt. Zonder die grant kon een
-- groepseigenaar een match naar zich toe trekken — dit is de enige rem die
-- deze bredere policy nog begrenst.
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

-- De policy hangt volledig aan group_id: een match zonder groep raakt hij niet,
-- ook al is hij ergens anders eigenaar.
update public.matches
   set status = 'completed', winner_team_id = team_a_id, score_a = 6, score_b = 0
 where played_at = '2026-02-01 14:00:00+00';
select is(
  (select status::text from public.matches where played_at = '2026-02-01 14:00:00+00'),
  'scheduled', 'groepseigenaar raakt een match zonder groep niet aan'
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
