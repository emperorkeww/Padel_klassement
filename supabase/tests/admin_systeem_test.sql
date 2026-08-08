-- pgTAP-tests voor de systeemgezondheid (#1049).
--
-- Drie dingen worden hier vastgezet:
--
--  1. admin_systeem_status() is service-role-only. Ze is security definer en
--     leest cron.job, supabase_migrations en de rijtellingen van elke kerntabel
--     — dat is precies het soort functie waarvan één vergeten revoke een
--     gewone gebruiker een projectbreed dashboard geeft.
--  2. Ze verdraagt een databank zónder pg_cron. Dat is niet theoretisch: het is
--     de normale toestand van elke dev-machine, en de functie hoort dan `null`
--     terug te geven in plaats van te ontploffen. Dit is het open punt uit de
--     issuetekst.
--  3. Ze lekt het CRON_SECRET niet. cron.job.command bevat het geheim
--     letterlijk (zie supabase/snippets/*_cron.sql); die kolom komt niet in het
--     antwoord voor.
begin;

select plan(11);

------------------------------------------------------------------------
-- Fixture: één gewone gebruiker om de grants tegen te toetsen.
------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
values
  ('00000000-0000-0000-0000-000000000000','c0000000-0000-0000-0000-000000000001',
   'authenticated','authenticated','sys1@test.nl','x',now(),'{}','{"username":"sys1"}',
   now(),now(),'','','','');

------------------------------------------------------------------------
-- 1. De functie bestaat en levert de blokken die het tabblad verwacht.
------------------------------------------------------------------------
select has_function('public', 'admin_systeem_status',
  'admin_systeem_status() bestaat (#1049)');

select is(
  (select public.admin_systeem_status() ? 'cron'), true,
  'het antwoord heeft een cron-blok'
);
select is(
  (select public.admin_systeem_status() ? 'tabellen'), true,
  'het antwoord heeft rijtellingen'
);
select is(
  (select public.admin_systeem_status() ? 'migratie'), true,
  'het antwoord noemt de laatst toegepaste migratie'
);
select is(
  (select public.admin_systeem_status() ? 'push'), true,
  'het antwoord heeft een push-blok'
);

------------------------------------------------------------------------
-- 2. Zonder pg_cron: null, geen fout.
--
-- Deze suite draait lokaal, waar het cron-schema niet bestaat. Dat maakt dit
-- de enige plek waar dat pad écht uitgevoerd wordt — op het gehoste project
-- zou hij nooit langskomen.
------------------------------------------------------------------------
select is(
  (select to_regclass('cron.job') is null), true,
  'voorwaarde: deze databank heeft geen pg_cron'
);

select lives_ok(
  $$ select public.admin_systeem_status() $$,
  'admin_systeem_status() draait door zonder pg_cron (#1049)'
);

select is(
  (select public.admin_systeem_status()->'cron'), 'null'::jsonb,
  'zonder pg_cron is het cron-blok null en niet een lege lijst'
);

------------------------------------------------------------------------
-- 3. Het antwoord bevat nergens een cron-commando.
--
-- cron.job.command bevat het letterlijke CRON_SECRET. Zou iemand die kolom
-- ooit "voor het gemak" meesturen, dan staat het gedeelde geheim in de
-- browser van elke beheerder — en in elke HAR-file die hij ooit deelt.
------------------------------------------------------------------------
select is(
  (select public.admin_systeem_status()::text like '%command%'), false,
  'het antwoord noemt geen cron-commando (dat bevat het CRON_SECRET)'
);

------------------------------------------------------------------------
-- 4. Grants: service-role-only. Dit is de kern van de suite.
------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"c0000000-0000-0000-0000-000000000001","role":"authenticated"}';

select throws_ok(
  $$ select public.admin_systeem_status() $$,
  '42501', null,
  'gewone gebruiker kan admin_systeem_status() niet uitvoeren (#1049)'
);

reset role;
set local role anon;

select throws_ok(
  $$ select public.admin_systeem_status() $$,
  '42501', null,
  'anon kan admin_systeem_status() niet uitvoeren (#1049)'
);

reset role;

select * from finish();
rollback;
