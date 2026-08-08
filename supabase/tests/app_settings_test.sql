-- pgTAP-tests voor de schakelaars zonder deploy (#1049).
--
-- Drie dingen worden hier vastgezet:
--
--  1. De client kan ze niet schrijven. Een kill switch die vanaf de browser om
--     te zetten is, is geen kill switch maar een knop voor iedereen.
--  2. De client leest alleen wat publiek is. `push` en `playtomic` zijn
--     serverzaak; alleen `ai_portretten` mag de UI zien, om een knop te kunnen
--     verbergen in plaats van hem te laten falen.
--  3. Het dagbudget telt écht af en reset op een nieuwe dag. Zonder dat is het
--     geen rem maar een geruststelling.
begin;

select plan(19);

------------------------------------------------------------------------
-- 1. Vorm en zaad.
------------------------------------------------------------------------
select has_table('public', 'app_settings', 'app_settings bestaat (#1049)');

select is(
  (select count(*)::int from public.app_settings
    where sleutel in ('ai_portretten', 'playtomic', 'push')),
  3, 'de drie schakelaars uit het issue staan er'
);

select is(
  (select publiek from public.app_settings where sleutel = 'push'),
  false, 'push is serverzaak en niet client-leesbaar'
);
select is(
  (select publiek from public.app_settings where sleutel = 'playtomic'),
  false, 'playtomic is serverzaak en niet client-leesbaar'
);
select is(
  (select publiek from public.app_settings where sleutel = 'ai_portretten'),
  true, 'ai_portretten is publiek zodat de UI de knop kan verbergen'
);

select is(
  (select relrowsecurity from pg_class where oid = 'public.app_settings'::regclass),
  true, 'RLS staat aan op app_settings'
);

------------------------------------------------------------------------
-- 2. Het dagbudget.
------------------------------------------------------------------------
update public.app_settings
   set waarde = '{"aan": true, "dagbudget": 2, "dag": null, "gebruikt": 0}'::jsonb
 where sleutel = 'ai_portretten';

select is(
  (public.verbruik_dagbudget('ai_portretten')->>'toegestaan')::boolean,
  true, 'de eerste aanvraag mag door'
);
select is(
  (public.verbruik_dagbudget('ai_portretten')->>'gebruikt')::int,
  2, 'de teller loopt op'
);
select is(
  (public.verbruik_dagbudget('ai_portretten')->>'reden'),
  'budget-op', 'de derde aanvraag boven een budget van 2 wordt geweigerd'
);

-- Nieuwe dag: de teller hoort terug op nul te gaan zonder dat iemand hem reset.
update public.app_settings
   set waarde = waarde || '{"dag": "2020-01-01", "gebruikt": 99}'::jsonb
 where sleutel = 'ai_portretten';

select is(
  (public.verbruik_dagbudget('ai_portretten')->>'gebruikt')::int,
  1, 'op een nieuwe dag begint de teller opnieuw'
);

-- De schakelaar wint van het budget.
update public.app_settings
   set waarde = waarde || '{"aan": false}'::jsonb
 where sleutel = 'ai_portretten';

select is(
  (public.verbruik_dagbudget('ai_portretten')->>'reden'),
  'uit', 'uitgezet weigert ongeacht het budget'
);

-- Fail-open: een onbekende sleutel legt niets stil. Een vergeten migratie mag
-- geen storing zijn.
select is(
  (public.verbruik_dagbudget('bestaat_niet')->>'toegestaan')::boolean,
  true, 'een onbekende sleutel laat de functie gewoon door'
);

------------------------------------------------------------------------
-- 3. Omzetten via de beheerfunctie laat een spoor na.
------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
values
  ('00000000-0000-0000-0000-000000000000','d0000000-0000-0000-0000-000000000001',
   'authenticated','authenticated','set1@test.nl','x',now(),'{}','{"username":"set1"}',
   now(),now(),'','','','');

select lives_ok(
  $$ select public.admin_zet_app_setting('push', false, 'd0000000-0000-0000-0000-000000000001') $$,
  'de beheerfunctie zet een schakelaar om'
);

select is(
  (select (waarde->>'aan')::boolean from public.app_settings where sleutel = 'push'),
  false, 'push staat daarna uit'
);

select is(
  (select bijgewerkt_door from public.app_settings where sleutel = 'push'),
  'd0000000-0000-0000-0000-000000000001'::uuid,
  'de actor wordt vastgelegd (en komt niet uit auth.uid(), dat is null onder service_role)'
);

------------------------------------------------------------------------
-- 4. De client. Dit is de kern van de suite.
------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"d0000000-0000-0000-0000-000000000001","role":"authenticated"}';

select is(
  (select count(*)::int from public.app_settings),
  1, 'de client ziet alleen de publieke vlag (ai_portretten), niet push of playtomic'
);

select throws_ok(
  $$ update public.app_settings set waarde = '{"aan":true}'::jsonb where sleutel = 'push' $$,
  '42501', null, 'de client kan een schakelaar niet omzetten (#1049)'
);

select throws_ok(
  $$ insert into public.app_settings (sleutel, waarde, omschrijving)
     values ('eigen', '{"aan":false}'::jsonb, 'x') $$,
  '42501', null, 'de client kan er geen schakelaar bij zetten (#1049)'
);

select throws_ok(
  $$ select public.verbruik_dagbudget('ai_portretten') $$,
  '42501', null, 'de client kan het dagbudget niet zelf opsouperen (#1049)'
);

reset role;

select * from finish();
rollback;
