-- pgTAP-tests voor de RLS-hardening (audit 2026-07-01, migratie 20260701140000).
begin;

select plan(17);

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
-- friendships: de vier hardening-policies bestaan nog, plus de netwerk-select
-- uit #326 (geaccepteerde vriendschappen leesbaar zodra één partij in je
-- netwerk zit, t.b.v. de feed; verruimt de groupmates-regel van #138). Insert
-- blijft INSERT.
------------------------------------------------------------------------
select policies_are(
  'public', 'friendships',
  array[
    'Eigen vriendschappen zijn leesbaar',
    'Verzoek sturen als verzoeker',
    'Ontvanger kan verzoek beantwoorden',
    'Betrokkene kan vriendschap verwijderen',
    'friendships_select_network'
  ],
  'friendships heeft de verwachte policies'
);

select policy_cmd_is(
  'public', 'friendships', 'Verzoek sturen als verzoeker', 'INSERT',
  'friendships insert-policy geldt voor INSERT'
);

select policy_cmd_is(
  'public', 'friendships', 'friendships_select_network', 'SELECT',
  'netwerk-select-policy geldt alleen voor SELECT'
);

-- #326: de SECURITY DEFINER-helpers waarop de netwerk-policy leunt.
select has_function(
  'public', 'shares_group', array['uuid', 'uuid'],
  'functie public.shares_group(uuid, uuid) bestaat'
);
select has_function(
  'public', 'is_accepted_friend', array['uuid', 'uuid'],
  'functie public.is_accepted_friend(uuid, uuid) bestaat'
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
-- match_predictions (toto, #116): policies, guards en grading-trigger.
------------------------------------------------------------------------
select policies_are(
  'public', 'match_predictions',
  array[
    'match_predictions_select_member',
    'match_predictions_insert_own',
    'match_predictions_update_own',
    'match_predictions_delete_own'
  ],
  'match_predictions heeft de vier lidmaatschaps-policies'
);

select has_function(
  'public', 'prediction_points',
  'functie public.prediction_points() bestaat'
);

select has_trigger(
  'public', 'match_predictions', 'match_predictions_guard',
  'match_predictions valideert tips via de guard-trigger'
);

select has_trigger(
  'public', 'match_predictions', 'match_predictions_delete_guard',
  'match_predictions vergrendelt beoordeelde tips tegen verwijderen'
);

select has_trigger(
  'public', 'matches', 'matches_grade_predictions',
  'matches beoordeelt tips bij afronding/correctie'
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
      'public.match_points'::regclass,
      'public.match_predictions'::regclass
    )),
  true,
  'RLS staat aan op matches, teams, friendships, match_points en match_predictions'
);

select * from finish();

rollback;