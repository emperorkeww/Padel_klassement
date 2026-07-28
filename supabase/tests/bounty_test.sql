-- pgTAP-tests voor de bounty op de leider (#805): wie draagt er een prijs op
-- z'n hoofd, hoeveel is die waard, en klopt de boekhouding?
--
-- De assertions kijken naar rating_history.bounty_delta — dat is wat er
-- werkelijk op de rating is toegepast, niet wat een losse functieaanroep
-- achteraf zou zeggen (_bounty_deltas leest player_ratings, en die staat na
-- afloop van een match al op de ná-stand).
--
-- Elke sectie heeft z'n eigen spelers en groep, zodat de zegereeksen (globaal
-- per speler) en de kroon (per groep) elkaar niet beïnvloeden. De drift-test
-- staat bewust achteraan: recompute_ratings() herbouwt álle ratings uit de
-- matches en gooit de rechtstreeks gezette beginstanden van de andere secties
-- dus weg.
begin;

select plan(37);

------------------------------------------------------------------------
-- 0. De pool-formule zelf: basis 15, +3 per zege, afgetopt op 30.
------------------------------------------------------------------------
select is(public.bounty_value(0), 15, 'zonder reeks is de bounty de basiswaarde 15');
select is(public.bounty_value(1), 18, 'elke opeenvolgende zege legt er 3 bij');
select is(public.bounty_value(5), 30, 'vijf zeges brengt de pool precies op het plafond');
select is(public.bounty_value(9), 30, 'daarboven blijft de pool op 30 staan');
select is(public.bounty_value(null), 15, 'geen reeks bekend telt als geen zeges');

------------------------------------------------------------------------
-- Fixtures. Profielen mogen rechtstreeks (handle_new_user is er alleen voor
-- echte accounts); één account volstaat als created_by voor de groepen.
------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
values
  ('00000000-0000-0000-0000-000000000000','bb000000-0000-0000-0000-000000000a01','authenticated','authenticated','bb1@test.nl','x',now(),'{}','{"username":"bb_a1"}',now(),now(),'','','','');

insert into public.profiles (id, username, full_name, is_guest, owner_id) values
  ('bb000000-0000-0000-0000-000000000a02','bb_a2','A2', false, null),
  ('bb000000-0000-0000-0000-000000000a03','bb_a3','A3', false, null),
  ('bb000000-0000-0000-0000-000000000a04','bb_a4','A4', false, null),
  ('bb000000-0000-0000-0000-000000000d01','bb_d1','D1', false, null),
  ('bb000000-0000-0000-0000-000000000d02','bb_d2','D2', false, null),
  ('bb000000-0000-0000-0000-000000000d03','bb_d3','D3', false, null),
  ('bb000000-0000-0000-0000-000000000d04','bb_d4','D4', false, null),
  -- e01 is een gast van a1: hoogste rating van de groep, maar draagt geen kroon.
  ('bb000000-0000-0000-0000-000000000e01','bb_gast','Gast', true,
   'bb000000-0000-0000-0000-000000000a01'),
  ('bb000000-0000-0000-0000-000000000e02','bb_e2','E2', false, null),
  ('bb000000-0000-0000-0000-000000000e03','bb_e3','E3', false, null),
  ('bb000000-0000-0000-0000-000000000e04','bb_e4','E4', false, null),
  ('bb000000-0000-0000-0000-000000000b01','bb_b1','B1', false, null),
  ('bb000000-0000-0000-0000-000000000b02','bb_b2','B2', false, null),
  ('bb000000-0000-0000-0000-000000000b03','bb_b3','B3', false, null),
  ('bb000000-0000-0000-0000-000000000b04','bb_b4','B4', false, null),
  ('bb000000-0000-0000-0000-000000000c01','bb_c1','C1', false, null),
  ('bb000000-0000-0000-0000-000000000c02','bb_c2','C2', false, null),
  ('bb000000-0000-0000-0000-000000000c03','bb_c3','C3', false, null),
  ('bb000000-0000-0000-0000-000000000c04','bb_c4','C4', false, null);

-- Elke groep krijgt een maker uit z'n eigen sectie: on_group_created maakt de
-- maker automatisch lid, en een vreemde eend zou de kroon van die groep kunnen
-- opeisen.
insert into public.groups (id, name, created_by) values
  ('bb000000-0000-0000-0000-000000000f01','Kroongroep','bb000000-0000-0000-0000-000000000a01'),
  ('bb000000-0000-0000-0000-000000000f02','Gastgroep','bb000000-0000-0000-0000-000000000e02'),
  ('bb000000-0000-0000-0000-000000000f03','Dunne groep','bb000000-0000-0000-0000-000000000b01'),
  ('bb000000-0000-0000-0000-000000000f04','Replaygroep','bb000000-0000-0000-0000-000000000c01');

