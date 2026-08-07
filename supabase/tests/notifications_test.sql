-- pgTAP-tests voor de meldingen-inbox (#1090).
--
-- Twee dingen liggen hier vast. Ten eerste het rolmodel: een melding is
-- persoonlijk, je mag er precies één ding aan veranderen (of je haar gezien
-- hebt), en schrijven doet alleen de service-role. Dat is deels een grant-vraag
-- en geen RLS-vraag — een update-policy zonder smalle kolomgrant zou je je eigen
-- melding laten herschrijven, en dat ziet niemand aan de policy af.
--
-- Ten tweede het samenvouwen op tag. Dezelfde tag vervangt een óngelezen rij en
-- maakt ná het lezen een nieuwe: precies wat renotify op het toestel doet. Dat
-- hangt aan een PARTIËLE unieke index, en die brosheid (ON CONFLICT moet het
-- where-predicaat herhalen) is exact waarom het hier vastgezet wordt.
begin;

select plan(27);

------------------------------------------------------------------------
-- Fixtures (als superuser). De trigger handle_new_user maakt de profielen.
-- a en b zijn spelers, g is een gast van a.
------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
values
  ('00000000-0000-0000-0000-000000000000','e0000000-0000-0000-0000-000000000001','authenticated','authenticated','melding-a@test.nl','x',now(),'{}','{"username":"melding-a"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','e0000000-0000-0000-0000-000000000002','authenticated','authenticated','melding-b@test.nl','x',now(),'{}','{"username":"melding-b"}',now(),now(),'','','','');

insert into public.profiles (id, username, is_guest, owner_id)
values (
  'e0000000-0000-0000-0000-00000000000f', 'melding-gast', true,
  'e0000000-0000-0000-0000-000000000001'
);

------------------------------------------------------------------------
-- Structuur.
------------------------------------------------------------------------
select has_table('public', 'notifications', 'tabel public.notifications bestaat');

select is(
  (select relrowsecurity from pg_class where oid = 'public.notifications'::regclass),
  true, 'RLS staat aan op public.notifications'
);

select policies_are(
  'public', 'notifications',
  array['notifications_select_own', 'notifications_update_own'],
  'alleen een select- en een update-policy: inserten en verwijderen doet de service-role'
);

-- De grant-kant. Lezen mag (PostgREST heeft naast de policy een tabelgrant
-- nodig), inserten niet, en updaten alléén read_at.
select is(
  has_table_privilege('authenticated', 'public.notifications', 'SELECT'),
  true, 'authenticated heeft een SELECT-grant (RLS beperkt de rijen)'
);
select is(
  has_table_privilege('authenticated', 'public.notifications', 'INSERT'),
  false, 'authenticated kan geen meldingen inserten'
);
select is(
  has_column_privilege('authenticated', 'public.notifications', 'read_at', 'UPDATE'),
  true, 'authenticated mag read_at bijwerken'
);
select is(
  has_column_privilege('authenticated', 'public.notifications', 'title', 'UPDATE'),
  false, 'authenticated mag de titel niet herschrijven'
);

------------------------------------------------------------------------
-- meldingen_schrijven: het samenvouwen op tag.
------------------------------------------------------------------------
select is(
  public.meldingen_schrijven(jsonb_build_array(
    jsonb_build_object('user_id','e0000000-0000-0000-0000-000000000001','soort','poll','title','T1','body','B1','url','/x','tag','poll-1'),
    jsonb_build_object('user_id','e0000000-0000-0000-0000-000000000002','soort','poll','title','T1','body','B1','url','/x','tag','poll-1')
  )),
  2, 'meldingen_schrijven schrijft één rij per ontvanger'
);

-- Zelfde tag, nog ongelezen: bijwerken, niet stapelen.
select is(
  public.meldingen_schrijven(jsonb_build_array(
    jsonb_build_object('user_id','e0000000-0000-0000-0000-000000000001','soort','poll','title','T2','body','B2','url','/y','tag','poll-1')
  )),
  1, 'dezelfde tag levert opnieuw één geraakte rij op'
);
select is(
  (select count(*) from public.notifications
   where user_id = 'e0000000-0000-0000-0000-000000000001' and tag = 'poll-1'),
  1::bigint, 'een ongelezen melding met dezelfde tag stapelt niet (#189)'
);
select is(
  (select title from public.notifications
   where user_id = 'e0000000-0000-0000-0000-000000000001' and tag = 'poll-1'),
  'T2', 'de tekst van de laatste gebeurtenis wint'
);

-- Twee keer dezelfde (ontvanger, tag) in één payload: de laatste wint, en het
-- statement klapt niet op "cannot affect row a second time".
select lives_ok(
  $$ select public.meldingen_schrijven(jsonb_build_array(
       jsonb_build_object('user_id','e0000000-0000-0000-0000-000000000001','soort','uitslag','title','eerste','body','B','url','/z','tag','dubbel'),
       jsonb_build_object('user_id','e0000000-0000-0000-0000-000000000001','soort','uitslag','title','laatste','body','B','url','/z','tag','dubbel')
     )) $$,
  'een dubbele (ontvanger, tag) in één payload is geen fout'
);
select is(
  (select title from public.notifications where tag = 'dubbel'),
  'laatste', 'bij een dubbele sleutel wint de laatste in de payload'
);

-- Gelezen? Dan is dezelfde tag een nieuwe gebeurtenis, en blijft de historie.
update public.notifications set read_at = now()
where user_id = 'e0000000-0000-0000-0000-000000000001' and tag = 'poll-1';
select is(
  public.meldingen_schrijven(jsonb_build_array(
    jsonb_build_object('user_id','e0000000-0000-0000-0000-000000000001','soort','poll','title','T3','body','B3','url','/y','tag','poll-1')
  )),
  1, 'na het lezen schrijft dezelfde tag opnieuw'
);
select is(
  (select count(*) from public.notifications
   where user_id = 'e0000000-0000-0000-0000-000000000001' and tag = 'poll-1'),
  2::bigint, 'een gelezen melding blijft staan naast de nieuwe (historie)'
);

-- Gasten en onbekende id''s vallen stil weg in plaats van de batch te laten
-- klappen op de foreign key. Een gast logt nooit in; een inbox voor hem is
-- ballast.
select is(
  public.meldingen_schrijven(jsonb_build_array(
    jsonb_build_object('user_id','e0000000-0000-0000-0000-00000000000f','soort','poll','title','G','body','B','url','/x','tag','gast'),
    jsonb_build_object('user_id','00000000-0000-0000-0000-0000000000ff','soort','poll','title','X','body','B','url','/x','tag','weg')
  )),
  0, 'gasten en onbekende ontvangers leveren geen rij op'
);

select is(public.meldingen_schrijven('[]'::jsonb), 0, 'een lege payload doet niets');
select is(public.meldingen_schrijven(null), 0, 'een null-payload doet niets');

------------------------------------------------------------------------
-- prune_notifications: de retentie.
------------------------------------------------------------------------
update public.notifications set created_at = now() - interval '100 days'
where tag = 'dubbel';
select is(public.prune_notifications(), 1, 'prune_notifications ruimt rijen ouder dan 90 dagen op');
select is(public.prune_notifications(), 0, 'een tweede keer valt er niets meer op te ruimen');

------------------------------------------------------------------------
-- Gedrag onder de rol authenticated, als speler a.
------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"e0000000-0000-0000-0000-000000000001","role":"authenticated"}';

