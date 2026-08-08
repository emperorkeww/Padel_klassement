-- pgTAP-tests voor herberekenen en de beheerdersexport (#1049).
--
-- Drie dingen worden hier vastgezet:
--
--  1. De vijf recompute_*-functies hebben nu een expliciete grant aan
--     service_role. Zonder die grant is de knop in het paneel een 42501, en is
--     een dummy-update op `matches` weer de enige route — met alle
--     push-webhooks die daaraan hangen.
--  2. Herberekenen is idempotent. Dat is de hele belofte van de knop: op een
--     consistente databank verandert er niets. Zou dat wél zo zijn, dan
--     corrigeert de knop niet maar beschadigt hij.
--  3. Herberekenen en exporteren blijven service-role-only. admin_export_user
--     leest dwars door élke RLS heen en levert iemands volledige dossier op;
--     één vergeten revoke en elke ingelogde gebruiker kan dat van een ander
--     opvragen.
begin;

select plan(17);

------------------------------------------------------------------------
-- 1. De grants die tot #1049 ontbraken.
------------------------------------------------------------------------
select ok(
  has_function_privilege('service_role', 'public.recompute_ratings()', 'execute'),
  'service_role mag recompute_ratings() uitvoeren (#1049)'
);
select ok(
  has_function_privilege('service_role', 'public.recompute_pias()', 'execute'),
  'service_role mag recompute_pias() uitvoeren (#1049)'
);
select ok(
  has_function_privilege('service_role', 'public.recompute_zwarte_piet()', 'execute'),
  'service_role mag recompute_zwarte_piet() uitvoeren (#1049)'
);
select ok(
  has_function_privilege('service_role', 'public.recompute_rank_state()', 'execute'),
  'service_role mag recompute_rank_state() uitvoeren (#1049)'
);
select ok(
  has_function_privilege('service_role', 'public.recompute_dictator_termijnen()', 'execute'),
  'service_role mag recompute_dictator_termijnen() uitvoeren (#1049)'
);

-- En ze blijven dicht voor de rest. Een `grant to service_role` mag geen
-- `grant to public` geworden zijn.
select ok(
  not has_function_privilege('authenticated', 'public.recompute_ratings()', 'execute'),
  'authenticated mag recompute_ratings() nog steeds niet uitvoeren'
);
select ok(
  not has_function_privilege('anon', 'public.recompute_ratings()', 'execute'),
  'anon mag recompute_ratings() nog steeds niet uitvoeren'
);

------------------------------------------------------------------------
-- 2. Herberekenen is idempotent.
--
-- De seed-databank is consistent, dus de hele keten opnieuw draaien hoort
-- exact dezelfde ratings op te leveren.
------------------------------------------------------------------------
create temp table ratings_voor on commit drop as
  select player_id, rating from public.player_ratings;

select lives_ok(
  $$ select public.admin_herbereken('ratings') $$,
  'admin_herbereken(ratings) draait'
);
select lives_ok(
  $$ select public.admin_herbereken('pias') $$,
  'admin_herbereken(pias) draait'
);
select lives_ok(
  $$ select public.admin_herbereken('rank_state') $$,
  'admin_herbereken(rank_state) draait'
);
select lives_ok(
  $$ select public.admin_herbereken('dictator') $$,
  'admin_herbereken(dictator) draait'
);
select lives_ok(
  $$ select public.admin_herbereken('zwarte_piet') $$,
  'admin_herbereken(zwarte_piet) draait'
);

select is(
  (select count(*)::int from (
     select player_id, rating from public.player_ratings
     except
     select player_id, rating from ratings_voor
   ) afwijkend),
  0, 'herberekenen laat een consistente databank ongemoeid (#1049)'
);

select throws_ok(
  $$ select public.admin_herbereken('verzonnen') $$,
  null, 'Onbekende herberekening: verzonnen',
  'een onbekend onderdeel wordt geweigerd in plaats van stil overgeslagen'
);

------------------------------------------------------------------------
-- 3. De export levert een volledig dossier.
------------------------------------------------------------------------
select is(
  (select public.admin_export_user(p.id) ? 'profiel' from public.profiles p
    where not p.is_guest limit 1),
  true, 'de export bevat het profiel'
);

------------------------------------------------------------------------
-- 4. Grants op de nieuwe functies: service-role-only.
------------------------------------------------------------------------
set local role authenticated;

select throws_ok(
  $$ select public.admin_herbereken('ratings') $$,
  '42501', null, 'gewone gebruiker kan niet herberekenen (#1049)'
);
select throws_ok(
  $$ select public.admin_export_user('00000000-0000-0000-0000-000000000001') $$,
  '42501', null,
  'gewone gebruiker kan de gegevens van een ander niet exporteren (#1049)'
);

reset role;

select * from finish();
rollback;
