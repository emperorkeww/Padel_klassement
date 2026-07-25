-- Server-side vangnet voor het AI pias-portret (#682). Zodra recompute_pias de
-- pias-aanduidingen bijwerkt, vuurt deze trigger fire-and-forget de edge function
-- generate-pias-avatar af voor de húidige globale pias, zodat ook een pias die de
-- app zelf niet opent een vers clownportret op De Schandpaal krijgt.
--
-- Eén keer uitvoeren in de SQL-editor van je GEHOSTE project (vervang
-- <PROJECT-REF> én <CRON-SECRET>). Zelfde pg_net-aanpak als push_webhooks.sql en
-- dictator_portret_webhook.sql. Vereist dat de function al gedeployd is
-- (`--no-verify-jwt`) MÉT CRON_SECRET, en dat de #682-migratie gepusht is.
--
-- Waarom per STATEMENT en niet per rij: pias_of_week krijgt één rij per (groep,
-- week), maar er staat maar één speler op De Schandpaal — de globale pias
-- (get_global_pias). Per rij afvuren zou een generatie kosten voor élke
-- groeps-pias, terwijl er hoogstens één portret gebruikt wordt. recompute_pias
-- werkt diff-gebaseerd (#203), dus dit statement vuurt alleen bij een échte
-- pias-wissel.
--
-- Fail-closed op het roast-schild (#183): wie beschermd is komt niet op De
-- Schandpaal, en krijgt hier dus ook geen portret — zijn foto gaat nooit naar
-- OpenAI. Idem voor de opt-out (profiles.pias_portret). De function checkt beide
-- zelf óók; dit scheelt een nutteloze HTTP-call en houdt de regel zichtbaar op de
-- plek waar het besluit valt.
--
-- De function is idempotent (skipt als het portret al bij de huidige foto hoort),
-- dus elke herhaling is gratis.

create extension if not exists pg_net;

create or replace function public.notify_pias_portret()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pias uuid;
begin
  -- De pias van de lópende week (weken_terug => 0): een portret voor een afgang
  -- van vorige week hoeft niet meer gemaakt te worden — dat venster is al voorbij
  -- op het moment dat er een nieuwe week loopt.
  select g.player_id
    into v_pias
    from public.get_global_pias(0) g
    join public.profiles p on p.id = g.player_id
   where not g.beschermd
     and p.pias_portret
     and not p.is_guest
   order by g.week_start desc
   limit 1;

  if v_pias is null then
    return null;
  end if;

  perform net.http_post(
    url := 'https://<PROJECT-REF>.supabase.co/functions/v1/generate-pias-avatar',
    body := jsonb_build_object('userId', v_pias),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '<CRON-SECRET>'
    ),
    timeout_milliseconds := 5000
  );
  return null;
end;
$$;

-- Na élke wijziging aan de aanduidingen (insert, update én delete: een verwijderde
-- rij kan de globale pias aan een ander geven). `create or replace` zodat opnieuw
-- uitvoeren geen "trigger already exists" geeft (PG14+).
create or replace trigger pias_portret_on_pias_of_week
  after insert or update or delete on public.pias_of_week
  for each statement execute function public.notify_pias_portret();
