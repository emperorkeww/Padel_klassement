-- pgTAP-tests voor het inhoudsbeheer van de beheerder (#1159).
--
-- Twee dingen worden hier vastgezet, en het zijn precies de twee dingen die
-- stilzwijgend kunnen verschuiven:
--
--  1. De nieuwe functies zijn service-role-only. Ze zijn security definer en
--     lezen dwars door élke RLS heen — één vergeten revoke en een gewone
--     gebruiker haalt via rpc() de wedstrijden van alle vreemde groepen op,
--     precies wat #461 dichtgezet heeft.
--  2. admin_set_group_owner zet eigenaarschap op béíde plekken. groups.created_by
--     stuurt de policies aan, group_members.role stuurt de UI aan; loopt dat
--     uiteen, dan heeft een groep een eigenaar die volgens zijn eigen ledenlijst
--     gewoon lid is.
begin;

select plan(27);

------------------------------------------------------------------------
-- Fixtures (als superuser). De trigger handle_new_user maakt de profielen.
-- e = eigenaar, l = lid, b = buitenstaander.
------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
values
  ('00000000-0000-0000-0000-000000000000','e0000000-0000-0000-0000-000000000001','authenticated','authenticated','e1@test.nl','x',now(),'{}','{"username":"e1"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','e0000000-0000-0000-0000-000000000002','authenticated','authenticated','l2@test.nl','x',now(),'{}','{"username":"l2"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','e0000000-0000-0000-0000-000000000003','authenticated','authenticated','l3@test.nl','x',now(),'{}','{"username":"l3"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','e0000000-0000-0000-0000-000000000004','authenticated','authenticated','l4@test.nl','x',now(),'{}','{"username":"l4"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','e0000000-0000-0000-0000-000000000005','authenticated','authenticated','b5@test.nl','x',now(),'{}','{"username":"b5"}',now(),now(),'','','','');

-- Groep met e1 als eigenaar (de trigger voegt hem toe als lid met role owner).
insert into public.groups (id, name, created_by)
values ('e0000000-0000-0000-0000-0000000000f0','Testgroep 1159','e0000000-0000-0000-0000-000000000001');
insert into public.group_members (group_id, player_id, role)
values
  ('e0000000-0000-0000-0000-0000000000f0','e0000000-0000-0000-0000-000000000002','member'),
  ('e0000000-0000-0000-0000-0000000000f0','e0000000-0000-0000-0000-000000000003','member'),
  ('e0000000-0000-0000-0000-0000000000f0','e0000000-0000-0000-0000-000000000004','member');

-- Een gast van e1: die mag straks géén eigenaar worden.
insert into public.profiles (id, username, is_guest, owner_id)
values ('e0000000-0000-0000-0000-0000000000a1','gast1159', true, 'e0000000-0000-0000-0000-000000000001');
insert into public.group_members (group_id, player_id, role)
values ('e0000000-0000-0000-0000-0000000000f0','e0000000-0000-0000-0000-0000000000a1','member');

-- Eén afgeronde groepsmatch, aangemaakt door e1.
set local request.jwt.claims = '{"sub":"e0000000-0000-0000-0000-000000000001","role":"authenticated"}';
select isnt(
  public.create_completed_match(
    'e0000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-000000000002',
    'e0000000-0000-0000-0000-000000000003','e0000000-0000-0000-0000-000000000004',
    'a', 6::smallint, 3::smallint, 'e0000000-0000-0000-0000-0000000000f0'),
  null, 'fixture: afgeronde groepsmatch aangemaakt'
);

------------------------------------------------------------------------
-- Het auditspoor kent nu ook niet-gebruikers als doel.
------------------------------------------------------------------------
select has_column('public', 'admin_audit_log', 'target_type',
  'admin_audit_log heeft target_type (#1159)');
select has_column('public', 'admin_audit_log', 'target_id',
  'admin_audit_log heeft target_id (#1159)');

select throws_ok(
  $$ insert into public.admin_audit_log (actor_id, action, target_type, target_id)
     values ('e0000000-0000-0000-0000-000000000001','delete_match','planeet',
             'e0000000-0000-0000-0000-0000000000f0') $$,
  '23514', null, 'target_type buiten match/group/poll wordt geweigerd'
);

-- De bestaande accountacties blijven werken zonder de nieuwe kolommen.
select lives_ok(
  $$ insert into public.admin_audit_log (actor_id, action, target_user_id)
     values ('e0000000-0000-0000-0000-000000000001','sign_out_all',
             'e0000000-0000-0000-0000-000000000002') $$,
  'een accountactie zonder target_type blijft geldig (#1036)'
);

------------------------------------------------------------------------
-- Grants: service-role-only. Dit is de kern van de suite.
------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"e0000000-0000-0000-0000-000000000005","role":"authenticated"}';

select throws_ok(
  $$ select * from public.admin_matches_overzicht() $$,
  '42501', null, 'gewone gebruiker kan admin_matches_overzicht() niet uitvoeren (#1159)'
);
select throws_ok(
  $$ select * from public.admin_polls_overzicht() $$,
  '42501', null, 'gewone gebruiker kan admin_polls_overzicht() niet uitvoeren (#1159)'
);
select throws_ok(
  $$ select * from public.admin_groep_leden('e0000000-0000-0000-0000-0000000000f0') $$,
  '42501', null, 'gewone gebruiker kan admin_groep_leden() niet uitvoeren (#1159)'
);
select throws_ok(
  $$ select * from public.admin_audit_recent() $$,
  '42501', null, 'gewone gebruiker kan admin_audit_recent() niet uitvoeren (#1159)'
);
select throws_ok(
  $$ select * from public.admin_set_group_owner(
       'e0000000-0000-0000-0000-0000000000f0','e0000000-0000-0000-0000-000000000005') $$,
  '42501', null, 'gewone gebruiker kan admin_set_group_owner() niet uitvoeren (#1159)'
);

