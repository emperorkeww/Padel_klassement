-- pgTAP-tests voor pias_of_week (#203, herschreven voor de anti-MVP van #643):
-- de diff-gebaseerde recompute raakt de tabel alleen bij échte wijzigingen,
-- zodat row-triggers op pias_of_week (push-webhook, realtime) enkel bij een
-- echte pias-wissel vuren.
--
-- Detectie: een audit-trigger telt alle row-DML op pias_of_week. created_at
-- vergelijken werkt niet, want now() is constant binnen deze transactie.
--
-- Sinds #643 is de pias de anti-MVP (bagel/afdroging/zwarte-reeks/choke, zie
-- 20_pias_of_week.sql) i.p.v. alleen de grootste choke. De tijdlijn hieronder
-- is daarop gebouwd: drie opbouwweken met telkens twee zeges van FA op FB
-- (reeks blijft < 3, geen scores dus geen bagel/afdroging, FB nooit favoriet
-- → gegarandeerd piasloos), daarna een bagel-week en een choke-week.
--
-- Elo-opbouw (K=24, team = gemiddelde): acht teamzeges van FA op FB plus twee
-- singleszeges van f4 op f2 laten FA met ± 0.66 winkans aan de choke-week
-- beginnen — ruim boven de choke-drempel 0.6.
begin;

select plan(27);

------------------------------------------------------------------------
-- Fixtures (als superuser). De trigger handle_new_user maakt de profielen.
------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
values
  ('00000000-0000-0000-0000-000000000000','f0000000-0000-0000-0000-000000000001','authenticated','authenticated','f1@test.nl','x',now(),'{}','{"username":"f1"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','f0000000-0000-0000-0000-000000000002','authenticated','authenticated','f2@test.nl','x',now(),'{}','{"username":"f2"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','f0000000-0000-0000-0000-000000000003','authenticated','authenticated','f3@test.nl','x',now(),'{}','{"username":"f3"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','f0000000-0000-0000-0000-000000000004','authenticated','authenticated','f4@test.nl','x',now(),'{}','{"username":"f4"}',now(),now(),'','','','');

-- Groep met f1 als eigenaar (trigger voegt f1 toe) + f2..f4 als leden.
insert into public.groups (id, name, created_by)
values ('f0000000-0000-0000-0000-0000000000f0','Piasgroep','f0000000-0000-0000-0000-000000000001');
insert into public.group_members (group_id, player_id, role)
values
  ('f0000000-0000-0000-0000-0000000000f0','f0000000-0000-0000-0000-000000000002','member'),
  ('f0000000-0000-0000-0000-0000000000f0','f0000000-0000-0000-0000-000000000003','member'),
  ('f0000000-0000-0000-0000-0000000000f0','f0000000-0000-0000-0000-000000000004','member');

-- Teams: FA = f1+f2, FB = f3+f4, plus singles-teams voor f2 en f4.
insert into public.teams (id, player1_id, player2_id)
values
  ('fa000000-0000-0000-0000-00000000000a','f0000000-0000-0000-0000-000000000001','f0000000-0000-0000-0000-000000000002'),
  ('fa000000-0000-0000-0000-00000000000b','f0000000-0000-0000-0000-000000000003','f0000000-0000-0000-0000-000000000004'),
  ('fa000000-0000-0000-0000-00000000000c','f0000000-0000-0000-0000-000000000002',null),
  ('fa000000-0000-0000-0000-00000000000d','f0000000-0000-0000-0000-000000000004',null);

-- Audit-trigger vóór de eerste match: ook de setup mag geen pias-DML geven.
create table pg_temp.pias_audit (op text);
create function pg_temp.log_pias() returns trigger
language plpgsql as $$
begin
  insert into pg_temp.pias_audit values (tg_op);
  return null;
end;
$$;
create trigger pias_audit_trg
  after insert or update or delete on public.pias_of_week
  for each row execute function pg_temp.log_pias();

-- Tijdlijn: anker = maandag over twee weken, zodat alle testweken hele, eigen
-- ISO-weken zijn en onze matches gegarandeerd ná eventuele seed-matches in de
-- Elo-keten sorteren. Opbouw +14/+21/+28 dagen, bagel-week +35, choke-week +42.

------------------------------------------------------------------------
-- 1. Opbouw: drie weken met elk twee zeges van FA op FB. Zonder scores en met
--    reeks < 3 kwalificeert geen enkele nederlaag — geen enkele DML.
------------------------------------------------------------------------
insert into public.matches (id, team_a_id, team_b_id, group_id, status, winner_team_id, played_at)
select
  ('fc000000-0000-0000-0000-00000000000' || n)::uuid,
  'fa000000-0000-0000-0000-00000000000a','fa000000-0000-0000-0000-00000000000b',
  'f0000000-0000-0000-0000-0000000000f0','completed',
  'fa000000-0000-0000-0000-00000000000a',
  date_trunc('week', now()) + ((n + 1) / 2 + 1) * interval '7 days' + (n % 2 + 1) * interval '1 hour'
from generate_series(1, 6) n;

