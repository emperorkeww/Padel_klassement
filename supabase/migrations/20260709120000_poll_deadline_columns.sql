-- Dedup-kolommen voor de cron-meldingen van speeldag-polls (edge function
-- poll-deadline): de laatste-kans-push vóór de deadline en de herinnering op
-- de speeldag zelf mogen elk maar één keer verstuurd worden.
alter table public.play_polls
  add column deadline_notified_at timestamptz,
  add column dayof_notified_at timestamptz;
