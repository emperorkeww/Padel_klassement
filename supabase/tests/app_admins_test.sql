-- pgTAP-tests voor het rolmodel van het adminpaneel (#1036).
--
-- De kern van deze suite: een gewone `authenticated` sessie mag NIETS met de
-- admintabellen en -functies. Niet lezen, niet schrijven, en zichzelf al
-- helemaal niet tot beheerder benoemen. Anders dan bij de andere tabellen in dit
-- schema is dat hier geen RLS-vraag maar een grant-vraag: er staat bewust geen
-- enkele policy op app_admins/admin_audit_log, en de grants voor anon en
-- authenticated zijn ingetrokken. Dat is wat hieronder wordt vastgezet — juist
-- omdat "we hebben er geen policy op gezet" iets is dat er over vijf PR's
-- onopgemerkt bij kan sluipen.
begin;

select plan(19);

------------------------------------------------------------------------
-- Fixtures (als superuser). De trigger handle_new_user maakt de profielen.
-- b = beheerder, g = gewone gebruiker.
------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
values
  ('00000000-0000-0000-0000-000000000000','d0000000-0000-0000-0000-000000000001','authenticated','authenticated','beheerder@test.nl','x',now(),'{}','{"username":"beheerder"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','d0000000-0000-0000-0000-000000000002','authenticated','authenticated','gewoon@test.nl','x',now(),'{}','{"username":"gewoon"}',now(),now(),'','','','');

insert into public.app_admins (user_id, note)
values ('d0000000-0000-0000-0000-000000000001', 'fixture');

------------------------------------------------------------------------
-- Structuur.
------------------------------------------------------------------------
select has_table('public', 'app_admins', 'tabel public.app_admins bestaat');
select has_table('public', 'admin_audit_log', 'tabel public.admin_audit_log bestaat');

select is(
  (select relrowsecurity from pg_class where oid = 'public.app_admins'::regclass),
  true, 'RLS staat aan op public.app_admins'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.admin_audit_log'::regclass),
  true, 'RLS staat aan op public.admin_audit_log'
);

-- Nul policies, en dat is de bedoeling: geen policy = geen enkele rij voor
-- PostgREST. Een telling in plaats van policies_are(…, array[]) omdat dit
-- precies uitdrukt wat de regel is: er hoort er géén bij te komen.
select is(
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'app_admins'),
  0::bigint, 'public.app_admins heeft bewust geen enkele policy (#1036)'
);
select is(
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'admin_audit_log'),
  0::bigint, 'public.admin_audit_log heeft bewust geen enkele policy (#1036)'
);

-- De grant-kant, los van RLS. PostgREST heeft naast een policy ook een
-- tabelgrant nodig; deze twee assertions bewaken dat de revoke uit de migratie
-- niet stilletjes terugdraait via de default privileges van een nieuwe CLI.
select is(
  has_table_privilege('authenticated', 'public.app_admins', 'SELECT'),
  false, 'authenticated heeft geen SELECT-grant op app_admins'
);
select is(
  has_table_privilege('anon', 'public.admin_audit_log', 'SELECT'),
  false, 'anon heeft geen SELECT-grant op admin_audit_log'
);

------------------------------------------------------------------------
-- Gedrag onder de rol authenticated, als de gewone gebruiker.
------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"d0000000-0000-0000-0000-000000000002","role":"authenticated"}';

-- De kern van #1036: niemand benoemt zichzelf tot beheerder.
select throws_ok(
  $$ insert into public.app_admins (user_id)
     values ('d0000000-0000-0000-0000-000000000002') $$,
  '42501', null, 'gewone gebruiker kan zichzelf niet tot beheerder maken (#1036)'
);

select throws_ok(
  $$ select * from public.app_admins $$,
  '42501', null, 'gewone gebruiker kan de beheerderslijst niet lezen (#1036)'
);

select throws_ok(
  $$ delete from public.app_admins $$,
  '42501', null, 'gewone gebruiker kan de beheerderslijst niet legen (#1036)'
);

select throws_ok(
  $$ select * from public.admin_audit_log $$,
  '42501', null, 'gewone gebruiker kan het auditspoor niet lezen (#1036)'
);

-- Ook de functies zijn dicht: service-role-only. Zonder deze revoke zou een
-- ingelogde gebruiker via rpc('admin_users_overzicht') het e-mailadres van
-- iedereen kunnen ophalen — de functie is security definer en omzeilt RLS.
select throws_ok(
  $$ select * from public.admin_users_overzicht() $$,
  '42501', null, 'gewone gebruiker kan admin_users_overzicht() niet uitvoeren (#1036)'
);

select throws_ok(
  $$ select public.is_app_admin('d0000000-0000-0000-0000-000000000001') $$,
  '42501', null, 'gewone gebruiker kan is_app_admin() niet uitvoeren (#1036)'
);

------------------------------------------------------------------------
-- Terug als superuser: de functie zelf doet wél wat ze belooft.
------------------------------------------------------------------------
reset role;

select is(
  public.is_app_admin('d0000000-0000-0000-0000-000000000001'),
  true, 'is_app_admin() herkent de beheerder'
);

select is(
  public.is_app_admin('d0000000-0000-0000-0000-000000000002'),
  false, 'is_app_admin() wijst een gewone gebruiker af'
);

------------------------------------------------------------------------
-- admin_user_detail: een onbekend id moet null opleveren, niet een keurig
-- gevuld leeg detail. Zonder de from/where in die functie levert de select
-- namelijk altijd één rij op en geeft de edge function 200 terug voor élk
-- willekeurig uuid — het lijkt dan alsof dat account bestaat en gewoon nog
-- niets gedaan heeft. Gevonden bij de end-to-end-controle van #1036.
------------------------------------------------------------------------
select is(
  public.admin_user_detail('00000000-0000-0000-0000-0000000000ff'),
  null, 'admin_user_detail() geeft null voor een onbekende gebruiker (#1036)'
);

select isnt(
  public.admin_user_detail('d0000000-0000-0000-0000-000000000002'),
  null, 'admin_user_detail() geeft wél een detail voor een bestaande gebruiker'
);

select is(
  public.admin_user_detail('d0000000-0000-0000-0000-000000000002') ? 'groepen'
    and public.admin_user_detail('d0000000-0000-0000-0000-000000000002') ? 'matches'
    and public.admin_user_detail('d0000000-0000-0000-0000-000000000002') ? 'gasten'
    and public.admin_user_detail('d0000000-0000-0000-0000-000000000002') ? 'push_subscripties',
  true, 'admin_user_detail() levert alle vier de blokken van het detailpaneel'
);

select * from finish();

rollback;