select is((select count(*)::int from pg_temp.pias_audit),
  0, 'zes opbouwzeges zonder kwalificerende afgang: geen enkele DML op pias_of_week');

------------------------------------------------------------------------
-- 2. Bagel-week (+35d): FA droogt FB af met 6-0 → f3 en f4 zijn allebei een
--    bagel (ernst 110); de tie-break (laagste player_id) wijst f3 aan.
------------------------------------------------------------------------
insert into public.matches (id, team_a_id, team_b_id, group_id, status, winner_team_id, score_a, score_b, played_at)
values ('fc000000-0000-0000-0000-000000000007',
        'fa000000-0000-0000-0000-00000000000a','fa000000-0000-0000-0000-00000000000b',
        'f0000000-0000-0000-0000-0000000000f0','completed',
        'fa000000-0000-0000-0000-00000000000a', 6, 0,
        date_trunc('week', now()) + interval '35 days 1 hour');

select is((select count(*)::int from pg_temp.pias_audit), 1,
  'de eerste bagel veroorzaakt exact één DML-operatie');
select is((select count(*)::int from pg_temp.pias_audit where op = 'INSERT'), 1,
  'en die operatie is een INSERT');
select is((select reden from public.pias_of_week
    where group_id = 'f0000000-0000-0000-0000-0000000000f0'),
  'bagel', 'de reden is bagel');
select is((select player_id from public.pias_of_week
    where group_id = 'f0000000-0000-0000-0000-0000000000f0'),
  'f0000000-0000-0000-0000-000000000003',
  'bij gelijke ernst (f3 én f4 een bagel) wint het laagste player_id: f3');
select is((select match_id from public.pias_of_week
    where group_id = 'f0000000-0000-0000-0000-0000000000f0'),
  'fc000000-0000-0000-0000-000000000007', 'de pias hangt aan de bagel-match');

------------------------------------------------------------------------
-- 3. Zelfde week, zelfde speler flopt harder (tweede 6-0): één UPDATE —
--    ernst stijgt naar 120 en het anker schuift naar de laatste nederlaag.
------------------------------------------------------------------------
delete from pg_temp.pias_audit;

insert into public.matches (id, team_a_id, team_b_id, group_id, status, winner_team_id, score_a, score_b, played_at)
values ('fc000000-0000-0000-0000-000000000008',
        'fa000000-0000-0000-0000-00000000000a','fa000000-0000-0000-0000-00000000000b',
        'f0000000-0000-0000-0000-0000000000f0','completed',
        'fa000000-0000-0000-0000-00000000000a', 6, 0,
        date_trunc('week', now()) + interval '35 days 2 hours');

select is((select count(*)::int from pg_temp.pias_audit), 1,
  'hardere flop van dezelfde speler: exact één DML-operatie');
select is((select count(*)::int from pg_temp.pias_audit where op = 'UPDATE'), 1,
  'en die operatie is een UPDATE');
select is((select ernst::int from public.pias_of_week
    where group_id = 'f0000000-0000-0000-0000-0000000000f0'),
  120, 'twee bagels: ernst 100 + 2×10');
select is((select match_id from public.pias_of_week
    where group_id = 'f0000000-0000-0000-0000-0000000000f0'),
  'fc000000-0000-0000-0000-000000000008',
  'het anker schuift naar de laatste verloren match');

------------------------------------------------------------------------
-- 4. Singles in dezelfde week: f4 verslaat f2 met 6-0. Eén bagel (110) blijft
--    onder de zittende pias (120): geen DML. De singles-match (player2 null)
--    doorloopt de berekening zonder fantoom-partner.
------------------------------------------------------------------------
delete from pg_temp.pias_audit;

insert into public.matches (id, team_a_id, team_b_id, group_id, status, winner_team_id, format, score_a, score_b, played_at)
values ('fc000000-0000-0000-0000-000000000009',
        'fa000000-0000-0000-0000-00000000000d','fa000000-0000-0000-0000-00000000000c',
        'f0000000-0000-0000-0000-0000000000f0','completed',
        'fa000000-0000-0000-0000-00000000000d','1v1', 6, 0,
        date_trunc('week', now()) + interval '35 days 3 hours');

select is((select count(*)::int from pg_temp.pias_audit), 0,
  'één bagel (110) verdringt de zittende pias (120) niet: geen DML');

------------------------------------------------------------------------
-- 5. Pias-wissel binnen dezelfde week: de tweede 6-0 tegen f2 brengt hem óók
--    op ernst 120 — de tie-break (laagste player_id) wisselt de pias naar f2.
------------------------------------------------------------------------
insert into public.matches (id, team_a_id, team_b_id, group_id, status, winner_team_id, format, score_a, score_b, played_at)
values ('fc000000-0000-0000-0000-00000000000a',
        'fa000000-0000-0000-0000-00000000000d','fa000000-0000-0000-0000-00000000000c',
        'f0000000-0000-0000-0000-0000000000f0','completed',
        'fa000000-0000-0000-0000-00000000000d','1v1', 6, 0,
        date_trunc('week', now()) + interval '35 days 4 hours');

