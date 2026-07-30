-- pg_cron-planning voor de speeldag-poll-automatiek (laatste-kans-push,
-- auto-sluiten, speeldag-herinnering en het automatisch klaarzetten van de
-- Americano-rondes). Eén keer uitvoeren in de SQL-editor van je GEHOSTE
-- project. Zelfde patroon en secrets als match_reminder_cron.sql.
--
-- Vooraf, in de terminal:
--   supabase functions deploy poll-deadline --no-verify-jwt
--   (CRON_SECRET en VAPID_* staan er al voor match-reminders; optioneel:
--    POLL_LAST_CALL_HOURS=24, POLL_AUTO_LOCK_HOURS=12, POLL_DAY_OF_HOURS=5,
--    POLL_ROUNDS_AT=08:00, POLL_ROUNDS_LEAD_MIN=90)

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Elk uur is ruim voldoende voor deadlines op uur-granulariteit.
select cron.schedule(
  'poll-deadline',
  '5 * * * *',
  $$
  select net.http_post(
    url := 'https://fuxjxorbbebbxxgsnyon.supabase.co/functions/v1/poll-deadline',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '<CRON-SECRET>'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
  $$
);

-- Verwijderen kan later met:
--   select cron.unschedule('poll-deadline');
