-- pgTAP-tests voor pias_of_week (#203): de diff-gebaseerde recompute raakt de
-- tabel alleen bij échte wijzigingen, zodat row-triggers op pias_of_week
-- (push-webhook, realtime) enkel bij een echte pias-wissel vuren.
--
-- Detectie: een audit-trigger telt alle row-DML op pias_of_week. created_at
-- vergelijken werkt niet, want now() is constant binnen deze transactie.
--
-- Elo-opbouw (K=24, team = gemiddelde): vijf teamzeges van A op B geven een
-- rating-gap van 104 (12+11+10+10+9 per speler, ×2 voor de gap) → verlieskans
-- favoriet 0.6454, nipt ONDER de choke-drempel 0.65. Een zesde (geantidateerde)
-- zege tilt de gap naar 122 → 0.6687, erboven.
begin;

select plan(21);

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

-- Tijdlijn: anker = maandag over twee weken, zodat de opbouwweek (anker) en
-- de choke-week (anker + 7 dagen) hele, verschillende ISO-weken zijn en onze
-- matches gegarandeerd ná eventuele seed-matches in de Elo-keten sorteren.

------------------------------------------------------------------------
-- 1. Setup: vijf zeges van FA op FB — geen choke, dus geen enkele DML.
------------------------------------------------------------------------
insert into public.matches (id, team_a_id, team_b_id, group_id, status, winner_team_id, played_at)
select
  ('fc000000-0000-0000-0000-00000000000' || n)::uuid,
  'fa000000-0000-0000-0000-00000000000a','fa000000-0000-0000-0000-00000000000b',
  'f0000000-0000-0000-0000-0000000000f0','completed',
  'fa000000-0000-0000-0000-00000000000a',
  date_trunc('week', now()) + interval '14 days' + n * interval '1 hour'
from generate_series(1, 5) n;

select is((select count(*)::int from pg_temp.pias_audit),
  0, 'vijf setup-zeges zonder choke veroorzaken geen enkele DML op pias_of_week');

------------------------------------------------------------------------
-- 2. Drempel: favoriet FA (gap 104, kans 0.6454) verliest → nét geen choke.
------------------------------------------------------------------------
insert into public.matches (id, team_a_id, team_b_id, group_id, status, winner_team_id, played_at)
values ('fc000000-0000-0000-0000-000000000006',
        'fa000000-0000-0000-0000-00000000000a','fa000000-0000-0000-0000-00000000000b',
        'f0000000-0000-0000-0000-0000000000f0','completed',
        'fa000000-0000-0000-0000-00000000000b',
        date_trunc('week', now()) + interval '21 days' + interval '1 hour');

select is((select count(*)::int from public.pias_of_week
    where group_id = 'f0000000-0000-0000-0000-0000000000f0'),
  0, 'verlieskans 0.6454 blijft onder de choke-drempel 0.65: geen pias');
select is((select count(*)::int from pg_temp.pias_audit),
  0, 'nipt-geen-choke veroorzaakt ook geen DML');

------------------------------------------------------------------------
-- 3. Geantidateerde zesde zege → gap 122, de nederlaag wordt alsnog een
--    choke: precies één INSERT.
------------------------------------------------------------------------
insert into public.matches (id, team_a_id, team_b_id, group_id, status, winner_team_id, played_at)
values ('fc000000-0000-0000-0000-000000000007',
        'fa000000-0000-0000-0000-00000000000a','fa000000-0000-0000-0000-00000000000b',
        'f0000000-0000-0000-0000-0000000000f0','completed',
        'fa000000-0000-0000-0000-00000000000a',
        date_trunc('week', now()) + interval '14 days' + interval '10 hours');

select is((select count(*)::int from pg_temp.pias_audit), 1,
  'de nieuwe choke veroorzaakt exact één DML-operatie');
select is((select count(*)::int from pg_temp.pias_audit where op = 'INSERT'), 1,
  'en die operatie is een INSERT');
select is((select player_id from public.pias_of_week
    where group_id = 'f0000000-0000-0000-0000-0000000000f0'),
  'f0000000-0000-0000-0000-000000000001',
  'de pias is de hoogst gerate verliezer (gelijke rating → player1: f1)');
select is((select match_id from public.pias_of_week
    where group_id = 'f0000000-0000-0000-0000-0000000000f0'),
  'fc000000-0000-0000-0000-000000000006', 'de pias hangt aan de choke-match');
select ok((select win_chance from public.pias_of_week
    where group_id = 'f0000000-0000-0000-0000-0000000000f0') > 0.65,
  'de winkans ligt boven de choke-drempel');

------------------------------------------------------------------------
-- 4. No-op-operaties: score-correctie zonder winnaarswissel en een geplande
--    match draaien de recompute, maar raken pias_of_week niet.
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
        date_trunc('week', now()) + interval '22 days');

