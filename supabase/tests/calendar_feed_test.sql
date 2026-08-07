-- pgTAP-tests voor het agenda-abonnement (#1099).
--
-- Scenario: u1 zit in twee groepen — één die op de thuisclub speelt
-- (Europe/Brussels) en één op een club in Madeira (Atlantic/Madeira, UTC+1 in
-- de zomer waar Brussel op UTC+2 zit). u9 is een buitenstaander.
--
-- Getest wordt wat de feed wel en niet mag teruggeven: alleen vastgelegde en
-- geboekte speeldagen, alleen binnen het venster, alleen van je eigen groepen,
-- nooit de toegangscode, en het tijdstip in de zone van díe club. Plus het
-- token: intrekken maakt de oude URL dood, en een onbekend token krijgt
-- hetzelfde antwoord als een ingetrokken.
begin;

select plan(17);

------------------------------------------------------------------------
-- Fixtures (als superuser). De trigger handle_new_user maakt de profielen.
------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
values
  ('00000000-0000-0000-0000-000000000000','c0990000-0000-0000-0000-000000000001','authenticated','authenticated','c1@test.nl','x',now(),'{}','{"username":"c1"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','c0990000-0000-0000-0000-000000000009','authenticated','authenticated','c9@test.nl','x',now(),'{}','{"username":"c9"}',now(),now(),'','','','');

insert into public.groups (id, name, created_by)
values
  ('c0990000-0000-0000-0000-0000000000f1','Vrijdagavond','c0990000-0000-0000-0000-000000000001'),
  ('c0990000-0000-0000-0000-0000000000f2','Madeira-ploeg','c0990000-0000-0000-0000-000000000001'),
  ('c0990000-0000-0000-0000-0000000000f3','Zonder mij','c0990000-0000-0000-0000-000000000009');

-- De maker wordt door een trigger al eigenaar; conflict dus negeren.
insert into public.group_members (group_id, player_id, role)
values
  ('c0990000-0000-0000-0000-0000000000f1','c0990000-0000-0000-0000-000000000001','owner'),
  ('c0990000-0000-0000-0000-0000000000f2','c0990000-0000-0000-0000-000000000001','member'),
  ('c0990000-0000-0000-0000-0000000000f3','c0990000-0000-0000-0000-000000000009','owner')
on conflict do nothing;

-- Vier polls: geboekt (Brussel), vastgelegd (Madeira), open, geannuleerd.
-- Plus één geboekte poll in een groep waar u1 niet in zit.
insert into public.play_polls (
  id, group_id, created_by, status, club_id, club_name, club_city, club_timezone,
  access_code, courts, booked_at
)
values
  ('c0990000-0000-0000-0000-0000000000a1','c0990000-0000-0000-0000-0000000000f1','c0990000-0000-0000-0000-000000000001','booked','t1','LAGO Beveren','Beveren','Europe/Brussels','4821','3 & 4', now()),
  ('c0990000-0000-0000-0000-0000000000a2','c0990000-0000-0000-0000-0000000000f2','c0990000-0000-0000-0000-000000000001','locked','t2','Funchal Padel','Funchal','Atlantic/Madeira',null,null,null),
  ('c0990000-0000-0000-0000-0000000000a3','c0990000-0000-0000-0000-0000000000f1','c0990000-0000-0000-0000-000000000001','open','t1','LAGO Beveren','Beveren','Europe/Brussels',null,null,null),
  ('c0990000-0000-0000-0000-0000000000a4','c0990000-0000-0000-0000-0000000000f2','c0990000-0000-0000-0000-000000000001','cancelled','t1','LAGO Beveren','Beveren','Europe/Brussels',null,null,null),
  ('c0990000-0000-0000-0000-0000000000a5','c0990000-0000-0000-0000-0000000000f3','c0990000-0000-0000-0000-000000000009','booked','t1','LAGO Beveren','Beveren','Europe/Brussels',null,null, now());

insert into public.play_poll_options (id, poll_id, group_id, date, start_time, duration)
values
  ('c0990000-0000-0000-0000-0000000000b1','c0990000-0000-0000-0000-0000000000a1','c0990000-0000-0000-0000-0000000000f1','2026-08-14','20:00',90),
  ('c0990000-0000-0000-0000-0000000000b2','c0990000-0000-0000-0000-0000000000a2','c0990000-0000-0000-0000-0000000000f2','2026-08-15','20:00',90),
  ('c0990000-0000-0000-0000-0000000000b3','c0990000-0000-0000-0000-0000000000a3','c0990000-0000-0000-0000-0000000000f1','2026-08-16','20:00',90),
  ('c0990000-0000-0000-0000-0000000000b4','c0990000-0000-0000-0000-0000000000a4','c0990000-0000-0000-0000-0000000000f2','2026-08-17','20:00',90),
  ('c0990000-0000-0000-0000-0000000000b5','c0990000-0000-0000-0000-0000000000a5','c0990000-0000-0000-0000-0000000000f3','2026-08-18','20:00',90),
  -- Ver buiten het venster: dezelfde geboekte poll, tweede kandidaat-moment.
  ('c0990000-0000-0000-0000-0000000000b6','c0990000-0000-0000-0000-0000000000a1','c0990000-0000-0000-0000-0000000000f1','2027-08-14','20:00',90);

update public.play_polls set locked_option_id = 'c0990000-0000-0000-0000-0000000000b1' where id = 'c0990000-0000-0000-0000-0000000000a1';
update public.play_polls set locked_option_id = 'c0990000-0000-0000-0000-0000000000b2' where id = 'c0990000-0000-0000-0000-0000000000a2';
update public.play_polls set locked_option_id = 'c0990000-0000-0000-0000-0000000000b4' where id = 'c0990000-0000-0000-0000-0000000000a4';
update public.play_polls set locked_option_id = 'c0990000-0000-0000-0000-0000000000b5' where id = 'c0990000-0000-0000-0000-0000000000a5';

------------------------------------------------------------------------
-- 1. Een link uitgeven en zien
------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"c0990000-0000-0000-0000-000000000001","role":"authenticated"}';

