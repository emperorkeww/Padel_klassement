-- Triggers voor push-meldingen. Eén keer uitvoeren in de SQL-editor van je
-- GEHOSTE project (vervang <PROJECT-REF>). Bewust rechtstreeks op pg_net
-- gebouwd in plaats van op supabase_functions.http_request: dat schema
-- bestaat alleen nadat je webhooks ooit via het dashboard hebt geactiveerd,
-- en die pagina is per dashboardversie verhuisd. Dit werkt altijd.

create extension if not exists pg_net;

-- Stuurt het webhook-payload (zelfde vorm als Supabase's eigen webhooks)
-- naar de send-push Edge Function. net.http_post is asynchroon: de
-- oorspronkelijke insert/update wacht er niet op.
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
    headers := '{"Content-Type": "application/json"}'::jsonb,
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