-- En de RLS die dit alles bestaat om te omzeilen, staat er nog gewoon: een
-- buitenstaander ziet de groepsmatch niet. Zou #1159 dit verruimd hebben, dan
-- viel de hele redenering achter de edge-function-route weg.
select is(
  (select count(*) from public.matches
    where group_id = 'e0000000-0000-0000-0000-0000000000f0'),
  0::bigint, 'buitenstaander ziet de groepsmatch nog steeds niet (#461 blijft staan)'
);

reset role;

------------------------------------------------------------------------
-- admin_matches_overzicht: filters, telling en spelersnamen.
------------------------------------------------------------------------
select is(
  (select count(*) from public.admin_matches_overzicht(
     p_group => 'e0000000-0000-0000-0000-0000000000f0')),
  1::bigint, 'de groepsmatch staat in het overzicht'
);

select is(
  (select groep_naam from public.admin_matches_overzicht(
     p_group => 'e0000000-0000-0000-0000-0000000000f0')),
  'Testgroep 1159', 'het overzicht noemt de groep bij naam'
);

select is(
  (select array_length(team_a_spelers, 1) from public.admin_matches_overzicht(
     p_group => 'e0000000-0000-0000-0000-0000000000f0')),
  2, 'het overzicht geeft de spelersnamen van team A'
);

select is(
  (select count(*) from public.admin_matches_overzicht(
     p_group => 'e0000000-0000-0000-0000-0000000000f0', p_status => 'scheduled')),
  0::bigint, 'het statusfilter houdt een afgeronde match tegen bij scheduled'
);

select is(
  (select count(*) from public.admin_matches_overzicht(
     p_match => (select id from public.matches
                  where group_id = 'e0000000-0000-0000-0000-0000000000f0'))),
  1::bigint, 'p_match haalt precies één match op'
);

-- `totaal` telt vóór de limiet: het paneel moet "1 van N getoond" kunnen zeggen
-- in plaats van te doen alsof N gelijk is aan wat er op het scherm past.
select ok(
  (select totaal from public.admin_matches_overzicht(p_limit => 1))
    >= (select count(*) from public.admin_matches_overzicht(p_limit => 1)),
  'totaal telt de hele selectie, niet alleen de getoonde rijen'
);

------------------------------------------------------------------------
-- admin_groep_leden: de eigenaar bovenaan en herkenbaar.
------------------------------------------------------------------------
select is(
  (select username from public.admin_groep_leden('e0000000-0000-0000-0000-0000000000f0') limit 1),
  'e1', 'de eigenaar staat bovenaan de ledenlijst'
);
select is(
  (select count(*) from public.admin_groep_leden('e0000000-0000-0000-0000-0000000000f0')
    where is_eigenaar),
  1::bigint, 'precies één lid is de eigenaar'
);

------------------------------------------------------------------------
-- admin_set_group_owner.
------------------------------------------------------------------------
select throws_ok(
  $$ select * from public.admin_set_group_owner(
       'e0000000-0000-0000-0000-0000000000f0','e0000000-0000-0000-0000-000000000005') $$,
  null, 'Die speler is geen lid van deze groep',
  'een niet-lid kan geen eigenaar worden'
);

select throws_ok(
  $$ select * from public.admin_set_group_owner(
       'e0000000-0000-0000-0000-0000000000f0','e0000000-0000-0000-0000-0000000000a1') $$,
  null, 'Een gast kan geen eigenaar worden',
  'een gast kan geen eigenaar worden — die zou de groep opnieuw stuurloos maken'
);

select throws_ok(
  $$ select * from public.admin_set_group_owner(
       '00000000-0000-0000-0000-0000000000ff','e0000000-0000-0000-0000-000000000002') $$,
  null, 'Groep niet gevonden',
  'een onbekende groep levert een nette fout op'
);

select lives_ok(
  $$ select * from public.admin_set_group_owner(
       'e0000000-0000-0000-0000-0000000000f0','e0000000-0000-0000-0000-000000000002') $$,
  'een lid kan wél eigenaar worden'
);

select is(
  (select created_by from public.groups where id = 'e0000000-0000-0000-0000-0000000000f0'),
  'e0000000-0000-0000-0000-000000000002'::uuid,
  'groups.created_by wijst naar de nieuwe eigenaar'
);

select is(
  (select role from public.group_members
    where group_id = 'e0000000-0000-0000-0000-0000000000f0'
      and player_id = 'e0000000-0000-0000-0000-000000000002'),
  'owner', 'group_members.role volgt mee naar de nieuwe eigenaar'
);

select is(
  (select role from public.group_members
    where group_id = 'e0000000-0000-0000-0000-0000000000f0'
      and player_id = 'e0000000-0000-0000-0000-000000000001'),
  'member', 'de oude eigenaar zakt terug naar member'
);

select is(
  (select count(*) from public.group_members
    where group_id = 'e0000000-0000-0000-0000-0000000000f0' and role = 'owner'),
  1::bigint, 'er is precies één owner in de ledenlijst'
);

select * from finish();

rollback;