select isnt(public.rotate_calendar_feed(), null, 'rotate geeft een token terug');

select is(
  (select count(*)::int from public.calendar_feeds where revoked_at is null),
  1, 'er staat precies één lopende link');

-- Nog een keer draaien trekt de vorige in: een gelekte link mag niet blijven
-- werken naast de nieuwe.
select lives_ok(
  $$ select public.rotate_calendar_feed() $$,
  'een nieuwe link uitgeven mag altijd');
select is(
  (select count(*)::int from public.calendar_feeds where revoked_at is null),
  1, 'de vorige link is ingetrokken');
select is(
  (select count(*)::int from public.calendar_feeds where revoked_at is not null),
  1, 'de ingetrokken link blijft als historie staan');

------------------------------------------------------------------------
-- 2. Andermans links zijn onzichtbaar (RLS)
------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"c0990000-0000-0000-0000-000000000009","role":"authenticated"}';
select is(
  (select count(*)::int from public.calendar_feeds),
  0, 'een andere speler ziet je agenda-links niet');

set local request.jwt.claims = '{"sub":"c0990000-0000-0000-0000-000000000001","role":"authenticated"}';
select is(
  (select count(*)::int from public.calendar_feeds),
  2, 'je ziet je eigen links wel, ingetrokken en al');

------------------------------------------------------------------------
-- 3. Wat de feed teruggeeft
------------------------------------------------------------------------
-- Vanaf hier als anon: dat is wat een agenda-app is. De twee tokens eerst
-- opzijzetten (als superuser, want anon ziet de tabel niet).
reset role;
create temporary table t_token on commit drop as
  select token from public.calendar_feeds
  where player_id = 'c0990000-0000-0000-0000-000000000001' and revoked_at is null;
create temporary table t_oud on commit drop as
  select token from public.calendar_feeds
  where player_id = 'c0990000-0000-0000-0000-000000000001' and revoked_at is not null;
