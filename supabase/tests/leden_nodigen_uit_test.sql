-- pgTAP-tests voor #776: elk lid van een groep mag nieuwe leden toevoegen en
-- een uitnodigingslink maken — niet alleen de eigenaar. Verwijderen blijft wél
-- owner-only, dus die grens wordt hier expliciet vastgelegd.
begin;

select plan(12);

------------------------------------------------------------------------
-- Fixtures (als superuser). De trigger handle_new_user maakt de profielen.
--   m1 = eigenaar   m2/m3 = gewone leden   m5 = buitenstaander
--   m6 = vriend van m2, geen lid           m7 = vriend van m1, geen lid
------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
values
  ('00000000-0000-0000-0000-000000000000','a7760000-0000-0000-0000-000000000001','authenticated','authenticated','m1@test.nl','x',now(),'{}','{"username":"m1"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','a7760000-0000-0000-0000-000000000002','authenticated','authenticated','m2@test.nl','x',now(),'{}','{"username":"m2"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','a7760000-0000-0000-0000-000000000003','authenticated','authenticated','m3@test.nl','x',now(),'{}','{"username":"m3"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','a7760000-0000-0000-0000-000000000005','authenticated','authenticated','m5@test.nl','x',now(),'{}','{"username":"m5"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','a7760000-0000-0000-0000-000000000006','authenticated','authenticated','m6@test.nl','x',now(),'{}','{"username":"m6"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','a7760000-0000-0000-0000-000000000007','authenticated','authenticated','m7@test.nl','x',now(),'{}','{"username":"m7"}',now(),now(),'','','','');

-- m2 is bevriend met m6, m1 met m7. m5 is met niemand bevriend.
insert into public.friendships (requester_id, addressee_id, status)
values
  ('a7760000-0000-0000-0000-000000000002','a7760000-0000-0000-0000-000000000006','accepted'),
  ('a7760000-0000-0000-0000-000000000001','a7760000-0000-0000-0000-000000000007','accepted');

-- Een gast van m2 (geen account) en een gast van m5, om te tonen dat de
-- gast-tak aan de eigenaar van de gast hangt en niet aan het lidmaatschap.
insert into public.profiles (id, username, full_name, is_guest, owner_id, discoverable, allow_friend_requests)
values
  ('a7760000-0000-0000-0000-0000000000a1','gast_van_m2','Gast van m2',true,'a7760000-0000-0000-0000-000000000002',false,false);

-- Groep van m1; de trigger maakt m1 owner-lid, m2 en m3 zijn gewone leden.
insert into public.groups (id, name, created_by)
values ('a7760000-0000-0000-0000-0000000000f0','Testgroep 776','a7760000-0000-0000-0000-000000000001');
insert into public.group_members (group_id, player_id, role)
values
  ('a7760000-0000-0000-0000-0000000000f0','a7760000-0000-0000-0000-000000000002','member'),
  ('a7760000-0000-0000-0000-0000000000f0','a7760000-0000-0000-0000-000000000003','member');

set local role authenticated;

------------------------------------------------------------------------
-- Een gewoon lid (m2) voegt toe
------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"a7760000-0000-0000-0000-000000000002","role":"authenticated"}';

select lives_ok(
  $$ insert into public.group_members (group_id, player_id)
     values ('a7760000-0000-0000-0000-0000000000f0','a7760000-0000-0000-0000-000000000006') $$,
  'lid m2 mag zijn vriend m6 toevoegen'
);
select is(
  (select count(*)::int from public.group_members
     where group_id = 'a7760000-0000-0000-0000-0000000000f0'
       and player_id = 'a7760000-0000-0000-0000-000000000006'),
  1, 'm6 is nu lid van de groep'
);

select lives_ok(
  $$ insert into public.group_members (group_id, player_id)
     values ('a7760000-0000-0000-0000-0000000000f0','a7760000-0000-0000-0000-0000000000a1') $$,
  'lid m2 mag zijn eigen gast toevoegen'
);

-- De rem blijft staan: m5 is geen vriend en geen gast van m2.
select throws_ok(
  $$ insert into public.group_members (group_id, player_id)
     values ('a7760000-0000-0000-0000-0000000000f0','a7760000-0000-0000-0000-000000000005') $$,
  '42501'
);

------------------------------------------------------------------------
-- Een buitenstaander (m5) blijft buiten
------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"a7760000-0000-0000-0000-000000000005","role":"authenticated"}';

select throws_ok(
  $$ insert into public.group_members (group_id, player_id)
     values ('a7760000-0000-0000-0000-0000000000f0','a7760000-0000-0000-0000-000000000005') $$,
  '42501'
);
select throws_ok(
  $$ select public.create_group_invite('a7760000-0000-0000-0000-0000000000f0') $$,
  'P0001'
);

------------------------------------------------------------------------
-- Uitnodigingslink: elk lid maakt er een, en ziet 'm ook
------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"a7760000-0000-0000-0000-000000000002","role":"authenticated"}';

select isnt(
  public.create_group_invite('a7760000-0000-0000-0000-0000000000f0'),
  null, 'lid m2 maakt een uitnodigingslink'
);
select is(
  (select count(*)::int from public.group_invites
     where group_id = 'a7760000-0000-0000-0000-0000000000f0'),
  1, 'lid m2 ziet de uitnodiging van zijn groep'
);

set local request.jwt.claims = '{"sub":"a7760000-0000-0000-0000-000000000005","role":"authenticated"}';
select is(
  (select count(*)::int from public.group_invites),
  0, 'buitenstaander m5 ziet geen uitnodigingen'
);

------------------------------------------------------------------------
-- Regressie: de eigenaar kan alles wat hij eerst ook kon
------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"a7760000-0000-0000-0000-000000000001","role":"authenticated"}';
select lives_ok(
  $$ insert into public.group_members (group_id, player_id)
     values ('a7760000-0000-0000-0000-0000000000f0','a7760000-0000-0000-0000-000000000007') $$,
  'eigenaar m1 mag nog steeds een vriend toevoegen'
);

------------------------------------------------------------------------
-- Verwijderen blijft owner-only; jezelf verwijderen = groep verlaten
------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"a7760000-0000-0000-0000-000000000002","role":"authenticated"}';

-- Geen fout, maar de using-clausule filtert de rij weg: er verdwijnt niets.
delete from public.group_members
where group_id = 'a7760000-0000-0000-0000-0000000000f0'
  and player_id = 'a7760000-0000-0000-0000-000000000003';
select is(
  (select count(*)::int from public.group_members
     where group_id = 'a7760000-0000-0000-0000-0000000000f0'
       and player_id = 'a7760000-0000-0000-0000-000000000003'),
  1, 'lid m2 kan medelid m3 niet verwijderen'
);

delete from public.group_members
where group_id = 'a7760000-0000-0000-0000-0000000000f0'
  and player_id = 'a7760000-0000-0000-0000-000000000002';
select is(
  (select count(*)::int from public.group_members
     where group_id = 'a7760000-0000-0000-0000-0000000000f0'
       and player_id = 'a7760000-0000-0000-0000-000000000002'),
  0, 'lid m2 kan wél zichzelf verwijderen (groep verlaten)'
);

reset role;

select * from finish();

rollback;