-- on conflict: de maker is hierboven al als owner toegevoegd.
insert into public.group_members (group_id, player_id) values
  ('bb000000-0000-0000-0000-000000000f01','bb000000-0000-0000-0000-000000000a01'),
  ('bb000000-0000-0000-0000-000000000f01','bb000000-0000-0000-0000-000000000a02'),
  ('bb000000-0000-0000-0000-000000000f01','bb000000-0000-0000-0000-000000000a03'),
  ('bb000000-0000-0000-0000-000000000f01','bb000000-0000-0000-0000-000000000a04'),
  ('bb000000-0000-0000-0000-000000000f02','bb000000-0000-0000-0000-000000000e01'),
  ('bb000000-0000-0000-0000-000000000f02','bb000000-0000-0000-0000-000000000e02'),
  ('bb000000-0000-0000-0000-000000000f02','bb000000-0000-0000-0000-000000000e03'),
  ('bb000000-0000-0000-0000-000000000f02','bb000000-0000-0000-0000-000000000e04'),
  ('bb000000-0000-0000-0000-000000000f03','bb000000-0000-0000-0000-000000000b01'),
  ('bb000000-0000-0000-0000-000000000f03','bb000000-0000-0000-0000-000000000b02'),
  ('bb000000-0000-0000-0000-000000000f03','bb000000-0000-0000-0000-000000000b03'),
  ('bb000000-0000-0000-0000-000000000f03','bb000000-0000-0000-0000-000000000b04'),
  ('bb000000-0000-0000-0000-000000000f04','bb000000-0000-0000-0000-000000000c01'),
  ('bb000000-0000-0000-0000-000000000f04','bb000000-0000-0000-0000-000000000c02'),
  ('bb000000-0000-0000-0000-000000000f04','bb000000-0000-0000-0000-000000000c03'),
  ('bb000000-0000-0000-0000-000000000f04','bb000000-0000-0000-0000-000000000c04')
on conflict do nothing;

insert into public.teams (id, player1_id, player2_id) values
  ('bb000000-0000-0000-0000-000000000101','bb000000-0000-0000-0000-000000000a01','bb000000-0000-0000-0000-000000000a02'),
  ('bb000000-0000-0000-0000-000000000102','bb000000-0000-0000-0000-000000000a03','bb000000-0000-0000-0000-000000000a04'),
  ('bb000000-0000-0000-0000-000000000111','bb000000-0000-0000-0000-000000000d01','bb000000-0000-0000-0000-000000000d02'),
  ('bb000000-0000-0000-0000-000000000112','bb000000-0000-0000-0000-000000000d03','bb000000-0000-0000-0000-000000000d04'),
  ('bb000000-0000-0000-0000-000000000121','bb000000-0000-0000-0000-000000000e01','bb000000-0000-0000-0000-000000000e02'),
  ('bb000000-0000-0000-0000-000000000122','bb000000-0000-0000-0000-000000000e03','bb000000-0000-0000-0000-000000000e04'),
  ('bb000000-0000-0000-0000-000000000131','bb000000-0000-0000-0000-000000000b01','bb000000-0000-0000-0000-000000000b02'),
  ('bb000000-0000-0000-0000-000000000132','bb000000-0000-0000-0000-000000000b03','bb000000-0000-0000-0000-000000000b04'),
  ('bb000000-0000-0000-0000-000000000141','bb000000-0000-0000-0000-000000000c01','bb000000-0000-0000-0000-000000000c02'),
  ('bb000000-0000-0000-0000-000000000142','bb000000-0000-0000-0000-000000000c03','bb000000-0000-0000-0000-000000000c04'),
  -- singles: d1 alleen tegen d3 alleen.
  ('bb000000-0000-0000-0000-000000000151','bb000000-0000-0000-0000-000000000d01', null),
  ('bb000000-0000-0000-0000-000000000152','bb000000-0000-0000-0000-000000000d03', null);

