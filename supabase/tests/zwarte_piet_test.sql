-- pgTAP-tests voor de Zwarte Piet (#185, #607): het rondgaande schande-token
-- per groep, herberekend door recompute_zwarte_piet via de statement-trigger
-- matches_zwarte_piet.
--
-- Gedekt: toewijzing per criterium (afdroging, bagel — incl. tie-break op
-- laagste speler-id), recency (nieuwe flopper pakt af; dezelfde drager die
-- opnieuw flopt houdt since/match), verlossing zodra de drager wint,
-- de null-safe verlossing bij een singles-winnaar (player2_id is null zou
-- met "in (..., null)" nooit verlossen — regressie uit de 1v1-migratie),
-- en isolatie tussen groepen.
--
-- Tijdlijn: anker = maandag over twee weken (zoals pias_test), zodat onze
-- matches gegarandeerd ná eventuele seed-matches in de Elo-keten sorteren.
begin;

select plan(20);

------------------------------------------------------------------------
-- Fixtures (als superuser). De trigger handle_new_user maakt de profielen.
-- Speler-id's oplopend (e..01 < e..02 < e..03 < e..04) zodat de tie-break
-- "laagste id" in de asserts voorspelbaar is.
------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
values
  ('00000000-0000-0000-0000-000000000000','e0000000-0000-0000-0000-000000000001','authenticated','authenticated','z1@test.nl','x',now(),'{}','{"username":"z1"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','e0000000-0000-0000-0000-000000000002','authenticated','authenticated','z2@test.nl','x',now(),'{}','{"username":"z2"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','e0000000-0000-0000-0000-000000000003','authenticated','authenticated','z3@test.nl','x',now(),'{}','{"username":"z3"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','e0000000-0000-0000-0000-000000000004','authenticated','authenticated','z4@test.nl','x',now(),'{}','{"username":"z4"}',now(),now(),'','','','');

-- Groep G1 met z1 als eigenaar (trigger voegt z1 toe) + z2..z4 als leden;
-- groep G2 idem, voor de isolatie-test.
insert into public.groups (id, name, created_by)
values
  ('e0000000-0000-0000-0000-0000000000e1','Pietgroep',   'e0000000-0000-0000-0000-000000000001'),
  ('e0000000-0000-0000-0000-0000000000e2','Andere groep','e0000000-0000-0000-0000-000000000001');
insert into public.group_members (group_id, player_id, role)
select g, p, 'member'
from (values ('e0000000-0000-0000-0000-0000000000e1'::uuid),
             ('e0000000-0000-0000-0000-0000000000e2'::uuid)) gs(g)
cross join (values ('e0000000-0000-0000-0000-000000000002'::uuid),
                   ('e0000000-0000-0000-0000-000000000003'::uuid),
                   ('e0000000-0000-0000-0000-000000000004'::uuid)) ps(p);

-- Teams: AB = z1+z2, CD = z3+z4, plus singles-teams voor z3 en z4.
insert into public.teams (id, player1_id, player2_id)
values
  ('ea000000-0000-0000-0000-00000000000a','e0000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-000000000002'),
  ('ea000000-0000-0000-0000-00000000000b','e0000000-0000-0000-0000-000000000003','e0000000-0000-0000-0000-000000000004'),
  ('ea000000-0000-0000-0000-00000000000c','e0000000-0000-0000-0000-000000000003',null),
  ('ea000000-0000-0000-0000-00000000000d','e0000000-0000-0000-0000-000000000004',null);

------------------------------------------------------------------------
-- 0. De trigger zelf: zonder matches_zwarte_piet wordt de tabel nooit
--    bijgewerkt (drift-guard, zie #607).
------------------------------------------------------------------------
select has_trigger('public', 'matches', 'matches_zwarte_piet',
  'statement-trigger matches_zwarte_piet bestaat op matches');

------------------------------------------------------------------------
-- 1. Isolatie-fixture: in G2 slikken z3+z4 een bagel → G2-piet = z3.
--    (Assert volgt helemaal aan het einde: G1-verkeer mag hier niet aankomen.)
------------------------------------------------------------------------
insert into public.matches (id, team_a_id, team_b_id, group_id, status, winner_team_id, score_a, score_b, played_at)
values ('ec000000-0000-0000-0000-000000000009',
        'ea000000-0000-0000-0000-00000000000a','ea000000-0000-0000-0000-00000000000b',
        'e0000000-0000-0000-0000-0000000000e2','completed',
        'ea000000-0000-0000-0000-00000000000a', 6, 0,
        date_trunc('week', now()) + interval '14 days' + interval '9 hours');

------------------------------------------------------------------------
-- 2. Geen kwalificerende afgang: twee nipte zeges van AB op CD in G1
--    (verschil 2, reeks < 3) laten de Piet vrij.
------------------------------------------------------------------------
insert into public.matches (id, team_a_id, team_b_id, group_id, status, winner_team_id, score_a, score_b, played_at)
values
  ('ec000000-0000-0000-0000-000000000001',
   'ea000000-0000-0000-0000-00000000000a','ea000000-0000-0000-0000-00000000000b',
   'e0000000-0000-0000-0000-0000000000e1','completed',
   'ea000000-0000-0000-0000-00000000000a', 6, 4,
   date_trunc('week', now()) + interval '14 days' + interval '10 hours'),
  ('ec000000-0000-0000-0000-000000000002',
   'ea000000-0000-0000-0000-00000000000a','ea000000-0000-0000-0000-00000000000b',
   'e0000000-0000-0000-0000-0000000000e1','completed',
   'ea000000-0000-0000-0000-00000000000a', 6, 4,
   date_trunc('week', now()) + interval '14 days' + interval '11 hours');

select is((select count(*)::int from public.zwarte_piet
    where group_id = 'e0000000-0000-0000-0000-0000000000e1'),
  0, 'nipte nederlagen zonder criterium: de Piet blijft vrij');

------------------------------------------------------------------------
-- 3. Afdroging: AB wint met 6-2 (verschil 4) → de Piet gaat naar z3
--    (tie met z4 op ernst 54 → laagste id wint).
------------------------------------------------------------------------
insert into public.matches (id, team_a_id, team_b_id, group_id, status, winner_team_id, score_a, score_b, played_at)
values ('ec000000-0000-0000-0000-000000000003',
        'ea000000-0000-0000-0000-00000000000a','ea000000-0000-0000-0000-00000000000b',
        'e0000000-0000-0000-0000-0000000000e1','completed',
        'ea000000-0000-0000-0000-00000000000a', 6, 2,
        date_trunc('week', now()) + interval '15 days' + interval '10 hours');

select is((select holder_id from public.zwarte_piet
    where group_id = 'e0000000-0000-0000-0000-0000000000e1'),
  'e0000000-0000-0000-0000-000000000003',
  'afdroging (verschil 4) wijst de Piet toe; tie-break kiest het laagste speler-id');
select is((select reden from public.zwarte_piet
    where group_id = 'e0000000-0000-0000-0000-0000000000e1'),
  'afdroging', 'de reden is afdroging');
select is((select ernst from public.zwarte_piet
    where group_id = 'e0000000-0000-0000-0000-0000000000e1'),
  54, 'ernst = 50 + games verschil (4)');
select ok((select from_id from public.zwarte_piet
    where group_id = 'e0000000-0000-0000-0000-0000000000e1') is null,
  'eerste drager: geen vorige drager');
select is((select match_id from public.zwarte_piet
    where group_id = 'e0000000-0000-0000-0000-0000000000e1'),
  'ec000000-0000-0000-0000-000000000003', 'de Piet hangt aan de afdroging-match');
select is((select since from public.zwarte_piet
    where group_id = 'e0000000-0000-0000-0000-0000000000e1'),
  (date_trunc('week', now()) + interval '15 days')::date,
  'since is de speeldag van de afgang');

------------------------------------------------------------------------
-- 4. Recency: CD droogt AB af met een bagel (0-6) → z1 pakt de Piet
--    (bagel 110 verslaat alles; tie z1/z2 → laagste id), from = z3.
------------------------------------------------------------------------
insert into public.matches (id, team_a_id, team_b_id, group_id, status, winner_team_id, score_a, score_b, played_at)
values ('ec000000-0000-0000-0000-000000000004',
        'ea000000-0000-0000-0000-00000000000a','ea000000-0000-0000-0000-00000000000b',
        'e0000000-0000-0000-0000-0000000000e1','completed',
        'ea000000-0000-0000-0000-00000000000b', 0, 6,
        date_trunc('week', now()) + interval '16 days' + interval '10 hours');

select is((select holder_id from public.zwarte_piet
    where group_id = 'e0000000-0000-0000-0000-0000000000e1'),
  'e0000000-0000-0000-0000-000000000001',
  'een nieuwe flopper pakt de Piet af (bagel)');
select is((select reden from public.zwarte_piet
    where group_id = 'e0000000-0000-0000-0000-0000000000e1'),
  'bagel', 'de reden is bagel');
select is((select from_id from public.zwarte_piet
    where group_id = 'e0000000-0000-0000-0000-0000000000e1'),
  'e0000000-0000-0000-0000-000000000003', 'from_id wijst naar de vorige drager');

------------------------------------------------------------------------
-- 5. Dezelfde drager flopt opnieuw (weer 0-6): hij houdt de Piet en
--    since/match_id blijven van de eerste afgang.
------------------------------------------------------------------------
insert into public.matches (id, team_a_id, team_b_id, group_id, status, winner_team_id, score_a, score_b, played_at)
values ('ec000000-0000-0000-0000-000000000005',
        'ea000000-0000-0000-0000-00000000000a','ea000000-0000-0000-0000-00000000000b',
        'e0000000-0000-0000-0000-0000000000e1','completed',
        'ea000000-0000-0000-0000-00000000000b', 0, 6,
        date_trunc('week', now()) + interval '17 days' + interval '10 hours');

select is((select holder_id from public.zwarte_piet
    where group_id = 'e0000000-0000-0000-0000-0000000000e1'),
  'e0000000-0000-0000-0000-000000000001',
  'dezelfde flopper houdt de Piet');
select is((select since from public.zwarte_piet
    where group_id = 'e0000000-0000-0000-0000-0000000000e1'),
  (date_trunc('week', now()) + interval '16 days')::date,
  'since blijft de dag van de eerste afgang lopen');
select is((select match_id from public.zwarte_piet
    where group_id = 'e0000000-0000-0000-0000-0000000000e1'),
  'ec000000-0000-0000-0000-000000000004',
  'match_id blijft de eerste afgang-match');

------------------------------------------------------------------------
-- 6. Verlossing: de drager (z1) wint zonder dat iemand kwalificerend
--    flopt (6-4) → de Piet is vrij.
------------------------------------------------------------------------
insert into public.matches (id, team_a_id, team_b_id, group_id, status, winner_team_id, score_a, score_b, played_at)
values ('ec000000-0000-0000-0000-000000000006',
        'ea000000-0000-0000-0000-00000000000a','ea000000-0000-0000-0000-00000000000b',
        'e0000000-0000-0000-0000-0000000000e1','completed',
        'ea000000-0000-0000-0000-00000000000a', 6, 4,
        date_trunc('week', now()) + interval '18 days' + interval '10 hours');

select is((select count(*)::int from public.zwarte_piet
    where group_id = 'e0000000-0000-0000-0000-0000000000e1'),
  0, 'de drager wint en flopt niet: verlost, de Piet is vrij');

------------------------------------------------------------------------
-- 7. Singles: z4 bagelt z3 in een 1v1 → z3 draagt de Piet.
------------------------------------------------------------------------
insert into public.matches (id, team_a_id, team_b_id, group_id, status, winner_team_id, score_a, score_b, played_at, format)
values ('ec000000-0000-0000-0000-000000000007',
        'ea000000-0000-0000-0000-00000000000c','ea000000-0000-0000-0000-00000000000d',
        'e0000000-0000-0000-0000-0000000000e1','completed',
        'ea000000-0000-0000-0000-00000000000d', 0, 6,
        date_trunc('week', now()) + interval '19 days' + interval '10 hours', '1v1');

select is((select holder_id from public.zwarte_piet
    where group_id = 'e0000000-0000-0000-0000-0000000000e1'),
  'e0000000-0000-0000-0000-000000000003',
  'een singles-bagel wijst de Piet toe');
select is((select reden from public.zwarte_piet
    where group_id = 'e0000000-0000-0000-0000-0000000000e1'),
  'bagel', 'ook in 1v1 telt de bagel');

------------------------------------------------------------------------
-- 8. Null-safe verlossing bij een singles-winnaar: z3 wint een 1v1 met
--    6-4. Het winnende team heeft player2_id null; "v_holder in (win_p1,
--    win_p2)" zou dan naar null evalueren en nooit verlossen (1v1-regressie).
------------------------------------------------------------------------
insert into public.matches (id, team_a_id, team_b_id, group_id, status, winner_team_id, score_a, score_b, played_at, format)
values ('ec000000-0000-0000-0000-000000000008',
        'ea000000-0000-0000-0000-00000000000c','ea000000-0000-0000-0000-00000000000d',
        'e0000000-0000-0000-0000-0000000000e1','completed',
        'ea000000-0000-0000-0000-00000000000c', 6, 4,
        date_trunc('week', now()) + interval '20 days' + interval '10 hours', '1v1');

select is((select count(*)::int from public.zwarte_piet
    where group_id = 'e0000000-0000-0000-0000-0000000000e1'),
  0, 'de drager wint een singles: null-safe verlost, de Piet is vrij');

------------------------------------------------------------------------
-- 9. Isolatie: G2 heeft al het G1-verkeer overleefd met dezelfde drager.
------------------------------------------------------------------------
select is((select holder_id from public.zwarte_piet
    where group_id = 'e0000000-0000-0000-0000-0000000000e2'),
  'e0000000-0000-0000-0000-000000000003',
  'de Piet van een andere groep blijft onaangeroerd staan');
select is((select match_id from public.zwarte_piet
    where group_id = 'e0000000-0000-0000-0000-0000000000e2'),
  'ec000000-0000-0000-0000-000000000009',
  'en hangt nog aan zijn eigen match');

select * from finish();

rollback;