select is(
  (select count(*) from public.notifications
   where user_id = 'e0000000-0000-0000-0000-000000000002'),
  0::bigint, 'je ziet de meldingen van een ander niet (#1090)'
);
select isnt(
  (select count(*) from public.notifications),
  0::bigint, 'je ziet je eigen meldingen wél'
);

-- "Gelezen" en "alles gelezen" zijn dezelfde update, en die moet mogen.
select lives_ok(
  $$ update public.notifications set read_at = now() where read_at is null $$,
  'je mag je eigen meldingen als gelezen markeren'
);

-- En verder niets: de kolomgrant is de enige bescherming, want RLS kent geen
-- kolommen.
select throws_ok(
  $$ update public.notifications set title = 'gekaapt' $$,
  '42501', null, 'je kunt de tekst van je eigen melding niet herschrijven'
);
select throws_ok(
  $$ insert into public.notifications (user_id, soort, title, body, url, tag)
     values ('e0000000-0000-0000-0000-000000000001','poll','t','b','/x','zelf') $$,
  '42501', null, 'je kunt jezelf geen melding sturen'
);
select throws_ok(
  $$ select public.meldingen_schrijven('[]'::jsonb) $$,
  '42501', null, 'meldingen_schrijven is service-role-only'
);
select throws_ok(
  $$ select public.prune_notifications() $$,
  '42501', null, 'prune_notifications is service-role-only'
);

reset role;

select * from finish();

rollback;
