-- pgTAP-tests voor de bounty op de leider (#805) — die sinds #1168 UIT staat.
-- Deze suite bewijst dat er nergens meer Elo verschuift: niet bij de kroon van
-- een groep, niet bij de troon, niet bij singles, en dat er ook niemand meer
-- als drager wordt aangekondigd.
--
-- De opzet is bewust die van vóór het uitzetten gebleven — dezelfde spelers,
-- dezelfde scenario's — zodat je bij het weer aanzetten (bounty_value terug op
-- 8 plus een recompute) alleen de verwachte waarden hoeft terug te draaien en
-- meteen ziet dat élk pad nog gedekt is.
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

select plan(28);

------------------------------------------------------------------------
-- 0. De pool is nul, ongeacht de zegereeks. Dit is het enige punt waar het
--    uitzetten zit; al het andere volgt hieruit.
------------------------------------------------------------------------
select is(public.bounty_value(0), 0, 'zonder reeks is er geen bounty');
select is(public.bounty_value(1), 0, 'één zege levert geen bounty op');
select is(public.bounty_value(5), 0, 'vijf zeges leveren geen bounty op');
select is(public.bounty_value(6), 0, 'zes zeges leveren geen bounty op');
select is(public.bounty_value(9), 0, 'een lange reeks levert geen bounty op');
select is(public.bounty_value(-3), 0, 'een negatieve reeks levert geen bounty op');
select is(public.bounty_value(null), 0, 'zonder bekende reeks is er ook geen bounty');

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
-- 1. De kroondrager van de groep verliest zijn eerste match. Vroeger kostte
--    hem dat 8 Elo; nu verschuift er niets.
------------------------------------------------------------------------
insert into public.matches (id, team_a_id, team_b_id, group_id, status, winner_team_id, played_at)
values ('bb000000-0000-0000-0000-000000000201',
        'bb000000-0000-0000-0000-000000000101','bb000000-0000-0000-0000-000000000102',
        'bb000000-0000-0000-0000-000000000f01',
        'completed','bb000000-0000-0000-0000-000000000102', now() + interval '1 day');

select is((select bounty_delta from public.rating_history
    where match_id = 'bb000000-0000-0000-0000-000000000201'
      and player_id = 'bb000000-0000-0000-0000-000000000a01'),
  0, 'de verslagen kroondrager betaalt niets meer');
select is((select count(*)::int from public.rating_history
    where match_id = 'bb000000-0000-0000-0000-000000000201' and bounty_delta <> 0),
  0, 'de winnaars krijgen niets uitgekeerd');
select is((select sum(bounty_delta)::int from public.rating_history
    where match_id = 'bb000000-0000-0000-0000-000000000201'),
  0, 'de boekhouding blijft sluiten: nul in, nul uit');

------------------------------------------------------------------------
-- 2. Een zegereeks van de drager verandert daar niets aan.
------------------------------------------------------------------------
insert into public.matches (id, team_a_id, team_b_id, group_id, status, winner_team_id, played_at)
values ('bb000000-0000-0000-0000-000000000202',
        'bb000000-0000-0000-0000-000000000101','bb000000-0000-0000-0000-000000000102',
        'bb000000-0000-0000-0000-000000000f01',
        'completed','bb000000-0000-0000-0000-000000000101', now() + interval '2 days');

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

select is((select count(*)::int from public.rating_history
    where match_id = 'bb000000-0000-0000-0000-000000000204' and bounty_delta <> 0),
  0, 'ook na twee zeges levert de nederlaag van de drager niets op');

------------------------------------------------------------------------
-- 3. Lange reeks: zes zeges op rij en dan verlies — nog steeds niets.
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

select is((select count(*)::int from public.rating_history
    where match_id = 'bb000000-0000-0000-0000-000000000220' and bounty_delta <> 0),
  0, 'zes zeges maken de nederlaag niet duurder');

------------------------------------------------------------------------
-- 4. Gelijkspel. De reekstelling zelf blijft gewoon werken — hij bepaalt
--    alleen niets meer.
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
-- 5. De troon (1600+) betaalt evenmin, ook niet buiten een groep of in een
--    singles-match waar de hele pot naar één winnaar zou gaan.
------------------------------------------------------------------------
insert into public.matches (id, team_a_id, team_b_id, status, winner_team_id, played_at)
values ('bb000000-0000-0000-0000-000000000301',
        'bb000000-0000-0000-0000-000000000111','bb000000-0000-0000-0000-000000000112',
        'completed','bb000000-0000-0000-0000-000000000112', now() + interval '13 days');

select is((select bounty_delta from public.rating_history
    where match_id = 'bb000000-0000-0000-0000-000000000301'
      and player_id = 'bb000000-0000-0000-0000-000000000d01'),
  0, 'de dictator betaalt niets meer in een match zonder groep');
select is((select sum(bounty_delta)::int from public.rating_history
    where match_id = 'bb000000-0000-0000-0000-000000000301'),
  0, 'er komt ook geen Elo bij');