-- Beginstand. Rechtstreeks gezet zodat de scenario's exact voorspelbaar zijn;
-- de drift-test (sectie 9) bouwt z'n stand wél volledig uit matches op.
insert into public.player_ratings (player_id, rating, games) values
  ('bb000000-0000-0000-0000-000000000a01', 1300, 10),  -- kroondrager groep f01
  ('bb000000-0000-0000-0000-000000000a02', 1100, 10),
  ('bb000000-0000-0000-0000-000000000a03', 1000, 10),
  ('bb000000-0000-0000-0000-000000000a04', 1000, 10),
  -- Ruim boven de drempel, zodat d1 ook na twee nederlagen dictator blijft.
  ('bb000000-0000-0000-0000-000000000d01', 1750, 10),
  ('bb000000-0000-0000-0000-000000000d02', 1000, 10),
  ('bb000000-0000-0000-0000-000000000d03', 1000, 10),
  ('bb000000-0000-0000-0000-000000000d04', 1000, 10),
  ('bb000000-0000-0000-0000-000000000e01', 1500, 10),  -- gast: hoogst, maar geen kroon
  ('bb000000-0000-0000-0000-000000000e02', 1200, 10),  -- hoogste níet-gast
  ('bb000000-0000-0000-0000-000000000e03', 1000, 10),
  ('bb000000-0000-0000-0000-000000000e04', 1000, 10),
  ('bb000000-0000-0000-0000-000000000b01', 1300, 2),   -- te weinig matches
  ('bb000000-0000-0000-0000-000000000b02', 1100, 2),
  ('bb000000-0000-0000-0000-000000000b03', 1000, 2),
  ('bb000000-0000-0000-0000-000000000b04', 1000, 2);

-- Alle matches hieronder liggen ná de laatste bestaande afgeronde match én ná
-- de invoeringsdatum van de bounty, zodat het incrementele pad wordt gevolgd.

------------------------------------------------------------------------
-- 1. Basispool: de kroondrager van de groep verliest zijn eerste match.
--    Pool 15, oneven verdeeld: speler 1 van het winnende team krijgt 8.
------------------------------------------------------------------------
insert into public.matches (id, team_a_id, team_b_id, group_id, status, winner_team_id, played_at)
values ('bb000000-0000-0000-0000-000000000201',
        'bb000000-0000-0000-0000-000000000101','bb000000-0000-0000-0000-000000000102',
        'bb000000-0000-0000-0000-000000000f01',
        'completed','bb000000-0000-0000-0000-000000000102', now() + interval '1 day');

select is((select bounty_delta from public.rating_history
    where match_id = 'bb000000-0000-0000-0000-000000000201'
      and player_id = 'bb000000-0000-0000-0000-000000000a01'),
  -15, 'de verslagen kroondrager betaalt de basispool van 15');
select is((select bounty_delta from public.rating_history
    where match_id = 'bb000000-0000-0000-0000-000000000201'
      and player_id = 'bb000000-0000-0000-0000-000000000a03'),
  8, 'speler 1 van het winnende team krijgt de helft, naar boven afgerond');
select is((select bounty_delta from public.rating_history
    where match_id = 'bb000000-0000-0000-0000-000000000201'
      and player_id = 'bb000000-0000-0000-0000-000000000a04'),
  7, 'speler 2 van het winnende team krijgt de andere helft');
select is((select bounty_delta from public.rating_history
    where match_id = 'bb000000-0000-0000-0000-000000000201'
      and player_id = 'bb000000-0000-0000-0000-000000000a02'),
  0, 'de partner van de drager betaalt niets mee');
select is((select sum(bounty_delta)::int from public.rating_history
    where match_id = 'bb000000-0000-0000-0000-000000000201'),
  0, 'de bounty is zero-sum: er wordt geen Elo bijgemaakt');

------------------------------------------------------------------------
-- 2. Reeks: de drager wint twee keer, dan verliest hij. 15 + 2 × 3 = 21.
------------------------------------------------------------------------
insert into public.matches (id, team_a_id, team_b_id, group_id, status, winner_team_id, played_at)
values ('bb000000-0000-0000-0000-000000000202',
        'bb000000-0000-0000-0000-000000000101','bb000000-0000-0000-0000-000000000102',
        'bb000000-0000-0000-0000-000000000f01',
        'completed','bb000000-0000-0000-0000-000000000101', now() + interval '2 days');

select is((select count(*)::int from public.rating_history
    where match_id = 'bb000000-0000-0000-0000-000000000202' and bounty_delta <> 0),
  0, 'wint de drager, dan wordt er niets uitgekeerd');

