-- Database-webhooks voor push-meldingen. Eén keer uitvoeren in de SQL-editor
-- van je GEHOSTE project (Dashboard → SQL). Vervang <PROJECT-REF> door je
-- projectreferentie en <ANON-KEY> door de anon/publishable key (de functie
-- valideert zelf niets op basis van deze key; hij is nodig omdat Edge
-- Functions standaard een Authorization-header verwachten — deploy je met
-- --no-verify-jwt, dan mag de header weg).
--
-- Alternatief: maak dezelfde drie webhooks aan via Dashboard → Database →
-- Webhooks (INSERT op matches, UPDATE op matches, INSERT op friendships,
-- alle drie richting de Edge Function send-push).

create trigger push_on_match_insert
  after insert on public.matches
  for each row
  execute function supabase_functions.http_request(
    'https://<PROJECT-REF>.supabase.co/functions/v1/send-push',
    'POST',
    '{"Content-Type":"application/json","Authorization":"Bearer <ANON-KEY>"}',
    '{}',
    '5000'
  );

create trigger push_on_match_update
  after update on public.matches
  for each row
  execute function supabase_functions.http_request(
    'https://<PROJECT-REF>.supabase.co/functions/v1/send-push',
    'POST',
    '{"Content-Type":"application/json","Authorization":"Bearer <ANON-KEY>"}',
    '{}',
    '5000'
  );

create trigger push_on_friendship_insert
  after insert on public.friendships
  for each row
  execute function supabase_functions.http_request(
    'https://<PROJECT-REF>.supabase.co/functions/v1/send-push',
    'POST',
    '{"Content-Type":"application/json","Authorization":"Bearer <ANON-KEY>"}',
    '{}',
    '5000'
  );
