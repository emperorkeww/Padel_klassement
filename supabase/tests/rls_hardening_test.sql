-- pgTAP-tests voor de RLS-hardening (audit 2026-07-01, migratie 20260701140000).
begin;

select plan(9);

------------------------------------------------------------------------
-- matches: geen directe INSERT-policy meer; enkel SELECT + UPDATE.
------------------------------------------------------------------------
select policies_are(
  'public', 'matches',
  array[
    'Matches zijn publiek leesbaar',
    'Aanmaker kan match bijwerken'
  ],
  'matches heeft geen directe INSERT-policy meer (creatie loopt via RPC)'
);

------------------------------------------------------------------------
-- teams: enkel nog publiek leesbaar; geen directe INSERT/UPDATE.
------------------------------------------------------------------------
select policies_are(
  'public', 'teams',
  array[ 'Teams zijn publiek leesbaar' ],
  'teams heeft geen directe INSERT/UPDATE-policy meer (creatie via _ensure_team)'
);

------------------------------------------------------------------------
-- friendships: alle vier de policies bestaan nog, insert blijft INSERT.
------------------------------------------------------------------------
select policies_are(
  'public', 'friendships',
  array[
    'Eigen vriendschappen zijn leesbaar',
    'Verzoek sturen als verzoeker',
    'Ontvanger kan verzoek beantwoorden',
    'Betrokkene kan vriendschap verwijderen'
  ],
  'friendships heeft de verwachte policies'
);

select policy_cmd_is(
  'public', 'friendships', 'Verzoek sturen als verzoeker', 'INSERT',
  'friendships insert-policy geldt voor INSERT'
);

------------------------------------------------------------------------
-- Triggers + functies uit de hardening bestaan.
------------------------------------------------------------------------
select has_function(
  'public', 'friendships_freeze_participants',
  'functie public.friendships_freeze_participants() bestaat'
);

select has_trigger(
  'public', 'friendships', 'friendships_freeze_participants',
  'friendships heeft een freeze-trigger op (requester_id, addressee_id)'
);

select has_function(
  'public', 'match_points_validate_team',
  'functie public.match_points_validate_team() bestaat'
);

select has_trigger(
  'public', 'match_points', 'match_points_validate_team',
  'match_points valideert won_by_team_id tegen de match-teams'
);

------------------------------------------------------------------------
-- RLS staat nog steeds aan op de gehardde tabellen.
------------------------------------------------------------------------
select is(
  (select bool_and(relrowsecurity)
     from pg_class
    where oid in (
      'public.matches'::regclass,
      'public.teams'::regclass,
      'public.friendships'::regclass,
      'public.match_points'::regclass
    )),
  true,
  'RLS staat aan op matches, teams, friendships en match_points'
);

select * from finish();

rollback;