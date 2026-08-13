-- pgTAP-tests voor generate_mexicano_round (#1271).
--
-- De RPC had geen enkele test. Twee dingen worden hier vastgelegd:
--
--   1. De spelerselectie telt. Vóór #1271 rangschikte de functie álle
--      group_members, dus wie zich afmeldde stond gewoon op de baan terwijl de
--      speeldagkaart "N aan · M op de bank" beloofde. p_players is een pool:
--      wie erin staat kan spelen, de vólgorde komt uit de stand.
--   2. De ronde-blokkade gaat over uitslagen die nog moeten komen. Ze keek naar
--      `status <> 'completed'`, en dat is ook waar voor een geannuleerde match —
--      één cancelled rij blokkeerde de Mexicano van een groep permanent.
begin;

select plan(7);

------------------------------------------------------------------------
-- Fixtures. m1 bezit de groep (de trigger maakt hem owner-lid), m2..m8 zijn
-- lid, m9 staat er bewust buiten. Acht leden, zodat een selectie van vier
-- zichtbaar minder is dan de hele lijst.
------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
values
  ('00000000-0000-0000-0000-000000000000','d0000000-0000-0000-0000-000000000001','authenticated','authenticated','mx1@test.nl','x',now(),'{}','{"username":"mx1"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','d0000000-0000-0000-0000-000000000002','authenticated','authenticated','mx2@test.nl','x',now(),'{}','{"username":"mx2"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','d0000000-0000-0000-0000-000000000003','authenticated','authenticated','mx3@test.nl','x',now(),'{}','{"username":"mx3"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','d0000000-0000-0000-0000-000000000004','authenticated','authenticated','mx4@test.nl','x',now(),'{}','{"username":"mx4"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','d0000000-0000-0000-0000-000000000005','authenticated','authenticated','mx5@test.nl','x',now(),'{}','{"username":"mx5"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','d0000000-0000-0000-0000-000000000006','authenticated','authenticated','mx6@test.nl','x',now(),'{}','{"username":"mx6"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','d0000000-0000-0000-0000-000000000007','authenticated','authenticated','mx7@test.nl','x',now(),'{}','{"username":"mx7"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','d0000000-0000-0000-0000-000000000008','authenticated','authenticated','mx8@test.nl','x',now(),'{}','{"username":"mx8"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','d0000000-0000-0000-0000-000000000009','authenticated','authenticated','mx9@test.nl','x',now(),'{}','{"username":"mx9"}',now(),now(),'','','','');

insert into public.groups (id, name, created_by)
values ('d0000000-0000-0000-0000-0000000000f0','Mexicano-testgroep','d0000000-0000-0000-0000-000000000001');
insert into public.group_members (group_id, player_id, role)
values
  ('d0000000-0000-0000-0000-0000000000f0','d0000000-0000-0000-0000-000000000002','member'),
  ('d0000000-0000-0000-0000-0000000000f0','d0000000-0000-0000-0000-000000000003','member'),
  ('d0000000-0000-0000-0000-0000000000f0','d0000000-0000-0000-0000-000000000004','member'),
  ('d0000000-0000-0000-0000-0000000000f0','d0000000-0000-0000-0000-000000000005','member'),
  ('d0000000-0000-0000-0000-0000000000f0','d0000000-0000-0000-0000-000000000006','member'),
  ('d0000000-0000-0000-0000-0000000000f0','d0000000-0000-0000-0000-000000000007','member'),
  ('d0000000-0000-0000-0000-0000000000f0','d0000000-0000-0000-0000-000000000008','member');

set local request.jwt.claims = '{"sub":"d0000000-0000-0000-0000-000000000001","role":"authenticated"}';

------------------------------------------------------------------------
-- 1. Met een selectie van vier: één baan, en precies die vier.
------------------------------------------------------------------------
select is(
  (select count(*)::int from public.generate_mexicano_round(
     'd0000000-0000-0000-0000-0000000000f0', null,
     array['d0000000-0000-0000-0000-000000000001',
           'd0000000-0000-0000-0000-000000000002',
           'd0000000-0000-0000-0000-000000000003',
           'd0000000-0000-0000-0000-000000000004']::uuid[])),
  1, 'vier geselecteerde spelers leveren één baan op'
);

select is(
  (select array_agg(distinct p order by p)
   from (
     select unnest(array[t.player1_id, t.player2_id]) as p
     from public.matches m
     join public.teams t on t.id in (m.team_a_id, m.team_b_id)
     where m.group_id = 'd0000000-0000-0000-0000-0000000000f0'
       and m.round_number = 1
   ) x
   where p is not null),
  array['d0000000-0000-0000-0000-000000000001',
        'd0000000-0000-0000-0000-000000000002',
        'd0000000-0000-0000-0000-000000000003',
        'd0000000-0000-0000-0000-000000000004']::uuid[],
  'alleen de geselecteerde spelers staan op de baan'
);

------------------------------------------------------------------------
-- 2. Een niet-lid smokkelen mag niet — zelfde grens als create_fair_round.
------------------------------------------------------------------------
select throws_ok(
  $$select public.generate_mexicano_round(
      'd0000000-0000-0000-0000-0000000000f0', null,
      array['d0000000-0000-0000-0000-000000000001',
            'd0000000-0000-0000-0000-000000000002',
            'd0000000-0000-0000-0000-000000000003',
            'd0000000-0000-0000-0000-000000000009']::uuid[])$$,
  'Alle spelers moeten lid zijn van deze groep',
  'een speler buiten de groep wordt geweigerd'
);

------------------------------------------------------------------------
-- 3. Zonder selectie blijft het oude gedrag staan: de hele ledenlijst.
------------------------------------------------------------------------
update public.matches
   set status = 'completed', winner_team_id = team_a_id, score_a = 6, score_b = 3
 where group_id = 'd0000000-0000-0000-0000-0000000000f0';

select is(
  (select count(*)::int from public.generate_mexicano_round(
     'd0000000-0000-0000-0000-0000000000f0')),
  2, 'zonder selectie worden alle acht leden ingedeeld (twee banen)'
);

select is(
  (select count(distinct p)::int
   from (
     select unnest(array[t.player1_id, t.player2_id]) as p
     from public.matches m
     join public.teams t on t.id in (m.team_a_id, m.team_b_id)
     where m.group_id = 'd0000000-0000-0000-0000-0000000000f0'
       and m.round_number = 2
   ) x
   where p is not null),
  8, 'alle acht leden staan in ronde 2'
);

------------------------------------------------------------------------
-- 4. Een geannuleerde match blokkeert niet, een geplande wél.
------------------------------------------------------------------------
update public.matches
   set status = 'cancelled'
 where group_id = 'd0000000-0000-0000-0000-0000000000f0'
   and round_number = 2;

select is(
  (select count(*)::int from public.generate_mexicano_round(
     'd0000000-0000-0000-0000-0000000000f0', null,
     array['d0000000-0000-0000-0000-000000000001',
           'd0000000-0000-0000-0000-000000000002',
           'd0000000-0000-0000-0000-000000000003',
           'd0000000-0000-0000-0000-000000000004']::uuid[])),
  1, 'een geannuleerde match houdt de volgende ronde niet tegen'
);

-- En de blokkade zelf werkt nog: ronde 3 staat nu open.
select throws_ok(
  $$select public.generate_mexicano_round('d0000000-0000-0000-0000-0000000000f0')$$,
  'Vul eerst alle uitslagen van de vorige ronde in voordat je een nieuwe Mexicano-ronde genereert.',
  'een openstaande geplande ronde blokkeert wél'
);

select * from finish();

rollback;