select is((select count(*)::int from pg_temp.pias_audit),
  0, 'geplande match: geen DML');

------------------------------------------------------------------------
-- 5. Zelfde week, zelfde speler flopt harder (extra geantidateerde zege →
--    hogere winkans): precies één UPDATE, player_id ongewijzigd.
------------------------------------------------------------------------
create temp table chance_snap as
  select win_chance from public.pias_of_week
  where group_id = 'f0000000-0000-0000-0000-0000000000f0';
delete from pg_temp.pias_audit;

insert into public.matches (id, team_a_id, team_b_id, group_id, status, winner_team_id, played_at)
values ('fc000000-0000-0000-0000-000000000008',
        'fa000000-0000-0000-0000-00000000000a','fa000000-0000-0000-0000-00000000000b',
        'f0000000-0000-0000-0000-0000000000f0','completed',
        'fa000000-0000-0000-0000-00000000000a',
        date_trunc('week', now()) + interval '14 days' + interval '11 hours');

select is((select count(*)::int from pg_temp.pias_audit), 1,
  'hardere flop van dezelfde speler: exact één DML-operatie');
select is((select count(*)::int from pg_temp.pias_audit where op = 'UPDATE'), 1,
  'en die operatie is een UPDATE');
select is((select player_id from public.pias_of_week
    where group_id = 'f0000000-0000-0000-0000-0000000000f0'),
  'f0000000-0000-0000-0000-000000000001',
  'player_id blijft f1 (de webhook-trigger onderscheidt hierop een echte wissel)');
select ok((select win_chance from public.pias_of_week
    where group_id = 'f0000000-0000-0000-0000-0000000000f0')
    > (select win_chance from chance_snap),
  'de winkans is gestegen');

------------------------------------------------------------------------
-- 6. Pias-wissel binnen dezelfde week: een geantidateerde singleszege tilt
--    f2 boven f1 → één UPDATE met een andere player_id. De singles-match
--    (player2 null) doorloopt de choke-berekening zonder fantoom-partner.
------------------------------------------------------------------------
delete from pg_temp.pias_audit;

insert into public.matches (id, team_a_id, team_b_id, group_id, status, winner_team_id, format, played_at)
values ('fc000000-0000-0000-0000-000000000009',
        'fa000000-0000-0000-0000-00000000000c','fa000000-0000-0000-0000-00000000000d',
        'f0000000-0000-0000-0000-0000000000f0','completed',
        'fa000000-0000-0000-0000-00000000000c','1v1',
        date_trunc('week', now()) + interval '14 days' + interval '12 hours');

select is((select count(*)::int from pg_temp.pias_audit), 1,
  'pias-wissel: exact één DML-operatie');
select is((select count(*)::int from pg_temp.pias_audit where op = 'UPDATE'), 1,
  'en die operatie is een UPDATE');
select is((select player_id from public.pias_of_week
    where group_id = 'f0000000-0000-0000-0000-0000000000f0'),
  'f0000000-0000-0000-0000-000000000002',
  'de pias wisselt naar de nu hoogst gerate verliezer (f2)');
select is((select count(*)::int from public.pias_of_week
    where group_id = 'f0000000-0000-0000-0000-0000000000f0'),
  1, 'er blijft precies één pias-rij voor de groep');

------------------------------------------------------------------------
-- 7. Choke vervalt (winnaarscorrectie op de choke-match): één DELETE.
------------------------------------------------------------------------
delete from pg_temp.pias_audit;

update public.matches
   set winner_team_id = 'fa000000-0000-0000-0000-00000000000a'
 where id = 'fc000000-0000-0000-0000-000000000006';

select is((select count(*)::int from pg_temp.pias_audit), 1,
  'vervallen choke: exact één DML-operatie');
select is((select count(*)::int from pg_temp.pias_audit where op = 'DELETE'), 1,
  'en die operatie is een DELETE');
select is((select count(*)::int from public.pias_of_week
    where group_id = 'f0000000-0000-0000-0000-0000000000f0'),
  0, 'de pias-rij is opgeruimd');

select * from finish();

rollback;
