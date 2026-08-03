-- PostgREST moet naast een RLS-policy ook een tabelgrant hebben. Deze tabellen
-- worden door de client gelezen; RLS bepaalt vervolgens welke rijen zichtbaar
-- zijn. De grant omzeilt dus geen privacy-policy.
grant select on table
  public.court_availability_snapshots,
  public.dictator_termijnen,
  public.friendships,
  public.group_members,
  public.groups,
  public.guest_claims,
  public.match_jokers,
  public.match_net_touches,
  public.match_predictions,
  public.match_smoesjes,
  public.match_stakes,
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
