-- pgTAP-tests voor de profiles-UPDATE-kolomgrant (#465). De RLS-policy
-- ("Gebruiker kan eigen profiel bijwerken") laat een gebruiker zijn eigen rij
-- schrijven, maar de kolom-grant beperkt WELKE kolommen dat mogen zijn. Zo kan
-- een gebruiker is_guest/owner_id niet meeschrijven en zijn account niet tot
-- "gast" van een slachtoffer ombouwen. Zelfde patroon als #432 op matches.
begin;

select plan(6);

------------------------------------------------------------------------
-- Fixtures (als superuser). De trigger handle_new_user maakt de profielen.
-- a = aanvaller, v = slachtoffer.
------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
values
  ('00000000-0000-0000-0000-000000000000','c0000000-0000-0000-0000-000000000001','authenticated','authenticated','a@test.nl','x',now(),'{}','{"username":"aanvaller"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','c0000000-0000-0000-0000-000000000002','authenticated','authenticated','v@test.nl','x',now(),'{}','{"username":"slachtoffer"}',now(),now(),'','','','');

------------------------------------------------------------------------
-- Vertrekpunt: de aanvaller is een echte gebruiker (geen gast).
------------------------------------------------------------------------
select is(
  (select is_guest from public.profiles where id = 'c0000000-0000-0000-0000-000000000001'),
  false, 'fixture: aanvaller start als echte gebruiker'
);

------------------------------------------------------------------------
-- Gedrag onder de rol authenticated, als de aanvaller.
------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"c0000000-0000-0000-0000-000000000001","role":"authenticated"}';

-- #465: de kolom-grant weigert een UPDATE die is_guest/owner_id meeschrijft — nog
-- vóór RLS (42501). Zonder de grant zou de rij-policy (id = auth.uid()) dit
-- toestaan en de aanvaller tot gast van het slachtoffer maken.
select throws_ok(
  $$ update public.profiles
        set is_guest = true, owner_id = 'c0000000-0000-0000-0000-000000000002'
      where id = 'c0000000-0000-0000-0000-000000000001' $$,
  '42501', null, 'aanvaller kan zich niet tot gast van een slachtoffer ombouwen (#465)'
);

-- Ook owner_id los meeschrijven wordt door de grant geweigerd (42501), nog vóór
-- de check-constraint profiles_guest_owner_chk zou toeslaan.
select throws_ok(
  $$ update public.profiles
        set owner_id = 'c0000000-0000-0000-0000-000000000002'
      where id = 'c0000000-0000-0000-0000-000000000001' $$,
  '42501', null, 'aanvaller kan owner_id niet meeschrijven (#465)'
);

-- De escalatie is niet gebeurd: de aanvaller is nog steeds een echte gebruiker.
select is(
  (select is_guest from public.profiles where id = 'c0000000-0000-0000-0000-000000000001'),
  false, 'aanvaller is nog steeds een echte gebruiker (#465)'
);

-- Regressie: legitieme profielkolommen vallen binnen de grant en blijven
-- schrijfbaar voor de eigenaar (updateProfile).
update public.profiles
   set username = 'aanvaller_nieuw'
 where id = 'c0000000-0000-0000-0000-000000000001';
select is(
  (select username from public.profiles where id = 'c0000000-0000-0000-0000-000000000001'),
  'aanvaller_nieuw', 'eigenaar kan zijn username nog steeds bijwerken (#465)'
);

-- Regressie: instellingen-kolommen (privacy + meldingen) vallen binnen de grant.
update public.profiles
   set roast_intensiteit = 'radioactief', notify_rank_change = false
 where id = 'c0000000-0000-0000-0000-000000000001';
select is(
  (select roast_intensiteit::text from public.profiles where id = 'c0000000-0000-0000-0000-000000000001'),
  'radioactief', 'eigenaar kan privacy-/meldingsinstellingen nog steeds bijwerken (#465)'
);

reset role;

select * from finish();

rollback;
