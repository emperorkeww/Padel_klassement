-- pgTAP-tests voor de maandelijkse jokers (#1003): wat doet een kaart met de
-- rating, wanneer mag je hem spelen, en houdt het maandtegoed stand?
--
-- De Elo-assertions kijken naar rating_history — dat is wat er werkelijk op de
-- rating is toegepast, niet wat een losse functieaanroep achteraf zou zeggen.
--
-- Sectie 1 t/m 6 spelen zich af in één groep waarin het winnende team steeds
-- hetzelfde is. Dat is geen luiheid maar noodzaak: de Big Daddy van een groep
-- draagt een bounty (#805), en die zou de deltas vertroebelen zodra hij aan de
-- verliezende kant staat. Door de hoogst gerate speler altijd te laten winnen
-- blijft de bounty buiten beeld — behalve in sectie 7, waar hij juist het punt
-- is. De vier spelers starten allemaal op 1000, zodat de eerste match exact
-- ±12 oplevert (K = 24, E = 0,5) en de verdubbeling op een rond getal valt.
--
-- Elke match staat in een eigen kalendermaand: één joker per speler per maand,
-- dus zonder maandsprong is de tweede kaart onspeelbaar. Dat de kaart de maand
-- erna wél weer klaarligt, is meteen de test op het tegoed.
--
-- De drift-test staat achteraan: recompute_ratings() herbouwt álle ratings uit
-- de matches en gooit de rechtstreeks gezette beginstanden dus weg.
begin;

select plan(43);

------------------------------------------------------------------------
-- Fixtures. Profielen mogen rechtstreeks (handle_new_user is er alleen voor
-- echte accounts); twee accounts zijn nodig voor de RLS-test onderaan.
------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
values
  ('00000000-0000-0000-0000-000000000000','3a000000-0000-0000-0000-0000000000a1','authenticated','authenticated','jj1@test.nl','x',now(),'{}','{"username":"jj_u1"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','3a000000-0000-0000-0000-0000000000a2','authenticated','authenticated','jj2@test.nl','x',now(),'{}','{"username":"jj_u2"}',now(),now(),'','','','');

insert into public.profiles (id, username, full_name, is_guest, owner_id) values
  -- Groep 1. Team B (p3/p4) wint elke match en heeft bewust de laagste id's:
  -- bij gelijke rating en gelijke created_at valt de Big Daddy-tie-break op id,
  -- en die drager moet aan de winnende kant staan.
  ('3a000000-0000-0000-0000-000000000101','jj_p3','P3', false, null),
  ('3a000000-0000-0000-0000-000000000102','jj_p4','P4', false, null),
  ('3a000000-0000-0000-0000-000000000111','jj_p1','P1', false, null),
  ('3a000000-0000-0000-0000-000000000112','jj_p2','P2', false, null),
  -- Groep 2: s1 is dictator (≥ 1600) en verliest mét schild.
  ('3a000000-0000-0000-0000-000000000201','jj_s1','S1', false, null),
  ('3a000000-0000-0000-0000-000000000202','jj_s2','S2', false, null),
  ('3a000000-0000-0000-0000-000000000203','jj_s3','S3', false, null),
  ('3a000000-0000-0000-0000-000000000204','jj_s4','S4', false, null),
  -- Groep 3: de guards. g* zijn ingelopen, r* nog niet, o1 speelt niet mee.
  ('3a000000-0000-0000-0000-000000000301','jj_g1','G1', false, null),
  ('3a000000-0000-0000-0000-000000000302','jj_g2','G2', false, null),
  ('3a000000-0000-0000-0000-000000000303','jj_g3','G3', false, null),
  ('3a000000-0000-0000-0000-000000000304','jj_g4','G4', false, null),
  ('3a000000-0000-0000-0000-000000000311','jj_r1','R1', false, null),
  ('3a000000-0000-0000-0000-000000000312','jj_r2','R2', false, null),
  ('3a000000-0000-0000-0000-000000000321','jj_o1','O1', false, null);

-- De maker van een groep wordt automatisch lid (on_group_created); daarom een
-- maker uit de sectie zelf, anders zou een vreemde eend de kroon kunnen dragen.
insert into public.groups (id, name, created_by) values
  ('3a000000-0000-0000-0000-0000000000f1','Jokergroep','3a000000-0000-0000-0000-000000000101'),
  ('3a000000-0000-0000-0000-0000000000f2','Bountygroep','3a000000-0000-0000-0000-000000000203'),
  ('3a000000-0000-0000-0000-0000000000f3','Guardgroep','3a000000-0000-0000-0000-000000000301');

insert into public.group_members (group_id, player_id) values
  ('3a000000-0000-0000-0000-0000000000f1','3a000000-0000-0000-0000-000000000101'),
  ('3a000000-0000-0000-0000-0000000000f1','3a000000-0000-0000-0000-000000000102'),
  ('3a000000-0000-0000-0000-0000000000f1','3a000000-0000-0000-0000-000000000111'),
  ('3a000000-0000-0000-0000-0000000000f1','3a000000-0000-0000-0000-000000000112'),
  ('3a000000-0000-0000-0000-0000000000f2','3a000000-0000-0000-0000-000000000201'),
  ('3a000000-0000-0000-0000-0000000000f2','3a000000-0000-0000-0000-000000000202'),
  ('3a000000-0000-0000-0000-0000000000f2','3a000000-0000-0000-0000-000000000203'),
  ('3a000000-0000-0000-0000-0000000000f2','3a000000-0000-0000-0000-000000000204'),
  ('3a000000-0000-0000-0000-0000000000f3','3a000000-0000-0000-0000-000000000301'),
  ('3a000000-0000-0000-0000-0000000000f3','3a000000-0000-0000-0000-000000000302'),
  ('3a000000-0000-0000-0000-0000000000f3','3a000000-0000-0000-0000-000000000303'),
  ('3a000000-0000-0000-0000-0000000000f3','3a000000-0000-0000-0000-000000000304'),
  ('3a000000-0000-0000-0000-0000000000f3','3a000000-0000-0000-0000-000000000311'),
  ('3a000000-0000-0000-0000-0000000000f3','3a000000-0000-0000-0000-000000000312'),
  ('3a000000-0000-0000-0000-0000000000f3','3a000000-0000-0000-0000-000000000321'),
  ('3a000000-0000-0000-0000-0000000000f3','3a000000-0000-0000-0000-0000000000a1'),
  ('3a000000-0000-0000-0000-0000000000f3','3a000000-0000-0000-0000-0000000000a2')
on conflict do nothing;

insert into public.teams (id, player1_id, player2_id) values
  ('3a000000-0000-0000-0000-000000001001','3a000000-0000-0000-0000-000000000111','3a000000-0000-0000-0000-000000000112'), -- p1+p2 (verliezers)
  ('3a000000-0000-0000-0000-000000001002','3a000000-0000-0000-0000-000000000101','3a000000-0000-0000-0000-000000000102'), -- p3+p4 (winnaars)
  ('3a000000-0000-0000-0000-000000002001','3a000000-0000-0000-0000-000000000201','3a000000-0000-0000-0000-000000000202'), -- s1+s2
  ('3a000000-0000-0000-0000-000000002002','3a000000-0000-0000-0000-000000000203','3a000000-0000-0000-0000-000000000204'), -- s3+s4
  ('3a000000-0000-0000-0000-000000003001','3a000000-0000-0000-0000-000000000301','3a000000-0000-0000-0000-000000000302'), -- g1+g2
  ('3a000000-0000-0000-0000-000000003002','3a000000-0000-0000-0000-000000000303','3a000000-0000-0000-0000-000000000304'), -- g3+g4
  ('3a000000-0000-0000-0000-000000003003','3a000000-0000-0000-0000-000000000311','3a000000-0000-0000-0000-000000000312'), -- r1+r2
  ('3a000000-0000-0000-0000-000000003004','3a000000-0000-0000-0000-0000000000a1','3a000000-0000-0000-0000-0000000000a2'), -- u1+u2
  ('3a000000-0000-0000-0000-000000003011','3a000000-0000-0000-0000-000000000301', null),                                   -- g1 solo
  ('3a000000-0000-0000-0000-000000003012','3a000000-0000-0000-0000-000000000303', null);                                   -- g3 solo

-- Beginstand. Rechtstreeks gezet zodat de scenario's exact voorspelbaar zijn.
insert into public.player_ratings (player_id, rating, games) values
  ('3a000000-0000-0000-0000-000000000101', 1000, 10),
  ('3a000000-0000-0000-0000-000000000102', 1000, 10),
  ('3a000000-0000-0000-0000-000000000111', 1000, 10),
  ('3a000000-0000-0000-0000-000000000112', 1000, 10),
  ('3a000000-0000-0000-0000-000000000201', 1650, 10),  -- dictator: draagt een bounty
  ('3a000000-0000-0000-0000-000000000202', 1000, 10),
  ('3a000000-0000-0000-0000-000000000203', 1000, 10),
  ('3a000000-0000-0000-0000-000000000204', 1000, 10),
  ('3a000000-0000-0000-0000-000000000301', 1000, 10),
  ('3a000000-0000-0000-0000-000000000302', 1000, 10),
  ('3a000000-0000-0000-0000-000000000303', 1000, 10),
  ('3a000000-0000-0000-0000-000000000304', 1000, 10),
  ('3a000000-0000-0000-0000-000000000311', 1000, 2),   -- rating nog niet ingelopen
  ('3a000000-0000-0000-0000-000000000312', 1000, 2),
  ('3a000000-0000-0000-0000-0000000000a1', 1000, 10),
  ('3a000000-0000-0000-0000-0000000000a2', 1000, 10);

-- Alle matches hieronder liggen ná de laatste bestaande afgeronde match, zodat
-- het incrementele pad wordt gevolgd. maand(n) = de tiende van de n-de maand
-- ná deze — ver genoeg in de toekomst voor de guards, en gegarandeerd in een
-- andere kalendermaand dan de vorige.
create temp table jj_maand as
  select n, (date_trunc('month', now()) + (n || ' months')::interval
             + interval '10 days') as ts
  from generate_series(1, 9) n;

------------------------------------------------------------------------
-- 1. dubbel_of_niets bij winst: eigen mutatie ×2, de rest ongemoeid.
------------------------------------------------------------------------
insert into public.matches (id, team_a_id, team_b_id, group_id, status, played_at)
values ('3a000000-0000-0000-0000-00000000e001',
        '3a000000-0000-0000-0000-000000001001','3a000000-0000-0000-0000-000000001002',
        '3a000000-0000-0000-0000-0000000000f1','scheduled',
        (select ts from jj_maand where n = 1));

insert into public.match_jokers (match_id, player_id, group_id, joker) values
  ('3a000000-0000-0000-0000-00000000e001','3a000000-0000-0000-0000-000000000101',
   '3a000000-0000-0000-0000-0000000000f1','dubbel_of_niets');

update public.matches
   set status = 'completed', winner_team_id = '3a000000-0000-0000-0000-000000001002'
 where id = '3a000000-0000-0000-0000-00000000e001';

select is((select delta from public.rating_history
    where match_id = '3a000000-0000-0000-0000-00000000e001'
      and player_id = '3a000000-0000-0000-0000-000000000101'),
  24, 'dubbel of niets verdubbelt de winst (+12 wordt +24)');
select is((select stake_factor from public.rating_history
    where match_id = '3a000000-0000-0000-0000-00000000e001'
      and player_id = '3a000000-0000-0000-0000-000000000101'),
  2.00, 'de gebruikte factor wordt als 2.00 gelogd');
select is((select joker::text from public.rating_history
    where match_id = '3a000000-0000-0000-0000-00000000e001'
      and player_id = '3a000000-0000-0000-0000-000000000101'),
  'dubbel_of_niets', 'de gespeelde kaart staat in de historie');
select is((select delta from public.rating_history
    where match_id = '3a000000-0000-0000-0000-00000000e001'
      and player_id = '3a000000-0000-0000-0000-000000000102'),
  12, 'de partner houdt zijn normale mutatie');
select is((select delta from public.rating_history
    where match_id = '3a000000-0000-0000-0000-00000000e001'
      and player_id = '3a000000-0000-0000-0000-000000000111'),
  -12, 'de tegenstander houdt zijn normale mutatie');
select is((select joker from public.rating_history
    where match_id = '3a000000-0000-0000-0000-00000000e001'
      and player_id = '3a000000-0000-0000-0000-000000000111'),
  null::public.joker_type, 'wie niets speelde heeft geen kaart in de historie');
select is((select period_month from public.match_jokers
    where match_id = '3a000000-0000-0000-0000-00000000e001'),
  (select date_trunc('month', ts)::date from jj_maand where n = 1),
  'period_month is de eerste van de maand van de match');

------------------------------------------------------------------------
-- 2. schild bij verlies: geen mutatie, en de kaart ligt er de maand erna
--    weer (nieuwe maand, nieuw tegoed).
------------------------------------------------------------------------
insert into public.matches (id, team_a_id, team_b_id, group_id, status, played_at)
values ('3a000000-0000-0000-0000-00000000e002',
        '3a000000-0000-0000-0000-000000001001','3a000000-0000-0000-0000-000000001002',
        '3a000000-0000-0000-0000-0000000000f1','scheduled',
        (select ts from jj_maand where n = 2));

insert into public.match_jokers (match_id, player_id, group_id, joker) values
  ('3a000000-0000-0000-0000-00000000e002','3a000000-0000-0000-0000-000000000111',
   '3a000000-0000-0000-0000-0000000000f1','schild');

update public.matches
   set status = 'completed', winner_team_id = '3a000000-0000-0000-0000-000000001002'
 where id = '3a000000-0000-0000-0000-00000000e002';

select is((select delta from public.rating_history
    where match_id = '3a000000-0000-0000-0000-00000000e002'
      and player_id = '3a000000-0000-0000-0000-000000000111'),
  0, 'een schild houdt het verlies op nul');
select is((select stake_factor from public.rating_history
    where match_id = '3a000000-0000-0000-0000-00000000e002'
      and player_id = '3a000000-0000-0000-0000-000000000111'),
  0.00, 'de factor van het schild wordt als 0.00 gelogd');
select is((select joker::text from public.rating_history
    where match_id = '3a000000-0000-0000-0000-00000000e002'
      and player_id = '3a000000-0000-0000-0000-000000000111'),
  'schild', 'het schild staat in de historie');
select ok((select delta from public.rating_history
    where match_id = '3a000000-0000-0000-0000-00000000e002'
      and player_id = '3a000000-0000-0000-0000-000000000112') < 0,
  'het schild is strikt individueel: de partner verliest gewoon');

------------------------------------------------------------------------
-- 3. schild bij winst: ook de winst vervalt. Dat is de prijs die de
--    verwachting op nul houdt.
------------------------------------------------------------------------
insert into public.matches (id, team_a_id, team_b_id, group_id, status, played_at)
values ('3a000000-0000-0000-0000-00000000e003',
        '3a000000-0000-0000-0000-000000001001','3a000000-0000-0000-0000-000000001002',
        '3a000000-0000-0000-0000-0000000000f1','scheduled',
        (select ts from jj_maand where n = 3));

insert into public.match_jokers (match_id, player_id, group_id, joker) values
  ('3a000000-0000-0000-0000-00000000e003','3a000000-0000-0000-0000-000000000101',
   '3a000000-0000-0000-0000-0000000000f1','schild');

update public.matches
   set status = 'completed', winner_team_id = '3a000000-0000-0000-0000-000000001002'
 where id = '3a000000-0000-0000-0000-00000000e003';

select is((select delta from public.rating_history
    where match_id = '3a000000-0000-0000-0000-00000000e003'
      and player_id = '3a000000-0000-0000-0000-000000000101'),
  0, 'een schild neemt ook de winst af');
select ok((select delta from public.rating_history
    where match_id = '3a000000-0000-0000-0000-00000000e003'
      and player_id = '3a000000-0000-0000-0000-000000000102') > 0,
  'de partner wint wél gewoon');

------------------------------------------------------------------------
-- 4. wissel_van_kant: sociale kaart, geen enkel Elo-gevolg.
------------------------------------------------------------------------
insert into public.matches (id, team_a_id, team_b_id, group_id, status, played_at)
values ('3a000000-0000-0000-0000-00000000e004',
        '3a000000-0000-0000-0000-000000001001','3a000000-0000-0000-0000-000000001002',
        '3a000000-0000-0000-0000-0000000000f1','scheduled',
        (select ts from jj_maand where n = 4));

insert into public.match_jokers (match_id, player_id, group_id, joker) values
  ('3a000000-0000-0000-0000-00000000e004','3a000000-0000-0000-0000-000000000111',
   '3a000000-0000-0000-0000-0000000000f1','wissel_van_kant');

update public.matches
   set status = 'completed', winner_team_id = '3a000000-0000-0000-0000-000000001002'
 where id = '3a000000-0000-0000-0000-00000000e004';

select is((select stake_factor from public.rating_history
    where match_id = '3a000000-0000-0000-0000-00000000e004'
      and player_id = '3a000000-0000-0000-0000-000000000111'),
  1.00, 'van kant wisselen laat de factor op 1.00');
select is((select joker::text from public.rating_history
    where match_id = '3a000000-0000-0000-0000-00000000e004'
      and player_id = '3a000000-0000-0000-0000-000000000111'),
  'wissel_van_kant', 'de kaart wordt wél gelogd: hij hoort bij het verhaal');
select is((select delta from public.rating_history
    where match_id = '3a000000-0000-0000-0000-00000000e004'
      and player_id = '3a000000-0000-0000-0000-000000000111'),
  (select delta from public.rating_history
    where match_id = '3a000000-0000-0000-0000-00000000e004'
      and player_id = '3a000000-0000-0000-0000-000000000112'),
  'de mutatie is exact die van zijn partner');

------------------------------------------------------------------------
-- 5. Gelijkspel: dubbel_of_niets telt niet mee. K · (0,5 − E) is voor een
--    underdog positief en mag geen beloning voor een mislukte gok worden.
------------------------------------------------------------------------
insert into public.matches (id, team_a_id, team_b_id, group_id, status, played_at)
values ('3a000000-0000-0000-0000-00000000e005',
        '3a000000-0000-0000-0000-000000001001','3a000000-0000-0000-0000-000000001002',
        '3a000000-0000-0000-0000-0000000000f1','scheduled',
        (select ts from jj_maand where n = 5));

insert into public.match_jokers (match_id, player_id, group_id, joker) values
  ('3a000000-0000-0000-0000-00000000e005','3a000000-0000-0000-0000-000000000111',
   '3a000000-0000-0000-0000-0000000000f1','dubbel_of_niets');

update public.matches
   set status = 'completed', winner_team_id = null
 where id = '3a000000-0000-0000-0000-00000000e005';

select is((select stake_factor from public.rating_history
    where match_id = '3a000000-0000-0000-0000-00000000e005'
      and player_id = '3a000000-0000-0000-0000-000000000111'),
  1.00, 'bij gelijkspel telt de verdubbeling niet');
select is((select delta from public.rating_history
    where match_id = '3a000000-0000-0000-0000-00000000e005'
      and player_id = '3a000000-0000-0000-0000-000000000111'),
  (select delta from public.rating_history
    where match_id = '3a000000-0000-0000-0000-00000000e005'
      and player_id = '3a000000-0000-0000-0000-000000000112'),
  'de gokker houdt exact de mutatie van zijn partner');

------------------------------------------------------------------------
-- 6. Gelijkspel mét schild: "telt niet" is onvoorwaardelijk.
------------------------------------------------------------------------
insert into public.matches (id, team_a_id, team_b_id, group_id, status, played_at)
values ('3a000000-0000-0000-0000-00000000e006',
        '3a000000-0000-0000-0000-000000001001','3a000000-0000-0000-0000-000000001002',
        '3a000000-0000-0000-0000-0000000000f1','scheduled',
        (select ts from jj_maand where n = 6));

insert into public.match_jokers (match_id, player_id, group_id, joker) values
  ('3a000000-0000-0000-0000-00000000e006','3a000000-0000-0000-0000-000000000101',
   '3a000000-0000-0000-0000-0000000000f1','schild');

update public.matches
   set status = 'completed', winner_team_id = null
 where id = '3a000000-0000-0000-0000-00000000e006';

select is((select delta from public.rating_history
    where match_id = '3a000000-0000-0000-0000-00000000e006'
      and player_id = '3a000000-0000-0000-0000-000000000101'),
  0, 'ook bij gelijkspel zet het schild de mutatie op nul');
select is((select stake_factor from public.rating_history
    where match_id = '3a000000-0000-0000-0000-00000000e006'
      and player_id = '3a000000-0000-0000-0000-000000000101'),
  0.00, 'en de factor blijft 0.00');

select is((select count(*)::int from public.match_jokers
    where player_id = '3a000000-0000-0000-0000-000000000111'),
  3, 'drie maanden, drie kaarten: het tegoed loopt per kalendermaand door');

------------------------------------------------------------------------
-- 7. Een schild schermt de bounty niet af. De pool is een overdracht: zou de
--    verslagen drager niets betalen terwijl de winnaars wél ontvangen, dan
--    maakt elke claim Elo bij.
--
--    Maand 7 en niet maand 1: een afgeronde match die chronologisch vóór een
--    al verwerkte match valt, dwingt de trigger tot een volledige recompute.
--    Die zou de rechtstreeks gezette 1650 van s1 wegvegen — hij is dan geen
--    dictator meer en er valt niets te claimen.
------------------------------------------------------------------------
insert into public.matches (id, team_a_id, team_b_id, group_id, status, played_at)
values ('3a000000-0000-0000-0000-00000000e007',
        '3a000000-0000-0000-0000-000000002001','3a000000-0000-0000-0000-000000002002',
        '3a000000-0000-0000-0000-0000000000f2','scheduled',
        (select ts from jj_maand where n = 7));

insert into public.match_jokers (match_id, player_id, group_id, joker) values
  ('3a000000-0000-0000-0000-00000000e007','3a000000-0000-0000-0000-000000000201',
   '3a000000-0000-0000-0000-0000000000f2','schild');

update public.matches
   set status = 'completed', winner_team_id = '3a000000-0000-0000-0000-000000002002'
 where id = '3a000000-0000-0000-0000-00000000e007';

select is((select stake_factor from public.rating_history
    where match_id = '3a000000-0000-0000-0000-00000000e007'
      and player_id = '3a000000-0000-0000-0000-000000000201'),
  0.00, 'de dictator speelde een schild');
select is((select bounty_delta from public.rating_history
    where match_id = '3a000000-0000-0000-0000-00000000e007'
      and player_id = '3a000000-0000-0000-0000-000000000201'),
  -8, 'de prijs op zijn hoofd betaalt hij onverkort');
select is((select delta from public.rating_history
    where match_id = '3a000000-0000-0000-0000-00000000e007'
      and player_id = '3a000000-0000-0000-0000-000000000201'),
  -8, 'zijn mutatie is precies de bounty: de uitslag zelf is afgeschermd');
select is((select sum(bounty_delta)::int from public.rating_history
    where match_id = '3a000000-0000-0000-0000-00000000e007'),
  0, 'de bounty blijft zero-sum, ook met een schild erop');

------------------------------------------------------------------------
-- 8. Guards: wie mag wanneer welke kaart spelen?
------------------------------------------------------------------------
insert into public.matches (id, team_a_id, team_b_id, group_id, status, played_at, format)
values
  -- MG: de gewone, speelbare match. Maand 8, dus chronologisch ná de matches
  -- van sectie 1 t/m 7 — zie de motivatie daar.
  ('3a000000-0000-0000-0000-00000000ef01',
   '3a000000-0000-0000-0000-000000003001','3a000000-0000-0000-0000-000000003002',
   '3a000000-0000-0000-0000-0000000000f3','scheduled',
   (select ts from jj_maand where n = 8), '2v2'),
  -- MR2: tweede match van dezelfde spelers in dezelfde maand — het maandtegoed.
  ('3a000000-0000-0000-0000-00000000ef02',
   '3a000000-0000-0000-0000-000000003003','3a000000-0000-0000-0000-000000003002',
   '3a000000-0000-0000-0000-0000000000f3','scheduled',
   (select ts from jj_maand where n = 8) + interval '1 day', '2v2'),
  -- MR: met de nog niet ingelopen spelers.
  ('3a000000-0000-0000-0000-00000000ef03',
   '3a000000-0000-0000-0000-000000003003','3a000000-0000-0000-0000-000000003002',
   '3a000000-0000-0000-0000-0000000000f3','scheduled',
   (select ts from jj_maand where n = 8), '2v2'),
  -- MU: met de twee accounts, voor de RLS-test.
  ('3a000000-0000-0000-0000-00000000ef04',
   '3a000000-0000-0000-0000-000000003004','3a000000-0000-0000-0000-000000003002',
   '3a000000-0000-0000-0000-0000000000f3','scheduled',
   (select ts from jj_maand where n = 8), '2v2'),
  -- MS: enkelspel.
  ('3a000000-0000-0000-0000-00000000ef05',
   '3a000000-0000-0000-0000-000000003011','3a000000-0000-0000-0000-000000003012',
   '3a000000-0000-0000-0000-0000000000f3','scheduled',
   (select ts from jj_maand where n = 9), '1v1'),
  -- MN: losse match zonder groep.
  ('3a000000-0000-0000-0000-00000000ef06',
   '3a000000-0000-0000-0000-000000003001','3a000000-0000-0000-0000-000000003002',
   null,'scheduled', (select ts from jj_maand where n = 9), '2v2'),
  -- MP: zonder starttijd.
  ('3a000000-0000-0000-0000-00000000ef07',
   '3a000000-0000-0000-0000-000000003001','3a000000-0000-0000-0000-000000003002',
   '3a000000-0000-0000-0000-0000000000f3','scheduled', null, '2v2'),
  -- MV: starttijd al gepasseerd.
  ('3a000000-0000-0000-0000-00000000ef08',
   '3a000000-0000-0000-0000-000000003001','3a000000-0000-0000-0000-000000003002',
   '3a000000-0000-0000-0000-0000000000f3','scheduled', now() - interval '1 day', '2v2');

select throws_ok(
  $$insert into public.match_jokers (match_id, player_id, group_id, joker)
    values ('3a000000-0000-0000-0000-00000000ef01','3a000000-0000-0000-0000-000000000321',
            '3a000000-0000-0000-0000-0000000000f3','schild')$$,
  'P0001', 'alleen spelers uit deze match kunnen een joker spelen',
  'een groepslid dat niet meespeelt kan geen kaart spelen');

select throws_ok(
  $$insert into public.match_jokers (match_id, player_id, group_id, joker)
    values ('3a000000-0000-0000-0000-00000000ef06','3a000000-0000-0000-0000-000000000301',
            '3a000000-0000-0000-0000-0000000000f3','schild')$$,
  'P0001', 'een joker kan alleen op groepsmatches',
  'een losse match valt buiten het jokerspel');

select throws_ok(
  $$insert into public.match_jokers (match_id, player_id, group_id, joker)
    values ('3a000000-0000-0000-0000-00000000ef07','3a000000-0000-0000-0000-000000000301',
            '3a000000-0000-0000-0000-0000000000f3','schild')$$,
  'P0001', 'deze match heeft nog geen starttijd',
  'zonder starttijd is er geen maand om op af te rekenen');

select throws_ok(
  $$insert into public.match_jokers (match_id, player_id, group_id, joker)
    values ('3a000000-0000-0000-0000-00000000ef08','3a000000-0000-0000-0000-000000000301',
            '3a000000-0000-0000-0000-0000000000f3','schild')$$,
  'P0001', 'de match is al begonnen',
  'na de aftrap ligt de kaart vast');

select throws_ok(
  $$insert into public.match_jokers (match_id, player_id, group_id, joker)
    values ('3a000000-0000-0000-0000-00000000e001','3a000000-0000-0000-0000-000000000101',
            '3a000000-0000-0000-0000-0000000000f1','schild')$$,
  'P0001', 'deze match is al begonnen of afgerond',
  'op een afgeronde match valt niets meer te spelen');

select throws_ok(
  $$insert into public.match_jokers (match_id, player_id, group_id, joker)
    values ('3a000000-0000-0000-0000-00000000ef05','3a000000-0000-0000-0000-000000000301',
            '3a000000-0000-0000-0000-0000000000f3','wissel_van_kant')$$,
  'P0001', 'van kant wisselen kan alleen in het dubbelspel',
  'in een enkel valt er niets te wisselen');

select throws_ok(
  $$insert into public.match_jokers (match_id, player_id, group_id, joker)
    values ('3a000000-0000-0000-0000-00000000ef03','3a000000-0000-0000-0000-000000000311',
            '3a000000-0000-0000-0000-0000000000f3','schild')$$,
  'P0001', 'je rating is nog niet ingelopen: deze joker kan vanaf 10 gespeelde matches',
  'een niet ingelopen rating valt niet af te schermen');

select lives_ok(
  $$insert into public.match_jokers (match_id, player_id, group_id, joker)
    values ('3a000000-0000-0000-0000-00000000ef03','3a000000-0000-0000-0000-000000000311',
            '3a000000-0000-0000-0000-0000000000f3','wissel_van_kant')$$,
  'van kant wisselen mag wél zonder ingelopen rating: het raakt de rating niet');

select is((select period_month from public.match_jokers
    where match_id = '3a000000-0000-0000-0000-00000000ef03'
      and player_id = '3a000000-0000-0000-0000-000000000311'),
  (select date_trunc('month', ts)::date from jj_maand where n = 8),
  'ook de sociale kaart krijgt zijn maand serverside');

-- Tweede kaart in dezelfde maand, op een match waarin r1 óók meespeelt: wat
-- hier weigert is het tegoed en niet de deelnemerscheck.
select throws_ok(
  $$insert into public.match_jokers (match_id, player_id, group_id, joker)
    values ('3a000000-0000-0000-0000-00000000ef02','3a000000-0000-0000-0000-000000000311',
            '3a000000-0000-0000-0000-0000000000f3','wissel_van_kant')$$,
  '23505', null,
  'een tweede kaart in dezelfde maand botst op het maandtegoed');

-- Anti-stapelen, beide richtingen. g3 zet eerst zijn lef in.
insert into public.match_stakes (match_id, player_id, group_id) values
  ('3a000000-0000-0000-0000-00000000ef01','3a000000-0000-0000-0000-000000000303',
   '3a000000-0000-0000-0000-0000000000f3');

select throws_ok(
  $$insert into public.match_jokers (match_id, player_id, group_id, joker)
    values ('3a000000-0000-0000-0000-00000000ef01','3a000000-0000-0000-0000-000000000303',
            '3a000000-0000-0000-0000-0000000000f3','dubbel_of_niets')$$,
  'P0001', 'je lef staat al op deze match: trek die eerst in',
  'dubbel of niets naast een lef-tip zou ×4 opleveren');

select lives_ok(
  $$insert into public.match_jokers (match_id, player_id, group_id, joker)
    values ('3a000000-0000-0000-0000-00000000ef01','3a000000-0000-0000-0000-000000000303',
            '3a000000-0000-0000-0000-0000000000f3','wissel_van_kant')$$,
  'de sociale kaart mag wél naast een lef-tip staan');

-- En andersom: g4 speelt eerst zijn schild, daarna wil hij inzetten.
insert into public.match_jokers (match_id, player_id, group_id, joker) values
  ('3a000000-0000-0000-0000-00000000ef01','3a000000-0000-0000-0000-000000000304',
   '3a000000-0000-0000-0000-0000000000f3','schild');

select throws_ok(
  $$insert into public.match_stakes (match_id, player_id, group_id)
    values ('3a000000-0000-0000-0000-00000000ef01','3a000000-0000-0000-0000-000000000304',
            '3a000000-0000-0000-0000-0000000000f3')$$,
  'P0001', 'je joker staat al op deze match: trek die eerst in',
  'een lef-tip naast een schild zou geruisloos verdampen');

select lives_ok(
  $$delete from public.match_jokers
     where match_id = '3a000000-0000-0000-0000-00000000ef01'
       and player_id = '3a000000-0000-0000-0000-000000000304'$$,
  'vóór de aftrap kun je je kaart weer intrekken');

-- RLS: als u2 kun je geen kaart namens u1 spelen. De guard laat de rij door
-- (u1 speelt écht mee), dus wat hier weigert is de policy zelf.
set local role authenticated;
set local request.jwt.claims = '{"sub":"3a000000-0000-0000-0000-0000000000a2","role":"authenticated"}';

select throws_ok(
  $$insert into public.match_jokers (match_id, player_id, group_id, joker)
    values ('3a000000-0000-0000-0000-00000000ef04','3a000000-0000-0000-0000-0000000000a1',
            '3a000000-0000-0000-0000-0000000000f3','wissel_van_kant')$$,
  '42501', null,
  'je speelt alleen je eigen kaart, niet die van een ander');

reset role;

-- Na de aftrap staat de kaart vast: g2's schild op de nu afgeronde MG.
insert into public.match_jokers (match_id, player_id, group_id, joker) values
  ('3a000000-0000-0000-0000-00000000ef01','3a000000-0000-0000-0000-000000000302',
   '3a000000-0000-0000-0000-0000000000f3','schild');

update public.matches
   set status = 'completed', winner_team_id = '3a000000-0000-0000-0000-000000003002'
 where id = '3a000000-0000-0000-0000-00000000ef01';

select throws_ok(
  $$delete from public.match_jokers
     where match_id = '3a000000-0000-0000-0000-00000000ef01'
       and player_id = '3a000000-0000-0000-0000-000000000302'$$,
  'P0001', 'je joker staat vast: de match is al begonnen of afgerond',
  'een gespeelde kaart komt niet meer terug');

------------------------------------------------------------------------
-- 9. Drift: een volledige recompute moet exact hetzelfde opleveren als het
--    incrementele pad. Dat is de hele reden dat de factor een pure functie
--    van opgeslagen data is en niet ergens los wordt bijgehouden.
--
--    De bountymatch (e007) doet niet mee: recompute_ratings() bouwt elke
--    rating opnieuw op uit de matches, en de rechtstreeks gezette 1650 van s1
--    overleeft dat niet — hij is na de replay geen dictator meer. Alle andere
--    secties starten op 1000, precies de waarde die de replay zelf hanteert,
--    en zijn dus wél reproduceerbaar.
------------------------------------------------------------------------
create temp table jj_snap as
  select player_id, match_id, delta, stake_factor, joker, bounty_delta,
         rating_before, rating_after
  from public.rating_history
  where match_id in (
    '3a000000-0000-0000-0000-00000000e001','3a000000-0000-0000-0000-00000000e002',
    '3a000000-0000-0000-0000-00000000e003','3a000000-0000-0000-0000-00000000e004',
    '3a000000-0000-0000-0000-00000000e005','3a000000-0000-0000-0000-00000000e006',
    '3a000000-0000-0000-0000-00000000ef01'
  );

select is((select count(*)::int from jj_snap),
  28, 'de drift-test vergelijkt alle 28 history-rijen van de jokermatches');

select public.recompute_ratings();

select is(
  (select count(*)::int from jj_snap s
     join public.rating_history h
       on h.player_id = s.player_id and h.match_id = s.match_id
    where (h.delta, h.stake_factor, h.joker, h.bounty_delta, h.rating_before, h.rating_after)
          is distinct from
          (s.delta, s.stake_factor, s.joker, s.bounty_delta, s.rating_before, s.rating_after)),
  0, 'een volledige recompute geeft exact dezelfde jokeruitkomst als het incrementele pad');

select * from finish();

rollback;
