-- Triggers voor push-meldingen. Eén keer uitvoeren in de SQL-editor van je
-- GEHOSTE project (vervang <PROJECT-REF> én <CRON-SECRET>). Bewust rechtstreeks op pg_net
-- gebouwd in plaats van op supabase_functions.http_request: dat schema
-- bestaat alleen nadat je webhooks ooit via het dashboard hebt geactiveerd,
-- en die pagina is per dashboardversie verhuisd. Dit werkt altijd.

create extension if not exists pg_net;

-- Stuurt het webhook-payload (zelfde vorm als Supabase's eigen webhooks)
-- naar de send-push Edge Function. net.http_post is asynchroon: de
-- oorspronkelijke insert/update wacht er niet op.
--
-- De 'x-cron-secret'-header (#459) is het gedeelde geheim waarmee send-push
-- de aanroeper verifieert; vul <CRON-SECRET> in met dezelfde waarde als
-- `supabase secrets set CRON_SECRET=…`. Zonder (juiste) header weigert de
-- functie (fail-closed), dus de function moet mét CRON_SECRET gedeployd zijn
-- vóór je deze triggers (her)aanmaakt.
create or replace function public.notify_send_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform net.http_post(
    url := 'https://<PROJECT-REF>.supabase.co/functions/v1/send-push',
    body := jsonb_build_object(
      'type', tg_op,
      'table', tg_table_name,
      'record', to_jsonb(new),
      'old_record', case when tg_op = 'UPDATE' then to_jsonb(old) else null end
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '<CRON-SECRET>'
    ),
    timeout_milliseconds := 5000
  );
  return null;
end;
$$;

create trigger push_on_match_insert
  after insert on public.matches
  for each row execute function public.notify_send_push();

create trigger push_on_match_update
  after update on public.matches
  for each row execute function public.notify_send_push();

create trigger push_on_friendship_insert
  after insert on public.friendships
  for each row execute function public.notify_send_push();

-- Speeldag-polls: nieuwe poll (naar de groep) en gelockt/geboekt (naar de
-- stemmers) — zie de play_polls-handlers in send-push.
create trigger push_on_poll_insert
  after insert on public.play_polls
  for each row execute function public.notify_send_push();

create trigger push_on_poll_update
  after update on public.play_polls
  for each row execute function public.notify_send_push();

-- Pias van de week (#203): Coach Rudy plaagt de pias — maar alleen bij een
-- échte aanwijzing of wissel in de HUIDIGE ISO-week; herberekende historische
-- weken zwijgen. Vereist de diff-gebaseerde recompute_pias (migratie
-- pias_diff_recompute): pas deze triggers dus pas toe NADAT die migratie en
-- de bijgewerkte send-push-functie live staan. Twee aparte triggers, want een
-- WHEN-clausule met OLD mag niet op een gecombineerde insert-or-update-trigger.
create trigger push_on_pias_insert
  after insert on public.pias_of_week
  for each row
  when (new.week_start = date_trunc('week', now())::date)
  execute function public.notify_send_push();

create trigger push_on_pias_update
  after update on public.pias_of_week
  for each row
  when (new.week_start = date_trunc('week', now())::date
        and new.player_id is distinct from old.player_id)
  execute function public.notify_send_push();

-- Promotie/degradatie (#302): Coach Rudy meldt een tier-overgang in het
-- groepsklassement. Enkel bij een échte tier-wissel én zonder de 'nieuw'-tier
-- (in- of uitstappen op de ladder is geen promotie/degradatie). Vereist de
-- migratie rank_change_state (public.player_rank_state + recompute_rank_state):
-- pas deze trigger dus pas toe NADAT die migratie en de bijgewerkte send-push-
-- functie live staan. De richting (promotie/degradatie) leidt send-push zelf af
-- uit old.tier vs new.tier.
create trigger push_on_rank_change
  after update on public.player_rank_state
  for each row
  when (new.tier is distinct from old.tier
        and new.tier <> 'nieuw' and old.tier <> 'nieuw')
  execute function public.notify_send_push();
