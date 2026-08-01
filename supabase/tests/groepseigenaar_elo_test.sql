-- pgTAP-tests voor de Elo-gevolgen van een score-correctie door de
-- groepseigenaar (#978). De policy laat hem nu een afgeronde uitslag
-- corrigeren; deze suite legt vast dat de ratings daar correct in meebewegen.
-- Alles loopt als de eigenaar zelf, dus dwars door de RLS-policy heen.
--
-- Drie gevallen, elk met een eigen verwachting:
--   1. uitslag invullen        -> +12 / -12 (K=24, gelijke teamgemiddelden)
--   2. score corrigeren, zelfde winnaar -> ratings ONgewijzigd; Elo leest
--      alleen winner_team_id, de marge telt niet mee (matches_ratings_trigger
--      vergelijkt score_a/score_b bewust niet)
--   3. correctie die de winnaar omdraait -> volledige recompute_ratings():
--      gespiegelde uitkomst, geen dubbele history-rijen, games blijft 1
--
-- De tellingen zijn op deze ene match gefilterd: recompute_ratings() speelt
-- de hele competitie opnieuw af, dus een globale telling zou meeliften op wat
-- er verder in de database staat.
begin;

select plan(13);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
values
  ('00000000-0000-0000-0000-000000000000','e0000000-0000-0000-0000-000000000001','authenticated','authenticated','e1@test.nl','x',now(),'{}','{"username":"e1"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','e0000000-0000-0000-0000-000000000002','authenticated','authenticated','e2@test.nl','x',now(),'{}','{"username":"e2"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','e0000000-0000-0000-0000-000000000003','authenticated','authenticated','e3@test.nl','x',now(),'{}','{"username":"e3"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','e0000000-0000-0000-0000-000000000004','authenticated','authenticated','e4@test.nl','x',now(),'{}','{"username":"e4"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','e0000000-0000-0000-0000-000000000005','authenticated','authenticated','e5@test.nl','x',now(),'{}','{"username":"e5"}',now(),now(),'','','','');

insert into public.groups (id, name, created_by)
values ('e0000000-0000-0000-0000-0000000000f0','Elo-testgroep','e0000000-0000-0000-0000-000000000005');
insert into public.group_members (group_id, player_id, role)
values
  ('e0000000-0000-0000-0000-0000000000f0','e0000000-0000-0000-0000-000000000001','member'),
  ('e0000000-0000-0000-0000-0000000000f0','e0000000-0000-0000-0000-000000000002','member'),
  ('e0000000-0000-0000-0000-0000000000f0','e0000000-0000-0000-0000-000000000003','member'),
  ('e0000000-0000-0000-0000-0000000000f0','e0000000-0000-0000-0000-000000000004','member');

-- e1 plant de match; e1+e2 vs e3+e4. Datum ruim vóór de bounty-cutoff
-- (2026-07-29), zodat er geen bounty-delta doorheen fietst.
set local request.jwt.claims = '{"sub":"e0000000-0000-0000-0000-000000000001","role":"authenticated"}';
select isnt(
  public.create_planned_match(
    'e0000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-000000000002',
    'e0000000-0000-0000-0000-000000000003','e0000000-0000-0000-0000-000000000004',
    '2026-02-01 10:00:00+00','e0000000-0000-0000-0000-0000000000f0',null),
  null, 'fixture: match gepland'
);

------------------------------------------------------------------------
-- 1. De eigenaar vult de uitslag in: team A wint 6-3.
--    Iedereen start op 1000, teamgemiddelden gelijk => verwachting 0.5,
--    dus delta = K * (1 - 0.5) = 24 * 0.5 = 12.
------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"e0000000-0000-0000-0000-000000000005","role":"authenticated"}';
update public.matches
   set status = 'completed', winner_team_id = team_a_id, score_a = 6, score_b = 3
 where played_at = '2026-02-01 10:00:00+00';
reset role;

select is(
  (select rating::int from public.player_ratings where player_id = 'e0000000-0000-0000-0000-000000000001'),
  1012, 'na invullen: winnaar e1 staat op 1012'
);
select is(
  (select rating::int from public.player_ratings where player_id = 'e0000000-0000-0000-0000-000000000003'),
  988, 'na invullen: verliezer e3 staat op 988'
);
select is(
  (select count(*)::int from public.rating_history h
    join public.matches m on m.id = h.match_id
   where m.played_at = '2026-02-01 10:00:00+00'),
  4, 'na invullen: vier history-rijen (een per speler)'
);

------------------------------------------------------------------------
-- 2. Score corrigeren MET dezelfde winnaar (6-3 -> 6-4).
--    Elo leest alleen winner_team_id (K is constant, de marge telt niet
--    mee), dus de ratings horen exact gelijk te blijven.
------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"e0000000-0000-0000-0000-000000000005","role":"authenticated"}';
update public.matches
   set score_a = 6, score_b = 4
 where played_at = '2026-02-01 10:00:00+00';
reset role;

select is(
  (select score_b::int from public.matches where played_at = '2026-02-01 10:00:00+00'),
  4, 'correctie zonder winnaarswissel is doorgevoerd'
);
select is(
  (select rating::int from public.player_ratings where player_id = 'e0000000-0000-0000-0000-000000000001'),
  1012, 'zelfde winnaar: rating e1 ongewijzigd (marge telt niet mee in Elo)'
);
select is(
  (select rating::int from public.player_ratings where player_id = 'e0000000-0000-0000-0000-000000000003'),
  988, 'zelfde winnaar: rating e3 ongewijzigd'
);
select is(
  (select count(*)::int from public.rating_history h
    join public.matches m on m.id = h.match_id
   where m.played_at = '2026-02-01 10:00:00+00'),
  4, 'zelfde winnaar: geen extra history-rijen'
);

------------------------------------------------------------------------
-- 3. Correctie die de winnaar OMDRAAIT (team B wint alsnog 3-6).
--    Dit hoort een volledige recompute_ratings() uit te lokken: de oude
--    history wordt gewist en opnieuw opgebouwd, met gespiegelde uitkomst.
------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"e0000000-0000-0000-0000-000000000005","role":"authenticated"}';
update public.matches
   set winner_team_id = team_b_id, score_a = 3, score_b = 6
 where played_at = '2026-02-01 10:00:00+00';
reset role;

select is(
  (select rating::int from public.player_ratings where player_id = 'e0000000-0000-0000-0000-000000000001'),
  988, 'winnaar omgedraaid: e1 is nu verliezer en staat op 988'
);
select is(
  (select rating::int from public.player_ratings where player_id = 'e0000000-0000-0000-0000-000000000003'),
  1012, 'winnaar omgedraaid: e3 is nu winnaar en staat op 1012'
);
select is(
  (select count(*)::int from public.rating_history h
    join public.matches m on m.id = h.match_id
   where m.played_at = '2026-02-01 10:00:00+00'),
  4, 'winnaar omgedraaid: nog steeds vier history-rijen (geen duplicaten)'
);
select is(
  (select h.delta::int from public.rating_history h
    join public.matches m on m.id = h.match_id
   where m.played_at = '2026-02-01 10:00:00+00'
     and h.player_id = 'e0000000-0000-0000-0000-000000000001'),
  -12, 'winnaar omgedraaid: de history-delta van e1 is meegedraaid'
);
select is(
  (select games::int from public.player_ratings where player_id = 'e0000000-0000-0000-0000-000000000001'),
  1, 'winnaar omgedraaid: games blijft 1 (geen dubbeltelling)'
);

select * from finish();

rollback;
