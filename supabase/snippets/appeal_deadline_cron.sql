-- pg_cron-planning voor Rudy's VAR (#1025): het sluiten van verlopen zaken.
-- Eén keer uitvoeren in de SQL-editor van je GEHOSTE project. Zelfde patroon en
-- hetzelfde geheim als poll_deadline_cron.sql.
--
-- Vooraf, in de terminal:
--   supabase functions deploy appeal-deadline --no-verify-jwt
--   (CRON_SECRET staat er al voor poll-deadline en match-reminders.)

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Elk kwartier. Het stemvenster is 12 uur, dus uur-granulariteit zou volstaan,
-- maar een zaak die dicht is hoort niet nog een uur als "open" op iemands
-- dashboard te blijven staan.
select cron.schedule(
  'appeal-deadline',
  '10,25,40,55 * * * *',
  $$
  select net.http_post(
    url := 'https://fuxjxorbbebbxxgsnyon.supabase.co/functions/v1/appeal-deadline',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '<CRON-SECRET>'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
  $$
);

-- Controleren:
--   select jobname, schedule, active from cron.job where jobname = 'appeal-deadline';
--   select status, return_message, start_time
--     from cron.job_run_details
--    where jobid = (select jobid from cron.job where jobname = 'appeal-deadline')
--    order by start_time desc limit 5;
--
-- Verwijderen:
--   select cron.unschedule('appeal-deadline');
