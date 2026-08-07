-- De schrijfkant van de meldingen-inbox (#1090). Beide functies zijn
-- service-role-only: de Edge Functions zijn de enige aanroepers, de client leest
-- alleen (policies/notifications.sql).

-- Eén batch meldingen wegschrijven. p_meldingen is een array van objecten met
-- user_id, soort, title, body, url en tag.
--
-- Waarom een RPC en geen upsert() vanuit de edge function: de uniciteit is een
-- PARTIËLE index (alleen ongelezen rijen), en PostgREST kan het WHERE-predicaat
-- van ON CONFLICT niet meesturen. Zonder dat predicaat vindt Postgres geen
-- passende constraint en faalt de hele insert.
create or replace function public.meldingen_schrijven(p_meldingen jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_aantal integer;
begin
  insert into public.notifications (user_id, soort, title, body, url, tag)
  -- distinct on: twee rijen met dezelfde (user_id, tag) in één statement zouden
  -- elkaar via ON CONFLICT DO UPDATE raken, en dat weigert Postgres ("cannot
  -- affect row a second time"). De laatste in de payload wint, want dat is de
  -- meest recente formulering van dezelfde gebeurtenis.
  select distinct on (m.user_id, m.tag)
         m.user_id, m.soort, m.title, m.body, m.url, m.tag
  from (
    select (e.value ->> 'user_id')::uuid as user_id,
           e.value ->> 'soort' as soort,
           e.value ->> 'title' as title,
           e.value ->> 'body' as body,
           e.value ->> 'url' as url,
           e.value ->> 'tag' as tag,
           e.ord
    from jsonb_array_elements(coalesce(p_meldingen, '[]'::jsonb))
         with ordinality as e(value, ord)
  ) m
  -- De join is meteen de bescherming tegen een user_id dat niet (meer) bestaat:
  -- die rij verdwijnt stil in plaats van de hele batch op een FK te laten
  -- klappen. Gasten vallen af omdat ze nooit inloggen — een inbox die niemand
  -- ooit opent is alleen maar ballast.
  join public.profiles p on p.id = m.user_id and not p.is_guest
  where m.tag is not null and m.soort is not null
  order by m.user_id, m.tag, m.ord desc
  on conflict (user_id, tag) where read_at is null
  do update set
    soort = excluded.soort,
    title = excluded.title,
    body = excluded.body,
    url = excluded.url,
    created_at = now();

  get diagnostics v_aantal = row_count;
  return v_aantal;
end;
$$;

revoke execute on function public.meldingen_schrijven(jsonb)
  from public, anon, authenticated;
grant execute on function public.meldingen_schrijven(jsonb) to service_role;

-- Retentie. Zonder dit groeit de tabel monotoon door: elke ronde, elke uitslag
-- en elke poll-herinnering van elk lid blijft anders eeuwig staan. Aangeroepen
-- vanuit de uurlijkse appeal-deadline-cron, zodat het meerolt met de deploy in
-- plaats van een handmatig SQL-snippet te vragen.
create or replace function public.prune_notifications(p_dagen integer default 90)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_aantal integer;
begin
  delete from public.notifications
  where created_at < now() - make_interval(days => greatest(coalesce(p_dagen, 90), 1));
  get diagnostics v_aantal = row_count;
  return v_aantal;
end;
$$;

revoke execute on function public.prune_notifications(integer)
  from public, anon, authenticated;
grant execute on function public.prune_notifications(integer) to service_role;