insert into public.matches (id, team_a_id, team_b_id, group_id, status, winner_team_id, played_at)
values ('bb000000-0000-0000-0000-000000000203',
        'bb000000-0000-0000-0000-000000000101','bb000000-0000-0000-0000-000000000102',
        'bb000000-0000-0000-0000-000000000f01',
        'completed','bb000000-0000-0000-0000-000000000101', now() + interval '3 days');

insert into public.matches (id, team_a_id, team_b_id, group_id, status, winner_team_id, played_at)
values ('bb000000-0000-0000-0000-000000000204',
        'bb000000-0000-0000-0000-000000000101','bb000000-0000-0000-0000-000000000102',
        'bb000000-0000-0000-0000-000000000f01',
        'completed','bb000000-0000-0000-0000-000000000102', now() + interval '4 days');

select is((select bounty_delta from public.rating_history
    where match_id = 'bb000000-0000-0000-0000-000000000204'
      and player_id = 'bb000000-0000-0000-0000-000000000a01'),
  -21, 'twee opeenvolgende zeges brengen de pool op 21');
select is((select bounty_delta from public.rating_history
    where match_id = 'bb000000-0000-0000-0000-000000000204'
      and player_id = 'bb000000-0000-0000-0000-000000000a03'),
  11, 'de winnaars delen ook een oneven pool exact');
select is((select sum(bounty_delta)::int from public.rating_history
    where match_id = 'bb000000-0000-0000-0000-000000000204'),
  0, 'ook een opgebouwde pool blijft zero-sum');

------------------------------------------------------------------------
-- 3. Plafond: zes zeges zouden 33 opleveren, maar de pool stopt op 30.
------------------------------------------------------------------------
insert into public.matches (id, team_a_id, team_b_id, group_id, status, winner_team_id, played_at)
select ('bb000000-0000-0000-0000-00000000021' || i)::uuid,
       'bb000000-0000-0000-0000-000000000101','bb000000-0000-0000-0000-000000000102',
       'bb000000-0000-0000-0000-000000000f01',
       'completed','bb000000-0000-0000-0000-000000000101',
       now() + (4 + i) * interval '1 day'
from generate_series(1, 6) i;

insert into public.matches (id, team_a_id, team_b_id, group_id, status, winner_team_id, played_at)
values ('bb000000-0000-0000-0000-000000000220',
        'bb000000-0000-0000-0000-000000000101','bb000000-0000-0000-0000-000000000102',
        'bb000000-0000-0000-0000-000000000f01',
        'completed','bb000000-0000-0000-0000-000000000102', now() + interval '11 days');

select is((select bounty_delta from public.rating_history
    where match_id = 'bb000000-0000-0000-0000-000000000220'
      and player_id = 'bb000000-0000-0000-0000-000000000a01'),
  -30, 'zes zeges lopen tegen het plafond van 30 aan');
select is((select bounty_delta from public.rating_history
    where match_id = 'bb000000-0000-0000-0000-000000000220'
      and player_id = 'bb000000-0000-0000-0000-000000000a03'),
  15, 'een even pool wordt gelijk verdeeld');
select is((select bounty_delta from public.rating_history
    where match_id = 'bb000000-0000-0000-0000-000000000220'
      and player_id = 'bb000000-0000-0000-0000-000000000a04'),
  15, 'beide winnaars krijgen evenveel');

------------------------------------------------------------------------
-- 4. Gelijkspel keert niets uit en breekt de reeks.
------------------------------------------------------------------------
insert into public.matches (id, team_a_id, team_b_id, group_id, status, winner_team_id, played_at)
values ('bb000000-0000-0000-0000-000000000221',
        'bb000000-0000-0000-0000-000000000101','bb000000-0000-0000-0000-000000000102',
        'bb000000-0000-0000-0000-000000000f01',
        'completed', null, now() + interval '12 days');

select is((select count(*)::int from public.rating_history
    where match_id = 'bb000000-0000-0000-0000-000000000221' and bounty_delta <> 0),
  0, 'een gelijkspel keert geen bounty uit');
select is(public.bounty_streak('bb000000-0000-0000-0000-000000000a03'),
  0, 'een gelijkspel breekt de zegereeks');

------------------------------------------------------------------------
-- 5. Dictator (1600+) draagt zijn bounty ook buiten een groep; een speler
--    zonder kroon en zonder troon draagt niets.
------------------------------------------------------------------------
insert into public.matches (id, team_a_id, team_b_id, status, winner_team_id, played_at)
values ('bb000000-0000-0000-0000-000000000301',
        'bb000000-0000-0000-0000-000000000111','bb000000-0000-0000-0000-000000000112',
        'completed','bb000000-0000-0000-0000-000000000112', now() + interval '13 days');

