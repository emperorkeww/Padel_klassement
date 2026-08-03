-- pgTAP-tests voor de Pechvogel-meter (#1005): wanneer loopt de meter vol,
-- wanneer keert hij uit, en wat breekt de reeks?
--
-- De assertions kijken naar rating_history.troost_delta — dat is wat er
-- werkelijk op de rating is toegepast, niet wat een losse functieaanroep
-- achteraf zou zeggen (_troost_delta leest de reeks op het moment van de match).
--
-- Elke sectie heeft z'n eigen spelers, zodat de reeksen (globaal per speler)
-- elkaar niet beïnvloeden. Bewust geen groepen en geen ratings boven de
-- dictator-drempel: dan blijft de bounty (#805) overal buiten beeld en meet
-- deze test alleen de demper.
--
-- Op één sectie na (de underdog) krijgt niemand een kunstmatige beginstand:
-- iedereen begint op 1000 en bouwt zijn stand volledig uit matches op. Daardoor
-- is de drift-test achteraan een eerlijke vergelijking — recompute_ratings()
-- gooit rechtstreeks gezette ratings immers weg.
begin;

select plan(30);

------------------------------------------------------------------------
-- 0. Wat telt als "nipt"? Winnaar aanwezig en hooguit 2 punten verschil.
------------------------------------------------------------------------
select is(public._is_nipt(7::smallint, 6::smallint), true,
  '7-6 is nipt (de tiebreak-uitslag)');
select is(public._is_nipt(7::smallint, 5::smallint), true,
  '7-5 is nipt (twee games verschil)');
select is(public._is_nipt(7::smallint, 4::smallint), false,
  '7-4 is geen pech maar gewoon verlies');
select is(public._is_nipt(6::smallint, 6::smallint), false,
  'een gelijkspel is geen nipte nederlaag');
select is(public._is_nipt(null, 6::smallint), false,
  'zonder score valt er niets te meten');
select is(public._is_nipt(6::smallint, null), false,
  'een halve score telt evenmin');

------------------------------------------------------------------------
-- Fixtures. Profielen mogen rechtstreeks (handle_new_user is er alleen voor
-- echte accounts). Geen groepen: deze feature staat er los van.
------------------------------------------------------------------------
insert into public.profiles (id, username, full_name, is_guest, owner_id) values
  -- sectie 1 & 2: de meter loopt vol en keert opnieuw uit
  ('ac000000-0000-0000-0000-000000000a01','pv_a1','A1', false, null),
  ('ac000000-0000-0000-0000-000000000a02','pv_a2','A2', false, null),
  ('ac000000-0000-0000-0000-000000000a03','pv_a3','A3', false, null),
  ('ac000000-0000-0000-0000-000000000a04','pv_a4','A4', false, null),
  -- sectie 3: een afdroging breekt de reeks
  ('ac000000-0000-0000-0000-000000000b01','pv_b1','B1', false, null),
  ('ac000000-0000-0000-0000-000000000b02','pv_b2','B2', false, null),
  ('ac000000-0000-0000-0000-000000000b03','pv_b3','B3', false, null),
  ('ac000000-0000-0000-0000-000000000b04','pv_b4','B4', false, null),
  -- sectie 4: een zege breekt de reeks
  ('ac000000-0000-0000-0000-000000000c01','pv_c1','C1', false, null),
  ('ac000000-0000-0000-0000-000000000c02','pv_c2','C2', false, null),
  ('ac000000-0000-0000-0000-000000000c03','pv_c3','C3', false, null),
  ('ac000000-0000-0000-0000-000000000c04','pv_c4','C4', false, null),
  -- sectie 5: een gelijkspel breekt de reeks
  ('ac000000-0000-0000-0000-000000000d01','pv_d1','D1', false, null),
  ('ac000000-0000-0000-0000-000000000d02','pv_d2','D2', false, null),
  ('ac000000-0000-0000-0000-000000000d03','pv_d3','D3', false, null),
  ('ac000000-0000-0000-0000-000000000d04','pv_d4','D4', false, null),
  -- sectie 6: een minimaal verlies mag niet in winst omslaan
  ('ac000000-0000-0000-0000-000000000e01','pv_e1','E1', false, null),
  ('ac000000-0000-0000-0000-000000000e02','pv_e2','E2', false, null),
  ('ac000000-0000-0000-0000-000000000e03','pv_e3','E3', false, null),
  ('ac000000-0000-0000-0000-000000000e04','pv_e4','E4', false, null),
  -- sectie 7: matches van vóór de invoering
  ('ac000000-0000-0000-0000-000000000f01','pv_f1','F1', false, null),
  ('ac000000-0000-0000-0000-000000000f02','pv_f2','F2', false, null),
  ('ac000000-0000-0000-0000-000000000f03','pv_f3','F3', false, null),
  ('ac000000-0000-0000-0000-000000000f04','pv_f4','F4', false, null);

insert into public.teams (id, player1_id, player2_id) values
  ('ac000000-0000-0000-0000-000000000101','ac000000-0000-0000-0000-000000000a01','ac000000-0000-0000-0000-000000000a02'),
  ('ac000000-0000-0000-0000-000000000102','ac000000-0000-0000-0000-000000000a03','ac000000-0000-0000-0000-000000000a04'),
  ('ac000000-0000-0000-0000-000000000111','ac000000-0000-0000-0000-000000000b01','ac000000-0000-0000-0000-000000000b02'),
  ('ac000000-0000-0000-0000-000000000112','ac000000-0000-0000-0000-000000000b03','ac000000-0000-0000-0000-000000000b04'),
  ('ac000000-0000-0000-0000-000000000121','ac000000-0000-0000-0000-000000000c01','ac000000-0000-0000-0000-000000000c02'),
  ('ac000000-0000-0000-0000-000000000122','ac000000-0000-0000-0000-000000000c03','ac000000-0000-0000-0000-000000000c04'),
  ('ac000000-0000-0000-0000-000000000131','ac000000-0000-0000-0000-000000000d01','ac000000-0000-0000-0000-000000000d02'),
  ('ac000000-0000-0000-0000-000000000132','ac000000-0000-0000-0000-000000000d03','ac000000-0000-0000-0000-000000000d04'),
  ('ac000000-0000-0000-0000-000000000141','ac000000-0000-0000-0000-000000000e01','ac000000-0000-0000-0000-000000000e02'),
  ('ac000000-0000-0000-0000-000000000142','ac000000-0000-0000-0000-000000000e03','ac000000-0000-0000-0000-000000000e04'),
  ('ac000000-0000-0000-0000-000000000151','ac000000-0000-0000-0000-000000000f01','ac000000-0000-0000-0000-000000000f02'),
  ('ac000000-0000-0000-0000-000000000152','ac000000-0000-0000-0000-000000000f03','ac000000-0000-0000-0000-000000000f04');

-- Alleen sectie 6 krijgt een kunstmatige beginstand: een verschil van ruim 550
-- rating maakt de verwachte mutatie van de underdog kleiner dan de demper.
-- Ruim onder de dictator-drempel (1600), zodat de bounty er buiten blijft.
insert into public.player_ratings (player_id, rating, games) values
  ('ac000000-0000-0000-0000-000000000e01', 1000, 10),
  ('ac000000-0000-0000-0000-000000000e02', 1000, 10),
  ('ac000000-0000-0000-0000-000000000e03', 1552, 10),
  ('ac000000-0000-0000-0000-000000000e04', 1552, 10);

-- Alle matches hieronder liggen ná de laatste bestaande afgeronde match én ná
-- de invoeringsdatum van de demper, zodat het incrementele pad wordt gevolgd.
-- Uitzondering: sectie 7, die bewust ver in het verleden ligt.

------------------------------------------------------------------------
-- 1. De meter loopt vol: pas de derde nipte nederlaag op rij wordt gedempt.
------------------------------------------------------------------------
insert into public.matches (id, team_a_id, team_b_id, status, winner_team_id, score_a, score_b, played_at)
values
  ('ac000000-0000-0000-0000-000000000201','ac000000-0000-0000-0000-000000000101','ac000000-0000-0000-0000-000000000102',
   'completed','ac000000-0000-0000-0000-000000000102', 6, 7, now() + interval '10 days');

select is((select troost_delta from public.rating_history
    where match_id = 'ac000000-0000-0000-0000-000000000201'
      and player_id = 'ac000000-0000-0000-0000-000000000a01'),
  0, 'de eerste nipte nederlaag levert nog niets op');

insert into public.matches (id, team_a_id, team_b_id, status, winner_team_id, score_a, score_b, played_at)
values
  ('ac000000-0000-0000-0000-000000000202','ac000000-0000-0000-0000-000000000101','ac000000-0000-0000-0000-000000000102',
   'completed','ac000000-0000-0000-0000-000000000102', 5, 7, now() + interval '11 days');

select is((select troost_delta from public.rating_history
    where match_id = 'ac000000-0000-0000-0000-000000000202'
      and player_id = 'ac000000-0000-0000-0000-000000000a01'),
  0, 'de tweede nipte nederlaag ook niet');

insert into public.matches (id, team_a_id, team_b_id, status, winner_team_id, score_a, score_b, played_at)
values
  ('ac000000-0000-0000-0000-000000000203','ac000000-0000-0000-0000-000000000101','ac000000-0000-0000-0000-000000000102',
   'completed','ac000000-0000-0000-0000-000000000102', 6, 7, now() + interval '12 days');

select is((select troost_delta from public.rating_history
    where match_id = 'ac000000-0000-0000-0000-000000000203'
      and player_id = 'ac000000-0000-0000-0000-000000000a01'),
  4, 'bij de derde is de meter vol en valt de volle demper');
select is((select troost_delta from public.rating_history
    where match_id = 'ac000000-0000-0000-0000-000000000203'
      and player_id = 'ac000000-0000-0000-0000-000000000a02'),
  4, 'de ploegmaat die dezelfde reeks meemaakte krijgt hem ook');
select is((select count(*)::int from public.rating_history
    where match_id = 'ac000000-0000-0000-0000-000000000203'
      and player_id in ('ac000000-0000-0000-0000-000000000a03',
                        'ac000000-0000-0000-0000-000000000a04')
      and troost_delta <> 0),
  0, 'de winnaars worden niet getroost');
select is(public.pech_streak('ac000000-0000-0000-0000-000000000a01'), 3,
  'de meter staat na drie nipte nederlagen op drie');

------------------------------------------------------------------------
-- 2. Eenmalig: pas bij de zesde nipte nederlaag valt er weer een demper.
------------------------------------------------------------------------
insert into public.matches (id, team_a_id, team_b_id, status, winner_team_id, score_a, score_b, played_at)
values
  ('ac000000-0000-0000-0000-000000000204','ac000000-0000-0000-0000-000000000101','ac000000-0000-0000-0000-000000000102',
   'completed','ac000000-0000-0000-0000-000000000102', 6, 7, now() + interval '13 days'),
  ('ac000000-0000-0000-0000-000000000205','ac000000-0000-0000-0000-000000000101','ac000000-0000-0000-0000-000000000102',
   'completed','ac000000-0000-0000-0000-000000000102', 5, 7, now() + interval '14 days');

select is((select troost_delta from public.rating_history
    where match_id = 'ac000000-0000-0000-0000-000000000204'
      and player_id = 'ac000000-0000-0000-0000-000000000a01'),
  0, 'de vierde nederlaag begint een nieuwe meter, dus geen demper');
select is((select troost_delta from public.rating_history
    where match_id = 'ac000000-0000-0000-0000-000000000205'
      and player_id = 'ac000000-0000-0000-0000-000000000a01'),
  0, 'de vijfde evenmin');

insert into public.matches (id, team_a_id, team_b_id, status, winner_team_id, score_a, score_b, played_at)
values
  ('ac000000-0000-0000-0000-000000000206','ac000000-0000-0000-0000-000000000101','ac000000-0000-0000-0000-000000000102',
   'completed','ac000000-0000-0000-0000-000000000102', 6, 7, now() + interval '15 days');

select is((select troost_delta from public.rating_history
    where match_id = 'ac000000-0000-0000-0000-000000000206'
      and player_id = 'ac000000-0000-0000-0000-000000000a01'),
  4, 'bij de zesde is de meter opnieuw vol');
select is(public.pech_streak('ac000000-0000-0000-0000-000000000a01'), 6,
  'de reeks zelf loopt gewoon door, ook na een uitbetaling');

------------------------------------------------------------------------
-- 3. Een afdroging (3+ verschil) breekt de meter.
------------------------------------------------------------------------
insert into public.matches (id, team_a_id, team_b_id, status, winner_team_id, score_a, score_b, played_at)
values
  ('ac000000-0000-0000-0000-000000000301','ac000000-0000-0000-0000-000000000111','ac000000-0000-0000-0000-000000000112',
   'completed','ac000000-0000-0000-0000-000000000112', 6, 7, now() + interval '16 days'),
  ('ac000000-0000-0000-0000-000000000302','ac000000-0000-0000-0000-000000000111','ac000000-0000-0000-0000-000000000112',
   'completed','ac000000-0000-0000-0000-000000000112', 5, 7, now() + interval '17 days'),
  ('ac000000-0000-0000-0000-000000000303','ac000000-0000-0000-0000-000000000111','ac000000-0000-0000-0000-000000000112',
   'completed','ac000000-0000-0000-0000-000000000112', 2, 7, now() + interval '18 days');

select is(public.pech_streak('ac000000-0000-0000-0000-000000000b01'), 0,
  'een afdroging zet de meter op nul');

insert into public.matches (id, team_a_id, team_b_id, status, winner_team_id, score_a, score_b, played_at)
values
  ('ac000000-0000-0000-0000-000000000304','ac000000-0000-0000-0000-000000000111','ac000000-0000-0000-0000-000000000112',
   'completed','ac000000-0000-0000-0000-000000000112', 6, 7, now() + interval '19 days');

select is((select troost_delta from public.rating_history
    where match_id = 'ac000000-0000-0000-0000-000000000304'
      and player_id = 'ac000000-0000-0000-0000-000000000b01'),
  0, 'de nipte nederlaag ná een afdroging is pas vakje één');
select is(public.pech_streak('ac000000-0000-0000-0000-000000000b01'), 1,
  'en de meter telt weer vanaf één');

------------------------------------------------------------------------
-- 4. Een zege breekt de meter.
------------------------------------------------------------------------
insert into public.matches (id, team_a_id, team_b_id, status, winner_team_id, score_a, score_b, played_at)
values
  ('ac000000-0000-0000-0000-000000000401','ac000000-0000-0000-0000-000000000121','ac000000-0000-0000-0000-000000000122',
   'completed','ac000000-0000-0000-0000-000000000122', 6, 7, now() + interval '20 days'),
  ('ac000000-0000-0000-0000-000000000402','ac000000-0000-0000-0000-000000000121','ac000000-0000-0000-0000-000000000122',
   'completed','ac000000-0000-0000-0000-000000000122', 5, 7, now() + interval '21 days'),
  ('ac000000-0000-0000-0000-000000000403','ac000000-0000-0000-0000-000000000121','ac000000-0000-0000-0000-000000000122',
   'completed','ac000000-0000-0000-0000-000000000121', 7, 5, now() + interval '22 days');

select is(public.pech_streak('ac000000-0000-0000-0000-000000000c01'), 0,
  'een zege zet de meter op nul');

insert into public.matches (id, team_a_id, team_b_id, status, winner_team_id, score_a, score_b, played_at)
values
  ('ac000000-0000-0000-0000-000000000404','ac000000-0000-0000-0000-000000000121','ac000000-0000-0000-0000-000000000122',
   'completed','ac000000-0000-0000-0000-000000000122', 6, 7, now() + interval '23 days');

select is((select troost_delta from public.rating_history
    where match_id = 'ac000000-0000-0000-0000-000000000404'
      and player_id = 'ac000000-0000-0000-0000-000000000c01'),
  0, 'na een zege begint de meter opnieuw bij vakje één');

------------------------------------------------------------------------
-- 5. Een gelijkspel breekt de meter en levert zelf niets op.
------------------------------------------------------------------------
insert into public.matches (id, team_a_id, team_b_id, status, winner_team_id, score_a, score_b, played_at)
values
  ('ac000000-0000-0000-0000-000000000501','ac000000-0000-0000-0000-000000000131','ac000000-0000-0000-0000-000000000132',
   'completed','ac000000-0000-0000-0000-000000000132', 6, 7, now() + interval '24 days'),
  ('ac000000-0000-0000-0000-000000000502','ac000000-0000-0000-0000-000000000131','ac000000-0000-0000-0000-000000000132',
   'completed','ac000000-0000-0000-0000-000000000132', 5, 7, now() + interval '25 days'),
  ('ac000000-0000-0000-0000-000000000503','ac000000-0000-0000-0000-000000000131','ac000000-0000-0000-0000-000000000132',
   'completed', null, 6, 6, now() + interval '26 days');

select is((select troost_delta from public.rating_history
    where match_id = 'ac000000-0000-0000-0000-000000000503'
      and player_id = 'ac000000-0000-0000-0000-000000000d01'),
  0, 'een gelijkspel wordt niet getroost');
select is(public.pech_streak('ac000000-0000-0000-0000-000000000d01'), 0,
  'en zet de meter op nul');

insert into public.matches (id, team_a_id, team_b_id, status, winner_team_id, score_a, score_b, played_at)
values
  ('ac000000-0000-0000-0000-000000000504','ac000000-0000-0000-0000-000000000131','ac000000-0000-0000-0000-000000000132',
   'completed','ac000000-0000-0000-0000-000000000132', 6, 7, now() + interval '27 days');

select is((select troost_delta from public.rating_history
    where match_id = 'ac000000-0000-0000-0000-000000000504'
      and player_id = 'ac000000-0000-0000-0000-000000000d01'),
  0, 'de nipte nederlaag ná een gelijkspel is pas vakje één');

------------------------------------------------------------------------
-- 6. Een minimaal verlies mag door de demper nooit in winst omslaan.
--    De underdog levert hier maar ~1 punt in; de demper is er 4.
------------------------------------------------------------------------
insert into public.matches (id, team_a_id, team_b_id, status, winner_team_id, score_a, score_b, played_at)
values
  ('ac000000-0000-0000-0000-000000000601','ac000000-0000-0000-0000-000000000141','ac000000-0000-0000-0000-000000000142',
   'completed','ac000000-0000-0000-0000-000000000142', 6, 7, now() + interval '28 days'),
  ('ac000000-0000-0000-0000-000000000602','ac000000-0000-0000-0000-000000000141','ac000000-0000-0000-0000-000000000142',
   'completed','ac000000-0000-0000-0000-000000000142', 5, 7, now() + interval '29 days'),
  ('ac000000-0000-0000-0000-000000000603','ac000000-0000-0000-0000-000000000141','ac000000-0000-0000-0000-000000000142',
   'completed','ac000000-0000-0000-0000-000000000142', 6, 7, now() + interval '30 days');

select ok((select delta from public.rating_history
    where match_id = 'ac000000-0000-0000-0000-000000000603'
      and player_id = 'ac000000-0000-0000-0000-000000000e01') <= 0,
  'een gedempte nederlaag slaat nooit om in ratingwinst');
select ok((select troost_delta from public.rating_history
    where match_id = 'ac000000-0000-0000-0000-000000000603'
      and player_id = 'ac000000-0000-0000-0000-000000000e01') > 0,
  'maar er wordt wel degelijk gedempt');

------------------------------------------------------------------------
-- Momentopname vóór elke recompute: dit zijn de uitkomsten van het
-- incrementele pad. Sectie 8 legt ze naast de herberekende stand.
------------------------------------------------------------------------
create temp table pech_snap as
  select player_id, match_id, delta, troost_delta, rating_before, rating_after
  from public.rating_history
  where match_id in (
    'ac000000-0000-0000-0000-000000000201','ac000000-0000-0000-0000-000000000202',
    'ac000000-0000-0000-0000-000000000203','ac000000-0000-0000-0000-000000000204',
    'ac000000-0000-0000-0000-000000000205','ac000000-0000-0000-0000-000000000206'
  );

select is((select count(*)::int from pech_snap),
  24, 'de drift-test vergelijkt alle vierentwintig history-rijen van sectie 1 & 2');

------------------------------------------------------------------------
-- 7. De invoeringsgrens: oude matches vullen de meter wél, maar keren niet
--    uit. Zonder die grens zou de eerstvolgende recompute de hele historie
--    herschrijven. Deze inserts liggen vóór bestaande matches en zetten dus
--    meteen het volledige-recompute-pad in gang.
------------------------------------------------------------------------
insert into public.matches (id, team_a_id, team_b_id, status, winner_team_id, score_a, score_b, played_at)
values
  ('ac000000-0000-0000-0000-000000000701','ac000000-0000-0000-0000-000000000151','ac000000-0000-0000-0000-000000000152',
   'completed','ac000000-0000-0000-0000-000000000152', 6, 7, timestamptz '2026-01-05 20:00:00+01'),
  ('ac000000-0000-0000-0000-000000000702','ac000000-0000-0000-0000-000000000151','ac000000-0000-0000-0000-000000000152',
   'completed','ac000000-0000-0000-0000-000000000152', 5, 7, timestamptz '2026-01-06 20:00:00+01'),
  ('ac000000-0000-0000-0000-000000000703','ac000000-0000-0000-0000-000000000151','ac000000-0000-0000-0000-000000000152',
   'completed','ac000000-0000-0000-0000-000000000152', 6, 7, timestamptz '2026-01-07 20:00:00+01');

select is((select troost_delta from public.rating_history
    where match_id = 'ac000000-0000-0000-0000-000000000703'
      and player_id = 'ac000000-0000-0000-0000-000000000f01'),
  0, 'matches van vóór de invoering worden niet met terugwerkende kracht getroost');
select is(public.pech_streak('ac000000-0000-0000-0000-000000000f01'), 3,
  'de meter zelf telt ze wel: hij is puur uit de uitslagen afgeleid');

------------------------------------------------------------------------
-- 8. Drift: het incrementele pad en een volledige recompute moeten exact
--    dezelfde demper opleveren. De vergelijking loopt over de zes matches van
--    sectie 1 & 2 — die spelers hebben geen kunstmatige beginstand en bouwen
--    hun rating dus volledig uit matches op.
------------------------------------------------------------------------
select public.recompute_ratings();

select is(
  (select count(*)::int from pech_snap s
     join public.rating_history h
       on h.player_id = s.player_id and h.match_id = s.match_id
    where (h.delta, h.troost_delta, h.rating_before, h.rating_after)
          is distinct from (s.delta, s.troost_delta, s.rating_before, s.rating_after)),
  0, 'een volledige recompute geeft exact dezelfde demper als het incrementele pad');

select * from finish();

rollback;
