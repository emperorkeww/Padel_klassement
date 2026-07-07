-- pg_cron-planning voor de match-herinneringen. Eén keer uitvoeren in de SQL-
-- editor van je GEHOSTE project. Vervang <PROJECT-REF> en <CRON-SECRET>.
--
-- Bewust een snippet (geen migratie): net als push_webhooks.sql is dit
-- project-specifiek (URL + geheim) en bouwt het op pg_cron/pg_net, die op de
-- gehoste omgeving beschikbaar zijn maar niet in elke lokale db.reset.
--
-- Vooraf, in de terminal:
--   supabase functions deploy match-reminders --no-verify-jwt
--   supabase secrets set CRON_SECRET=<CRON-SECRET>
--   supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:...
--   (optioneel) supabase secrets set REMINDER_HOURS=3

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Draait elk kwartier: de edge function stuurt herinneringen voor matches die
-- binnen REMINDER_HOURS uur beginnen en nog geen herinnering kregen.
select cron.schedule(
  'match-reminders',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT-REF>.supabase.co/functions/v1/match-reminders',
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
--   select cron.unschedule('match-reminders');