select is((select bounty_delta from public.rating_history
    where match_id = 'bb000000-0000-0000-0000-000000000301'
      and player_id = 'bb000000-0000-0000-0000-000000000d01'),
  -15, 'de dictator betaalt ook in een match zonder groep');
select is((select bounty_delta from public.rating_history
    where match_id = 'bb000000-0000-0000-0000-000000000301'
      and player_id = 'bb000000-0000-0000-0000-000000000d02'),
  0, 'zonder groep en zonder troon draagt niemand anders een bounty');
select is((select sum(bounty_delta)::int from public.rating_history
    where match_id = 'bb000000-0000-0000-0000-000000000301'),
  0, 'ook de troon-bounty is zero-sum');

-- Singles: de enige winnaar krijgt de hele pot.
insert into public.matches (id, team_a_id, team_b_id, status, winner_team_id, played_at, format)
values ('bb000000-0000-0000-0000-000000000302',
        'bb000000-0000-0000-0000-000000000151','bb000000-0000-0000-0000-000000000152',
        'completed','bb000000-0000-0000-0000-000000000152', now() + interval '14 days', '1v1');

select is((select bounty_delta from public.rating_history
    where match_id = 'bb000000-0000-0000-0000-000000000302'
      and player_id = 'bb000000-0000-0000-0000-000000000d03'),
  15, 'bij singles gaat de hele pot naar de ene winnaar');
select is((select bounty_delta from public.rating_history
    where match_id = 'bb000000-0000-0000-0000-000000000302'
      and player_id = 'bb000000-0000-0000-0000-000000000d01'),
  -15, 'de dictator betaalt ook in een singles-match');

------------------------------------------------------------------------
-- 6. Gasten dragen geen kroon; de hoogste níet-gast van de groep wel.
--    En een te dunne rating (< 3 matches) draagt er ook geen.
------------------------------------------------------------------------
insert into public.matches (id, team_a_id, team_b_id, group_id, status, winner_team_id, played_at)
values ('bb000000-0000-0000-0000-000000000401',
        'bb000000-0000-0000-0000-000000000121','bb000000-0000-0000-0000-000000000122',
        'bb000000-0000-0000-0000-000000000f02',
        'completed','bb000000-0000-0000-0000-000000000122', now() + interval '15 days');

select is((select bounty_delta from public.rating_history
    where match_id = 'bb000000-0000-0000-0000-000000000401'
      and player_id = 'bb000000-0000-0000-0000-000000000e01'),
  0, 'de gast draagt geen kroon, ook al is hij de hoogst gerate van de groep');
select is((select bounty_delta from public.rating_history
    where match_id = 'bb000000-0000-0000-0000-000000000401'
      and player_id = 'bb000000-0000-0000-0000-000000000e02'),
  -15, 'de hoogste níet-gast draagt de kroon en betaalt');

insert into public.matches (id, team_a_id, team_b_id, group_id, status, winner_team_id, played_at)
values ('bb000000-0000-0000-0000-000000000501',
        'bb000000-0000-0000-0000-000000000131','bb000000-0000-0000-0000-000000000132',
        'bb000000-0000-0000-0000-000000000f03',
        'completed','bb000000-0000-0000-0000-000000000132', now() + interval '16 days');

select is((select count(*)::int from public.rating_history
    where match_id = 'bb000000-0000-0000-0000-000000000501' and bounty_delta <> 0),
  0, 'een rating uit minder dan drie matches draagt nog geen bounty');

------------------------------------------------------------------------
-- 7. Invoeringsdatum: matches van vóór 2026-07-29 blijven onaangeroerd, zodat
--    een recompute de historie niet met terugwerkende kracht herschrijft.
--    Rechtstreeks op _bounty_deltas, want deze matches worden nooit afgerond.
------------------------------------------------------------------------
insert into public.matches (id, team_a_id, team_b_id, group_id, status, winner_team_id, played_at)
values ('bb000000-0000-0000-0000-000000000701',
        'bb000000-0000-0000-0000-000000000101','bb000000-0000-0000-0000-000000000102',
        'bb000000-0000-0000-0000-000000000f01',
        'scheduled','bb000000-0000-0000-0000-000000000102', '2026-01-01 12:00:00+01'),
       ('bb000000-0000-0000-0000-000000000702',
        'bb000000-0000-0000-0000-000000000101','bb000000-0000-0000-0000-000000000102',
        'bb000000-0000-0000-0000-000000000f01',
        'scheduled','bb000000-0000-0000-0000-000000000102', '2026-12-01 12:00:00+01');