insert into public.matches (id, team_a_id, team_b_id, status, winner_team_id, played_at, format)
values ('bb000000-0000-0000-0000-000000000302',
        'bb000000-0000-0000-0000-000000000151','bb000000-0000-0000-0000-000000000152',
        'completed','bb000000-0000-0000-0000-000000000152', now() + interval '14 days', '1v1');

select is((select bounty_delta from public.rating_history
    where match_id = 'bb000000-0000-0000-0000-000000000302'
      and player_id = 'bb000000-0000-0000-0000-000000000d03'),
  0, 'ook bij singles valt er niets te claimen');

------------------------------------------------------------------------
-- 6. De regels over wie drager zou zijn (gast, dunne rating) blijven staan,
--    maar ze leiden nergens meer toe.
------------------------------------------------------------------------
insert into public.matches (id, team_a_id, team_b_id, group_id, status, winner_team_id, played_at)
values ('bb000000-0000-0000-0000-000000000401',
        'bb000000-0000-0000-0000-000000000121','bb000000-0000-0000-0000-000000000122',
        'bb000000-0000-0000-0000-000000000f02',
        'completed','bb000000-0000-0000-0000-000000000122', now() + interval '15 days');

select is((select bounty_delta from public.rating_history
    where match_id = 'bb000000-0000-0000-0000-000000000401'
      and player_id = 'bb000000-0000-0000-0000-000000000e01'),
  0, 'de gast draagt nog steeds geen kroon');
select is((select bounty_delta from public.rating_history
    where match_id = 'bb000000-0000-0000-0000-000000000401'
      and player_id = 'bb000000-0000-0000-0000-000000000e02'),
  0, 'en de hoogste níet-gast betaalt er niet meer voor');

insert into public.matches (id, team_a_id, team_b_id, group_id, status, winner_team_id, played_at)
values ('bb000000-0000-0000-0000-000000000501',
        'bb000000-0000-0000-0000-000000000131','bb000000-0000-0000-0000-000000000132',
        'bb000000-0000-0000-0000-000000000f03',
        'completed','bb000000-0000-0000-0000-000000000132', now() + interval '16 days');

select is((select count(*)::int from public.rating_history
    where match_id = 'bb000000-0000-0000-0000-000000000501' and bounty_delta <> 0),
  0, 'een rating uit minder dan drie matches draagt nog steeds geen bounty');

------------------------------------------------------------------------
-- 7. _bounty_deltas rechtstreeks. De invoeringsdatum staat er nog (weer
--    aanzetten moet dezelfde grens houden), en waar de functie wél rijen
--    oplevert, staat er nul in.
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
  0, 'een match van vóór de invoering levert nog altijd geen enkele rij op');
select is((select count(*)::int from public._bounty_deltas('bb000000-0000-0000-0000-000000000702')
    where bounty <> 0),
  0, 'ná de invoering staat er in elke rij nul');
select is((select coalesce(sum(bounty), 0)::int from public._bounty_deltas('bb000000-0000-0000-0000-000000000702')),
  0, 'en de rijen tellen op tot nul');

------------------------------------------------------------------------
-- 8. Wat de spelers vooraf zien: niets. Dit is het scharnier voor de UI — het
--    klassement, de groepsstand, de matchkaart en de feed lezen allemaal uit
--    deze view, dus ze zwijgen hier samen.
------------------------------------------------------------------------
select is_empty(
  $$ select 1 from public.active_bounties $$,
  'active_bounties kondigt geen enkele drager meer aan');
select is(
  (select count(*)::int from public.active_bounties
    where player_id = 'bb000000-0000-0000-0000-000000000d01'),
  0, 'ook een speler ver boven de troondrempel staat er niet meer in');

------------------------------------------------------------------------
-- 9. Drift-test: een stand die volledig uit matches is opgebouwd, moet na een
--    volledige recompute exact hetzelfde opleveren als het incrementele pad.
--    Dit is de reden dat er geen bounty_pools-tabel is — en tegelijk het
--    bewijs dat de uit-stand net zo deterministisch is als de aan-stand.
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

create temp table replay_snap as
  select player_id, match_id, delta, bounty_delta, rating_before, rating_after
  from public.rating_history
  where match_id in (
    'bb000000-0000-0000-0000-000000000601','bb000000-0000-0000-0000-000000000602',
    'bb000000-0000-0000-0000-000000000603','bb000000-0000-0000-0000-000000000610'
  );

select is((select count(*)::int from replay_snap),
  16, 'de drift-test vergelijkt alle zestien history-rijen van de replaygroep');
select is((select count(*)::int from replay_snap where bounty_delta <> 0),
  0, 'geen van die rijen draagt nog een bounty-verschuiving');

select public.recompute_ratings();

select is(
  (select count(*)::int from replay_snap s
     join public.rating_history h
       on h.player_id = s.player_id and h.match_id = s.match_id
    where (h.delta, h.bounty_delta, h.rating_before, h.rating_after)
          is distinct from (s.delta, s.bounty_delta, s.rating_before, s.rating_after)),
  0, 'een volledige recompute geeft exact dezelfde uitkomst als het incrementele pad');

select * from finish();

rollback;
