-- Clientqueries naar views lopen via PostgREST als anon/authenticated. Views
-- krijgen niet automatisch een leesgrant wanneer ze worden aangemaakt.
grant select on public.player_standings to authenticated, anon;
grant select on public.standings to authenticated, anon;
grant select on public.group_player_standings to authenticated, anon;
grant select on public.group_prediction_standings to authenticated, anon;
