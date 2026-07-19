-- pgTAP-tests voor de troon met machtsbehoud (#545): de succession-replay
-- recompute_dictator_termijnen(). We schakelen de match-triggers uit en spelen
-- een rating_history-tijdlijn met de hand, zodat we ratings exact over/onder de
-- 1600-drempel kunnen sturen zonder tientallen echte matches te hoeven spelen.
-- Elke "match" draagt hier één rating_after-event voor één speler; de replay
-- houdt per speler de laatste rating vast (rating tussen matches blijft staan).
begin;

select plan(11);

------------------------------------------------------------------------
-- Fixtures. handle_new_user maakt de profielen; created_at bepaalt de
-- "langste lid"-tie-break, dus die zetten we expliciet (A oudste → R jongste).
------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
values
  ('00000000-0000-0000-0000-000000000000','d0000000-0000-0000-0000-00000000000a','authenticated','authenticated','da@test.nl','x',now(),'{}','{"username":"dictA"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','d0000000-0000-0000-0000-00000000000b','authenticated','authenticated','db@test.nl','x',now(),'{}','{"username":"dictB"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','d0000000-0000-0000-0000-00000000000c','authenticated','authenticated','dp@test.nl','x',now(),'{}','{"username":"dictP"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','d0000000-0000-0000-0000-00000000000d','authenticated','authenticated','dq@test.nl','x',now(),'{}','{"username":"dictQ"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','d0000000-0000-0000-0000-00000000000e','authenticated','authenticated','dr@test.nl','x',now(),'{}','{"username":"dictR"}',now(),now(),'','','','');

update public.profiles set created_at = timestamptz '2020-01-01' where id = 'd0000000-0000-0000-0000-00000000000a';
update public.profiles set created_at = timestamptz '2020-02-01' where id = 'd0000000-0000-0000-0000-00000000000b';
update public.profiles set created_at = timestamptz '2020-03-01' where id = 'd0000000-0000-0000-0000-00000000000c';
update public.profiles set created_at = timestamptz '2020-04-01' where id = 'd0000000-0000-0000-0000-00000000000d';
update public.profiles set created_at = timestamptz '2020-05-01' where id = 'd0000000-0000-0000-0000-00000000000e';

-- Twee teams; welke spelers erin zitten maakt niet uit — de replay leest de
-- ratings uit rating_history, niet uit de teams/winner.
insert into public.teams (id, player1_id, player2_id)
values
  ('dd000000-0000-0000-0000-0000000000a1','d0000000-0000-0000-0000-00000000000a','d0000000-0000-0000-0000-00000000000b'),
  ('dd000000-0000-0000-0000-0000000000b2','d0000000-0000-0000-0000-00000000000c','d0000000-0000-0000-0000-00000000000d');

-- Triggers uit: we injecteren rating_history met de hand en willen niet dat de
-- Elo-recompute (of pias/zwarte_piet) 'm overschrijft.
alter table public.matches disable trigger user;

-- Draag-matches m1..m10 (played_at strikt oplopend), enkel als kapstok voor de
-- rating_history-events. status=completed zodat de replay ze meepakt.
insert into public.matches (id, team_a_id, team_b_id, status, played_at)
select ('dd000000-0000-0000-0000-0000000000' || lpad(g::text, 2, '0'))::uuid,
       'dd000000-0000-0000-0000-0000000000a1','dd000000-0000-0000-0000-0000000000b2',
       'completed', timestamptz '2025-01-01 12:00:00' + (g || ' hours')::interval
from generate_series(1, 10) g;

-- Helper: injecteer één rating_after-event (rating_before/delta doen er voor de
-- replay niet toe).
create or replace function pg_temp.ev(p_match int, p_player uuid, p_rating int)
returns void language sql as $$
  insert into public.rating_history (player_id, match_id, rating_before, rating_after, delta, played_at)
  values (p_player, ('dd000000-0000-0000-0000-0000000000' || lpad(p_match::text, 2, '0'))::uuid,
          p_rating, p_rating, 0, timestamptz '2025-01-01 12:00:00' + (p_match || ' hours')::interval);
$$;

-- Helper: huidige (open) troonhouder.
create or replace function pg_temp.zittend()
returns uuid language sql as $$
  select profile_id from public.dictator_termijnen where eindigde_op is null;
$$;

------------------------------------------------------------------------
-- Scenario 1: A klimt als eerste naar 1610 → A = dictator.
------------------------------------------------------------------------
select pg_temp.ev(1, 'd0000000-0000-0000-0000-00000000000a', 1610);
select public.recompute_dictator_termijnen();
select is(pg_temp.zittend(), 'd0000000-0000-0000-0000-00000000000a'::uuid,
  'scenario 1: A pakt als eerste 1600+ de troon');

------------------------------------------------------------------------
-- Scenario 2: B naar 1605 (1600+, maar < A) → A blijft, B niet.
------------------------------------------------------------------------
select pg_temp.ev(2, 'd0000000-0000-0000-0000-00000000000b', 1605);
select public.recompute_dictator_termijnen();
select is(pg_temp.zittend(), 'd0000000-0000-0000-0000-00000000000a'::uuid,
  'scenario 2: lagere 1600+-uitdager onttroont de zittende niet');

------------------------------------------------------------------------
-- Scenario 3: B naar 1620 (> A) → B wordt dictator, A afgezet.
------------------------------------------------------------------------
select pg_temp.ev(3, 'd0000000-0000-0000-0000-00000000000b', 1620);
select public.recompute_dictator_termijnen();
select is(pg_temp.zittend(), 'd0000000-0000-0000-0000-00000000000b'::uuid,
  'scenario 3: strikt hogere uitdager pakt de troon over');
select is((select count(*)::int from public.dictator_termijnen
    where profile_id = 'd0000000-0000-0000-0000-00000000000a' and eindigde_op is not null),
  1, 'scenario 3: A heeft nu een afgesloten termijn');

------------------------------------------------------------------------
-- Scenario 4: A evenaart B exact (beiden 1620) → B (zittend) houdt de troon.
------------------------------------------------------------------------
select pg_temp.ev(4, 'd0000000-0000-0000-0000-00000000000a', 1620);
select public.recompute_dictator_termijnen();
select is(pg_temp.zittend(), 'd0000000-0000-0000-0000-00000000000b'::uuid,
  'scenario 4: bij exact gelijke stand wint de zittende de tie');

------------------------------------------------------------------------
-- Scenario 5: zittende B zakt naar 1590, A staat op 1620 → troon vacant → A.
------------------------------------------------------------------------
select pg_temp.ev(5, 'd0000000-0000-0000-0000-00000000000b', 1590);
select public.recompute_dictator_termijnen();
select is(pg_temp.zittend(), 'd0000000-0000-0000-0000-00000000000a'::uuid,
  'scenario 5: zakt de zittende <1600, dan pakt de hoogste andere 1600+ de troon');

------------------------------------------------------------------------
-- Scenario 6: enige 1600+-speler zakt onder 1600, niemand anders 1600+ → leeg.
------------------------------------------------------------------------
select pg_temp.ev(6, 'd0000000-0000-0000-0000-00000000000a', 1500);
select public.recompute_dictator_termijnen();
select is((select count(*)::int from public.dictator_termijnen where eindigde_op is null),
  0, 'scenario 6: niemand 1600+ → troon vacant (geen open termijn)');

------------------------------------------------------------------------
-- Vacante tie-break: langste lid wint. P en Q staan gelijk op 1650 wanneer
-- de zittende R wegvalt; P is langer lid dan Q → P.
------------------------------------------------------------------------
select pg_temp.ev(7, 'd0000000-0000-0000-0000-00000000000c', 1650);
select pg_temp.ev(8, 'd0000000-0000-0000-0000-00000000000d', 1650);
select public.recompute_dictator_termijnen();
select is(pg_temp.zittend(), 'd0000000-0000-0000-0000-00000000000c'::uuid,
  'tie-break: P claimt als eerste 1650, Q evenaart maar onttroont niet');

select pg_temp.ev(9, 'd0000000-0000-0000-0000-00000000000e', 1700);
select public.recompute_dictator_termijnen();
select is(pg_temp.zittend(), 'd0000000-0000-0000-0000-00000000000e'::uuid,
  'tie-break: R (1700) neemt de troon over van P');

select pg_temp.ev(10, 'd0000000-0000-0000-0000-00000000000e', 1400);
select public.recompute_dictator_termijnen();
select is(pg_temp.zittend(), 'd0000000-0000-0000-0000-00000000000c'::uuid,
  'tie-break: R valt weg, P en Q gelijk op 1650 → langste lid (P) pakt de troon');
select is((select claim_rating from public.dictator_termijnen
    where profile_id = 'd0000000-0000-0000-0000-00000000000c' and eindigde_op is null),
  1650, 'tie-break: de nieuwe claim registreert de rating (1650)');

select * from finish();

rollback;
