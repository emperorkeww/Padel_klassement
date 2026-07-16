-- pg_cron-planning voor de baanbeschikbaarheids-snapshots (#405). Eén keer
-- uitvoeren in de SQL-editor van je GEHOSTE project. Zelfde patroon en secret
-- als poll_deadline_cron.sql.
--
-- Gelaagde cadans, zodat het upstream-verkeer richting Playtomic constant en
-- laag blijft (~13 rustige, sequentiële calls/uur):
--   * vandaag + morgen elke 15 min (daar verdwijnen slots het snelst);
--   * de volle 7 dagen één keer per uur.
-- De minuten (:17/:32/:47 en :02) zijn gekozen zodat de jobs elkaar en de
-- andere cron-jobs (:05 poll-deadline, */15 match-reminders) niet overlappen.
--
-- Vooraf, in de terminal:
--   supabase functions deploy snapshot-availability --no-verify-jwt
--   (CRON_SECRET staat er al voor match-reminders; optioneel
--    SNAPSHOT_TENANT_ID voor een andere thuisclub.)

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Vandaag + morgen, elk kwartier (behalve op het hele uur: dan draait de
-- weeksweep al).
select cron.schedule(
  'snapshot-availability-vers',
  '17,32,47 * * * *',
  $$
  select net.http_post(
    url := 'https://fuxjxorbbebbxxgsnyon.supabase.co/functions/v1/snapshot-availability',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '<CRON-SECRET>'
    ),
    body := '{"days":2}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);

-- Volledige week, elk uur. Let op: timeout 30 s i.p.v. de 10 s van de andere
-- snippets — 7 sequentiële fetches met pauzes ertussen duren langer, en een
-- door pg_net afgebroken verbinding kan de functie voortijdig stoppen.
select cron.schedule(
  'snapshot-availability-week',
  '2 * * * *',
  $$
  select net.http_post(
    url := 'https://fuxjxorbbebbxxgsnyon.supabase.co/functions/v1/snapshot-availability',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '<CRON-SECRET>'
    ),
    body := '{"days":7}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);

-- Verwijderen kan later met (de client valt dan automatisch terug op live):
--   select cron.unschedule('snapshot-availability-vers');
--   select cron.unschedule('snapshot-availability-week');