select is((select count(*)::int from public._bounty_deltas('bb000000-0000-0000-0000-000000000701')),
  0, 'een match van vóór de invoering levert geen enkele bounty-rij op');
select cmp_ok((select count(*)::int from public._bounty_deltas('bb000000-0000-0000-0000-000000000702')),
  '>', 0, 'dezelfde match ná de invoering levert die wél op');
select is((select coalesce(sum(bounty), 0)::int from public._bounty_deltas('bb000000-0000-0000-0000-000000000702')),
  0, 'de uitgekeerde rijen tellen op tot nul');

------------------------------------------------------------------------
-- 8. Wat de spelers vooraf zien (active_bounties) klopt met de regels.
------------------------------------------------------------------------
select is_empty(
  $$ select 1 from public.active_bounties b
     where b.pool <> public.bounty_value(public.bounty_streak(b.player_id)) $$,
  'de getoonde pool volgt overal de zegereeks van de drager');
select is(
  (select reden from public.active_bounties
    where player_id = 'bb000000-0000-0000-0000-000000000d01' and group_id is null),
  'dictator', 'een speler van 1600+ staat als dictator in active_bounties');
select is(
  (select count(*)::int from public.active_bounties
    where player_id = 'bb000000-0000-0000-0000-000000000e01'),
  0, 'een gast verschijnt nooit als bounty-drager');

------------------------------------------------------------------------
-- 9. Drift-test: een stand die volledig uit matches is opgebouwd, moet na een
--    volledige recompute exact dezelfde bounty's opleveren als het
--    incrementele pad. Dit is de reden dat er geen bounty_pools-tabel is.
------------------------------------------------------------------------
insert into public.matches (id, team_a_id, team_b_id, group_id, status, winner_team_id, played_at)
select ('bb000000-0000-0000-0000-00000000060' || i)::uuid,
       'bb000000-0000-0000-0000-000000000141','bb000000-0000-0000-0000-000000000142',
       'bb000000-0000-0000-0000-000000000f04',
       'completed','bb000000-0000-0000-0000-000000000141',
       now() + (16 + i) * interval '1 day'
from generate_series(1, 3) i;

insert into public.matches (id, team_a_id, team_b_id, group_id, status, winner_team_id, played_at)
values ('bb000000-0000-0000-0000-000000000610',
        'bb000000-0000-0000-0000-000000000141','bb000000-0000-0000-0000-000000000142',
        'bb000000-0000-0000-0000-000000000f04',
        'completed','bb000000-0000-0000-0000-000000000142', now() + interval '20 days');

-- c1 en c2 staan na drie zeges exact gelijk; de kroon gaat dan naar het langst
-- aangesloten lid en bij gelijke aanmaaktijd naar de laagste id — c1 dus.
select is((select bounty_delta from public.rating_history
    where match_id = 'bb000000-0000-0000-0000-000000000610'
      and player_id = 'bb000000-0000-0000-0000-000000000c01'),
  -24, 'bij een gelijke stand draagt het langst aangesloten lid de kroon (3 zeges → 24)');
select is((select bounty_delta from public.rating_history
    where match_id = 'bb000000-0000-0000-0000-000000000610'
      and player_id = 'bb000000-0000-0000-0000-000000000c02'),
  0, 'de gelijk gerate partner draagt hem niet');

create temp table replay_snap as
  select player_id, match_id, delta, bounty_delta, rating_before, rating_after
  from public.rating_history
  where match_id in (
    'bb000000-0000-0000-0000-000000000601','bb000000-0000-0000-0000-000000000602',
    'bb000000-0000-0000-0000-000000000603','bb000000-0000-0000-0000-000000000610'
  );

select is((select count(*)::int from replay_snap),
  16, 'de drift-test vergelijkt alle zestien history-rijen van de replaygroep');

select public.recompute_ratings();

select is(
  (select count(*)::int from replay_snap s
     join public.rating_history h
       on h.player_id = s.player_id and h.match_id = s.match_id
    where (h.delta, h.bounty_delta, h.rating_before, h.rating_after)
          is distinct from (s.delta, s.bounty_delta, s.rating_before, s.rating_after)),
  0, 'een volledige recompute geeft exact dezelfde bounty-uitkomst als het incrementele pad');

select * from finish();

rollback;