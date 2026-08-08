-- pgTAP-tests voor het foutenlogboek (#1049).
--
-- Drie dingen worden hier vastgezet:
--
--  1. client_errors is voor de client onbereikbaar. RLS aan, nul policies, geen
--     grants. Dit is een tabel waar een publiek, ongeauthenticeerd endpoint in
--     schrijft; zou een `anon`-insert-grant er ooit op belanden, dan is het een
--     spamdoelwit, en een select-grant maakt van elke stacktrace publieke
--     informatie.
--  2. De groepering telt wat ze hoort te tellen — dát is de reden dat het
--     tabblad leesbaar blijft bij één kapotte route.
--  3. Beide opruimgrenzen doen hun werk: de dagengrens tegen langzame groei,
--     de rijgrens tegen een renderlus die er duizenden per uur inpompt.
begin;

select plan(19);

------------------------------------------------------------------------
-- 1. Vorm van de tabel.
------------------------------------------------------------------------
select has_table('public', 'client_errors', 'client_errors bestaat (#1049)');
select has_column('public', 'client_errors', 'boodschap', 'heeft boodschap');
select has_column('public', 'client_errors', 'chunk', 'heeft chunk-markering (#733)');
select has_column('public', 'client_errors', 'release', 'heeft release/build');

-- Bewust géén user_id: errorReport.ts stuurt hem niet, en dat is daar een
-- expliciete privacykeuze. Een kolom die alleen te vullen is door die keuze
-- terug te draaien, nodigt uit om dat te doen.
select hasnt_column('public', 'client_errors', 'user_id',
  'client_errors heeft bewust geen user_id (#733 stuurt er geen)');

select is(
  (select relrowsecurity from pg_class where oid = 'public.client_errors'::regclass),
  true, 'RLS staat aan op client_errors'
);

select is(
  (select count(*)::int from pg_policies
    where schemaname = 'public' and tablename = 'client_errors'),
  0, 'client_errors heeft nul policies'
);

------------------------------------------------------------------------
-- 2. Fixtures voor de groepering.
--
-- Twee identieke fouten uit twee verschillende sessies, plus twee andere.
------------------------------------------------------------------------
insert into public.client_errors
  (bron, boodschap, stack, scope, pad, release, sessie, chunk, created_at)
values
  ('render','undefined naam','TypeError: oud','route','/match/1','b1','s1',false, now() - interval '2 hours'),
  ('render','undefined naam','TypeError: nieuw','route','/match/2','b1','s2',false, now() - interval '1 hour'),
  ('window','Failed to fetch',null,null,'/feed','b1','s3',false, now()),
  ('promise','Loading chunk 42 failed',null,null,'/agenda','b2','s4',true, now());

select is(
  (select count(*)::int from public.admin_client_errors()),
  3, 'vier meldingen worden drie groepen'
);

select is(
  (select aantal from public.admin_client_errors() where boodschap = 'undefined naam'),
  2::bigint, 'de groep telt beide voorkomens'
);

select is(
  (select sessies from public.admin_client_errors() where boodschap = 'undefined naam'),
  2::bigint, 'de groep telt de verschillende sessies'
);

-- De nieuwste stack, niet zomaar een: die hoort bij de laatste keer dat het
-- misging en is daarmee de bruikbare.
select is(
  (select voorbeeld_stack from public.admin_client_errors() where boodschap = 'undefined naam'),
  'TypeError: nieuw', 'de groep toont de nieuwste stack als voorbeeld'
);

select is(
  (select chunk from public.admin_client_errors() where boodschap = 'Loading chunk 42 failed'),
  true, 'een chunkfout blijft als zodanig gemarkeerd (#733)'
);

------------------------------------------------------------------------
-- 3. Opruimen: de twee grenzen.
------------------------------------------------------------------------
insert into public.client_errors (bron, boodschap, created_at)
values ('render','stokoud', now() - interval '40 days');

select is(
  public.prune_client_errors(30, 50000), 1,
  'de dagengrens ruimt een rij van 40 dagen oud op'
);

-- De rijgrens: 1500 rijen erbij, bewaargrens op de bodem van 1000.
insert into public.client_errors (bron, boodschap)
select 'render', 'massa' from generate_series(1, 1500);

select cmp_ok(
  public.prune_client_errors(30, 1), '>', 0,
  'de rijgrens snijdt bij duizenden rijen wél in (bodem 1000)'
);

select cmp_ok(
  (select count(*) from public.client_errors), '<=', 1000::bigint,
  'na het opruimen blijven er hoogstens 1000 rijen over'
);

------------------------------------------------------------------------
-- 4. Grants: service-role-only. De kern van de suite.
------------------------------------------------------------------------
set local role authenticated;

select throws_ok(
  $$ select * from public.client_errors $$,
  '42501', null, 'gewone gebruiker kan client_errors niet lezen (#1049)'
);
select throws_ok(
  $$ insert into public.client_errors (bron, boodschap) values ('render','spam') $$,
  '42501', null, 'gewone gebruiker kan niet in client_errors schrijven (#1049)'
);
select throws_ok(
  $$ select * from public.admin_client_errors() $$,
  '42501', null, 'gewone gebruiker kan admin_client_errors() niet uitvoeren (#1049)'
);

reset role;
set local role anon;

select throws_ok(
  $$ insert into public.client_errors (bron, boodschap) values ('render','spam') $$,
  '42501', null, 'anon kan niet in client_errors schrijven (#1049)'
);

reset role;

select * from finish();
rollback;
