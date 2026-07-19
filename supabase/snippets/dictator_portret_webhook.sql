-- Server-side vangnet voor het AI dictator-portret (#554). Zodra iemand zittend
-- dictator wordt opent de troon-replay (#545) een nieuwe rij in
-- dictator_termijnen; deze trigger vuurt dan fire-and-forget de edge function
-- generate-dictator-avatar af, zodat ook een dictator die de app zelf niet opent
-- een vers portret krijgt. De function is idempotent (skipt als het portret al
-- bij de huidige foto hoort) en respecteert de opt-out, dus elke insert afvuren
-- is veilig.
--
-- Eén keer uitvoeren in de SQL-editor van je GEHOSTE project (vervang
-- <PROJECT-REF> én <CRON-SECRET>). Zelfde pg_net-aanpak als push_webhooks.sql.
-- Vereist dat de function al gedeployd is (`--no-verify-jwt`) MÉT CRON_SECRET.
--
-- De function draait zonder platform-JWT-verificatie en doet z'n eigen auth, dus
-- er is geen Authorization-header nodig — enkel het gedeelde geheim:
--   * x-cron-secret: <CRON-SECRET> — hiermee herkent de function de trusted
--     server-trigger en genereert hij voor de meegegeven userId (#459-patroon).
--     Vul dezelfde waarde in als `supabase secrets set CRON_SECRET=…`.

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
      'x-cron-secret', '<CRON-SECRET>'
    ),
    timeout_milliseconds := 5000
  );
  return null;
end;
$$;

-- Alleen bij een NIEUWE termijn (iemand pakt de troon). Verlengen/afsluiten van
-- termijnen raakt de foto niet. `create or replace` zodat opnieuw uitvoeren geen
-- "trigger already exists" geeft (PG14+).
create or replace trigger dictator_portret_on_termijn_insert
  after insert on public.dictator_termijnen
  for each row execute function public.notify_dictator_portret();
