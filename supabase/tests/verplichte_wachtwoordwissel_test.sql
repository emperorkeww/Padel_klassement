-- pgTAP-tests voor de verplichte wachtwoordwissel (#1036).
--
-- Twee dingen die deze suite vastzet, en die allebei stil kunnen wegvallen:
--
--  1. `moet_wachtwoord_wijzigen` staat NIET in de grant-update-lijst van
--     profiles (#465). Wie zijn eigen vlag kan uitzetten, kan met een door een
--     beheerder uitgedeeld tijdelijk wachtwoord blijven rondlopen. Dit is een
--     kolom die niet toegevoegd is — het soort ding dat je per ongeluk "erbij
--     zet" bij de volgende voorkeurskolom.
--  2. De trigger vuurt op een wachtwoordwissel en NIET op een gewone login.
--     Zonder `of encrypted_password` + de when-clausule zou last_sign_in_at de
--     vlag wissen, en dan houdt de gedwongen wissel precies één login stand.
begin;

select plan(11);

------------------------------------------------------------------------
-- Fixtures. De trigger handle_new_user maakt de profielen.
------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
values
  ('00000000-0000-0000-0000-000000000000','e0000000-0000-0000-0000-000000000001','authenticated','authenticated','tijdelijk@test.nl','oud',now(),'{}','{"username":"tijdelijkje"}',now(),now(),'','','','');

------------------------------------------------------------------------
-- Structuur.
------------------------------------------------------------------------
select has_column('public', 'profiles', 'moet_wachtwoord_wijzigen',
  'profiles heeft de kolom moet_wachtwoord_wijzigen');
select col_not_null('public', 'profiles', 'moet_wachtwoord_wijzigen',
  'moet_wachtwoord_wijzigen is not null');
select is(
  (select moet_wachtwoord_wijzigen from public.profiles
    where id = 'e0000000-0000-0000-0000-000000000001'),
  false, 'een nieuw account start zonder verplichte wissel'
);

select has_function('public', 'handle_password_changed', '{}'::text[],
  'public.handle_password_changed() bestaat');
select has_trigger('auth', 'users', 'on_auth_password_changed',
  'de trigger on_auth_password_changed hangt aan auth.users');

------------------------------------------------------------------------
-- De grant: niemand zet zijn eigen vlag uit.
------------------------------------------------------------------------
select is(
  has_column_privilege('authenticated', 'public.profiles', 'moet_wachtwoord_wijzigen', 'UPDATE'),
  false, 'authenticated heeft geen UPDATE-grant op moet_wachtwoord_wijzigen (#1036)'
);

-- De vlag aanzetten zoals de edge function dat doet (service-role, dus hier
-- gewoon als superuser).
update public.profiles set moet_wachtwoord_wijzigen = true
 where id = 'e0000000-0000-0000-0000-000000000001';

set local role authenticated;
set local request.jwt.claims = '{"sub":"e0000000-0000-0000-0000-000000000001","role":"authenticated"}';

-- De rij-policy ("Gebruiker kan eigen profiel bijwerken") staat deze UPDATE toe;
-- de kolom-grant weigert hem alsnog, met 42501 en nog vóór RLS.
select throws_ok(
  $$ update public.profiles set moet_wachtwoord_wijzigen = false
      where id = 'e0000000-0000-0000-0000-000000000001' $$,
  '42501', null, 'gebruiker kan zijn eigen wachtwoordwissel-vlag niet uitzetten (#1036)'
);

-- Meeliften op een wél toegestane kolom mag evenmin: de grant kijkt naar élke
-- kolom in het statement, niet alleen naar de eerste.
select throws_ok(
  $$ update public.profiles set full_name = 'Sluiproute', moet_wachtwoord_wijzigen = false
      where id = 'e0000000-0000-0000-0000-000000000001' $$,
  '42501', null, 'de vlag kan ook niet meeliften op een toegestane kolom (#1036)'
);

reset role;

select is(
  (select moet_wachtwoord_wijzigen from public.profiles
    where id = 'e0000000-0000-0000-0000-000000000001'),
  true, 'de vlag staat na die pogingen nog steeds aan'
);

------------------------------------------------------------------------
-- De trigger: een login wist niets, een wachtwoordwissel wél.
------------------------------------------------------------------------
update auth.users set last_sign_in_at = now()
 where id = 'e0000000-0000-0000-0000-000000000001';

select is(
  (select moet_wachtwoord_wijzigen from public.profiles
    where id = 'e0000000-0000-0000-0000-000000000001'),
  true, 'inloggen (last_sign_in_at) laat de vlag staan (#1036)'
);

update auth.users set encrypted_password = 'nieuw'
 where id = 'e0000000-0000-0000-0000-000000000001';

select is(
  (select moet_wachtwoord_wijzigen from public.profiles
    where id = 'e0000000-0000-0000-0000-000000000001'),
  false, 'een gewijzigd wachtwoord wist de vlag (#1036)'
);

select * from finish();

rollback;