grant select on t_token, t_oud to anon;

set local role anon;

select is(
  jsonb_array_length(
    public.calendar_feed_events((select token from t_token), '2026-08-01', '2026-08-31')
  ),
  2, 'alleen de geboekte en de vastgelegde speeldag staan erin');

select is(
  (select e ->> 'group_name'
   from jsonb_array_elements(
     public.calendar_feed_events((select token from t_token), '2026-08-01', '2026-08-31')
   ) as e
   order by e ->> 'starts_at'
   limit 1),
  'Vrijdagavond', 'de eerste is de speeldag van vrijdag, met groepsnaam');

-- De open poll (16 aug), de geannuleerde (17 aug) en de speeldag van een groep
-- waar deze speler niet in zit (18 aug) horen er geen van drieën in.
select is(
  (select count(*)::int
   from jsonb_array_elements(
     public.calendar_feed_events((select token from t_token), '2026-08-01', '2026-08-31')
   ) as e
   where (e ->> 'starts_at')::timestamptz >= '2026-08-16'::date),
  0, 'open, geannuleerd en andermans speeldagen blijven weg');

select is(
  (select count(*)::int
   from jsonb_array_elements(
     public.calendar_feed_events((select token from t_token), '2026-08-01', '2026-08-31')
   ) as e
   where e ? 'access_code'),
  0, 'de toegangscode staat niet in de feed (#675)');

select is(
  (select e ->> 'courts'
   from jsonb_array_elements(
     public.calendar_feed_events((select token from t_token), '2026-08-01', '2026-08-31')
   ) as e
   where e ->> 'poll_id' = 'c0990000-0000-0000-0000-0000000000a1'),
  '3 & 4', 'de banen (#802) staan er wél in');

-- Het venster begrenst: het tweede moment van dezelfde poll ligt een jaar later.
select is(
  jsonb_array_length(
    public.calendar_feed_events((select token from t_token), '2027-01-01', '2027-12-31')
  ),
  0, 'buiten het venster geeft de feed niets — ook niet van dezelfde poll');

------------------------------------------------------------------------
-- 4. De tijdzone van díe club, niet die van de thuisclub
------------------------------------------------------------------------
-- 14 aug 2026 20:00 in Brussel = 18:00 UTC (zomertijd, UTC+2).
select is(
  (select (e ->> 'starts_at')::timestamptz
   from jsonb_array_elements(
     public.calendar_feed_events((select token from t_token), '2026-08-01', '2026-08-31')
   ) as e
   where e ->> 'poll_id' = 'c0990000-0000-0000-0000-0000000000a1'),
  '2026-08-14 18:00:00+00'::timestamptz,
  'een speeldag op de thuisclub staat op het juiste UTC-moment');

-- 15 aug 2026 20:00 in Funchal = 19:00 UTC (UTC+1 in de zomer). Vóór #1099 zou
-- de vaste TZID uit ics.ts hier een uur naast liggen.
select is(
  (select (e ->> 'starts_at')::timestamptz
   from jsonb_array_elements(
     public.calendar_feed_events((select token from t_token), '2026-08-01', '2026-08-31')
   ) as e
   where e ->> 'poll_id' = 'c0990000-0000-0000-0000-0000000000a2'),
  '2026-08-15 19:00:00+00'::timestamptz,
  'een club buiten Europe/Brussels rekent in zijn eigen zone');

------------------------------------------------------------------------
-- 5. Onbekend en ingetrokken geven hetzelfde: niets
------------------------------------------------------------------------
select is(
  public.calendar_feed_events('c0990000-0000-0000-0000-00000000dead', '2026-08-01', '2026-08-31'),
  null, 'een onbekend token levert NULL');

select is(
  public.calendar_feed_events(
    (select token from t_oud limit 1), '2026-08-01', '2026-08-31'
  ),
  null, 'een ingetrokken token levert hetzelfde NULL — geen onderscheid');

select * from finish();

rollback;