select is((select count(*)::int from pg_temp.pias_audit), 1,
  'pias-wissel: exact één DML-operatie');
select is((select count(*)::int from pg_temp.pias_audit where op = 'UPDATE'), 1,
  'en die operatie is een UPDATE');
select is((select player_id from public.pias_of_week
    where group_id = 'f0000000-0000-0000-0000-0000000000f0'),
  'f0000000-0000-0000-0000-000000000002',
  'bij gelijke ernst (120 om 120) wisselt de pias naar het laagste player_id: f2');
select is((select count(*)::int from public.pias_of_week
    where group_id = 'f0000000-0000-0000-0000-0000000000f0'),
  1, 'er blijft precies één pias-rij voor de groep');

------------------------------------------------------------------------
-- 6. No-op-operaties: score-correctie zonder pias-gevolgen (6-4: geen bagel,
--    marge < 4) en een geplande match draaien de recompute zonder DML.
------------------------------------------------------------------------
delete from pg_temp.pias_audit;

update public.matches
   set score_a = 6, score_b = 4
 where id = 'fc000000-0000-0000-0000-000000000001';

select is((select count(*)::int from pg_temp.pias_audit),
  0, 'score-correctie zonder gevolgen voor de pias: geen DML');

insert into public.matches (id, team_a_id, team_b_id, group_id, status, played_at)
values ('fc000000-0000-0000-0000-000000000010',
        'fa000000-0000-0000-0000-00000000000a','fa000000-0000-0000-0000-00000000000b',
        'f0000000-0000-0000-0000-0000000000f0','scheduled',
        date_trunc('week', now()) + interval '43 days');

select is((select count(*)::int from pg_temp.pias_audit),
  0, 'geplande match: geen DML');

------------------------------------------------------------------------
-- 7. Choke-week (+42d): favoriet FA (winkans ± 0.66 na acht teamzeges, ruim
--    boven de drempel 0.6) verliest van FB → nieuwe week-rij, reden choke.
--    f1 en f2 choken met dezelfde teamkans; de tie-break wijst f1 aan.
------------------------------------------------------------------------
delete from pg_temp.pias_audit;

insert into public.matches (id, team_a_id, team_b_id, group_id, status, winner_team_id, played_at)
values ('fc000000-0000-0000-0000-00000000000b',
        'fa000000-0000-0000-0000-00000000000a','fa000000-0000-0000-0000-00000000000b',
        'f0000000-0000-0000-0000-0000000000f0','completed',
        'fa000000-0000-0000-0000-00000000000b',
        date_trunc('week', now()) + interval '42 days 1 hour');

select is((select count(*)::int from pg_temp.pias_audit), 1,
  'de choke veroorzaakt exact één DML-operatie');
select is((select count(*)::int from pg_temp.pias_audit where op = 'INSERT'), 1,
  'en die operatie is een INSERT (nieuwe week)');
select is((select reden from public.pias_of_week
    where group_id = 'f0000000-0000-0000-0000-0000000000f0'
      and week_start = (date_trunc('week', now()) + interval '42 days')::date),
  'choke', 'de reden van de nieuwe week-rij is choke');
select is((select player_id from public.pias_of_week
    where group_id = 'f0000000-0000-0000-0000-0000000000f0'
      and week_start = (date_trunc('week', now()) + interval '42 days')::date),
  'f0000000-0000-0000-0000-000000000001',
  'bij gelijke teamkans wint het laagste player_id: f1');
select ok((select win_chance from public.pias_of_week
    where group_id = 'f0000000-0000-0000-0000-0000000000f0'
      and week_start = (date_trunc('week', now()) + interval '42 days')::date) >= 0.6,
  'de winkans ligt op of boven de choke-drempel 0.6');
select is((select count(*)::int from public.pias_of_week
    where group_id = 'f0000000-0000-0000-0000-0000000000f0'),
  2, 'de bagel-week en de choke-week hebben elk hun eigen rij');

------------------------------------------------------------------------
-- 8. Choke vervalt (winnaarscorrectie op de choke-match): één DELETE, de
--    bagel-week blijft onaangeroerd staan.
------------------------------------------------------------------------
delete from pg_temp.pias_audit;

update public.matches
   set winner_team_id = 'fa000000-0000-0000-0000-00000000000a'
 where id = 'fc000000-0000-0000-0000-00000000000b';

select is((select count(*)::int from pg_temp.pias_audit), 1,
  'vervallen choke: exact één DML-operatie');
select is((select count(*)::int from pg_temp.pias_audit where op = 'DELETE'), 1,
  'en die operatie is een DELETE');
select is((select count(*)::int from public.pias_of_week
    where group_id = 'f0000000-0000-0000-0000-0000000000f0'),
  1, 'alleen de vervallen week is opgeruimd');
select is((select reden from public.pias_of_week
    where group_id = 'f0000000-0000-0000-0000-0000000000f0'),
  'bagel', 'de bagel-week staat er nog ongewijzigd');

select * from finish();

rollback;
