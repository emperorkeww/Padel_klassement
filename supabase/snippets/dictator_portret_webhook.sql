-- Server-side vangnet voor het AI dictator-portret (#554). Zodra iemand zittend
-- dictator wordt opent de troon-replay (#545) een nieuwe rij in
-- dictator_termijnen; deze trigger vuurt dan fire-and-forget de edge function
-- generate-dictator-avatar af, zodat ook een dictator die de app zelf niet opent
-- een vers portret krijgt. De function is idempotent (skipt als het portret al
-- bij de huidige foto hoort) en respecteert de opt-out, dus elke insert afvuren
-- is veilig.
--
-- Eén keer uitvoeren in de SQL-editor van je GEHOSTE project (vervang
-- <PROJECT-REF>, <CRON-SECRET> én <ANON-KEY>). Zelfde pg_net-aanpak als
-- push_webhooks.sql. Vereist dat de function al gedeployd is MÉT CRON_SECRET.
--
-- Twee headers, allebei nodig:
--   * Authorization: Bearer <ANON-KEY> — de function draait mét jwt-verificatie
--     (het client-pad heeft de user nodig), dus het platform eist een geldige
--     JWT vóór onze code draait. De publieke anon-key volstaat.
--   * x-cron-secret: <CRON-SECRET> — hiermee herkent de function de trusted
--     server-trigger en genereert hij voor de meegegeven userId (#459-patroon).

create extension if not exists pg_net;

create or replace function public.notify_dictator_portret()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform net.http_post(
    url := 'https://<PROJECT-REF>.supabase.co/functions/v1/generate-dictator-avatar',
    body := jsonb_build_object('userId', new.profile_id),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <ANON-KEY>',
      'x-cron-secret', '<CRON-SECRET>'
    ),
    timeout_milliseconds := 5000
  );
  return null;
end;
$$;

-- Alleen bij een NIEUWE termijn (iemand pakt de troon). Verlengen/afsluiten van
-- termijnen raakt de foto niet.
create trigger dictator_portret_on_termijn_insert
  after insert on public.dictator_termijnen
  for each row execute function public.notify_dictator_portret();
