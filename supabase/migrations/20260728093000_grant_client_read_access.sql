-- Zie schemas/policies/zz_client_read_grants.sql. Zonder deze grants faalt de
-- API vóór RLS geëvalueerd kan worden, ook wanneer er een select-policy is.
grant select on table
  public.court_availability_snapshots,
  public.dictator_termijnen,
  public.friendships,
  public.group_members,
  public.groups,
  public.guest_claims,
  public.match_predictions,
  public.match_smoesjes,
  public.matches,
  public.pias_of_week,
  public.play_poll_options,
  public.play_poll_votes,
  public.play_polls,
  public.player_ratings,
  public.profiles,
  public.push_subscriptions,
  public.rating_history,
  public.teams,
  public.vendettas,
  public.zwarte_piet
to authenticated, anon;
