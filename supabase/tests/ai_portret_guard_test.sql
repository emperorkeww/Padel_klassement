-- pgTAP-tests voor de gedeelde portret-guard (#682, bouwt op #554) en de
-- kolom-grant die erbij hoort (#465). De guard doet drie dingen, en alle drie
-- worden hier vastgezet voor béide portretsets (dictator + pias):
--   1. fotowissel  => bewaarde portretten vervallen;
--   2. geen service-role => client-writes op url/bron worden teruggedraaid;
--   3. opt-out uit => het bewaarde portret wordt genuld.
-- De grant is de eerste verdedigingslinie (42501 vóór de trigger); de guard is
-- de tweede, en geldt ook voor rollen die de grant ooit wél zouden krijgen.
begin;

select plan(12);

------------------------------------------------------------------------
-- Fixture: één gebruiker met een profielfoto en twee "gegenereerde" portretten
-- (weggeschreven als superuser, de rol die ook de edge function benadert).
------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
values (
  '00000000-0000-0000-0000-000000000000','d0000000-0000-0000-0000-000000000001',
  'authenticated','authenticated','p@test.nl','x',now(),'{}','{"username":"pias"}',
  now(),now(),'','','',''
);

update public.profiles
   set avatar_url = 'https://cdn/foto-1.png'
 where id = 'd0000000-0000-0000-0000-000000000001';

-- De guard laat alleen de service-role schrijven; in pgTAP draaien we deze
-- fixture als die rol, precies zoals de edge function het doet.
set local role service_role;
update public.profiles
   set dictator_avatar_url = 'https://cdn/dictator.png',
       dictator_avatar_bron = 'https://cdn/foto-1.png',
       pias_avatar_url = 'https://cdn/pias.png',
       pias_avatar_bron = 'https://cdn/foto-1.png'
 where id = 'd0000000-0000-0000-0000-000000000001';
reset role;

select is(
  (select pias_avatar_url from public.profiles
    where id = 'd0000000-0000-0000-0000-000000000001'),
  'https://cdn/pias.png', 'fixture: de service-role mag het pias-portret schrijven'
);
select is(
  (select dictator_avatar_url from public.profiles
    where id = 'd0000000-0000-0000-0000-000000000001'),
  'https://cdn/dictator.png', 'fixture: de service-role mag het dictator-portret schrijven'
);

------------------------------------------------------------------------
-- Als de eigenaar zelf (authenticated).
------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"d0000000-0000-0000-0000-000000000001","role":"authenticated"}';

-- 1) De kolom-grant weigert een UPDATE die de gegenereerde kolommen meeschrijft,
--    nog vóór de trigger (42501) — spoofen is dus onmogelijk, niet enkel nutteloos.
select throws_ok(
  $$ update public.profiles
        set pias_avatar_url = 'https://evil/clown.png'
      where id = 'd0000000-0000-0000-0000-000000000001' $$,
  '42501', null, 'eigenaar kan pias_avatar_url niet meeschrijven (#465/#682)'
);
select throws_ok(
  $$ update public.profiles
        set pias_avatar_bron = 'https://evil/bron.png'
      where id = 'd0000000-0000-0000-0000-000000000001' $$,
  '42501', null, 'eigenaar kan pias_avatar_bron niet meeschrijven (#682)'
);

-- 2) De opt-out-vlag zelf valt wél binnen de grant (de toggle in Instellingen),
--    en het nult meteen het bewaarde portret: "uit" betekent weg, niet verborgen.
update public.profiles
   set pias_portret = false
 where id = 'd0000000-0000-0000-0000-000000000001';
select is(
  (select pias_portret from public.profiles
    where id = 'd0000000-0000-0000-0000-000000000001'),
  false, 'eigenaar kan de pias-opt-out zelf uitzetten (#682)'
);
select is(
  (select pias_avatar_url from public.profiles
    where id = 'd0000000-0000-0000-0000-000000000001'),
  null, 'opt-out nult het bewaarde pias-portret (#682)'
);
select is(
  (select pias_avatar_bron from public.profiles
    where id = 'd0000000-0000-0000-0000-000000000001'),
  null, 'opt-out nult ook de pias-bron, zodat het portret als vervallen geldt (#682)'
);

-- Het dictator-portret blijft staan: de twee opt-outs zijn los van elkaar.
select is(
  (select dictator_avatar_url from public.profiles
    where id = 'd0000000-0000-0000-0000-000000000001'),
  'https://cdn/dictator.png',
  'de pias-opt-out raakt het dictator-portret niet (#682)'
);

-- 3) Een fotowissel laat álle portretten vervallen — ook die van de dictator, en
--    ook als de eigenaar zelf de foto verwisselt.
update public.profiles
   set avatar_url = 'https://cdn/foto-2.png'
 where id = 'd0000000-0000-0000-0000-000000000001';
select is(
  (select dictator_avatar_url from public.profiles
    where id = 'd0000000-0000-0000-0000-000000000001'),
  null, 'fotowissel laat het dictator-portret vervallen (#554)'
);
select is(
  (select dictator_avatar_bron from public.profiles
    where id = 'd0000000-0000-0000-0000-000000000001'),
  null, 'fotowissel laat ook de dictator-bron vervallen (#554)'
);

reset role;

------------------------------------------------------------------------
-- De guard hangt onder zijn nieuwe naam aan profiles, en de oude is weg — zodat
-- een halve rename (function nieuw, trigger oud) niet stil door de tests glipt.
------------------------------------------------------------------------
select is(
  (select count(*)::int from pg_trigger
    where tgrelid = 'public.profiles'::regclass
      and not tgisinternal
      and tgname = 'profiles_ai_portret_guard'),
  1, 'de gedeelde guard-trigger hangt onder zijn nieuwe naam aan profiles (#682)'
);
select is(
  (select count(*)::int from pg_trigger
    where tgrelid = 'public.profiles'::regclass
      and tgname = 'profiles_dictator_portret_guard'),
  0, 'de oude dictator-only guard-trigger bestaat niet meer (#682)'
);

select * from finish();

rollback;
