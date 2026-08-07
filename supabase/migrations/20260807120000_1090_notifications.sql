-- #1090 Meldingen in de app zelf: één tabel waarin elke melding blijft staan,
-- ook voor wie geen push-abonnement heeft. Spiegel van de nieuwe
-- supabase/schemas/tables/27_notifications.sql, functions/38_notifications.sql
-- en policies/notifications.sql, plus de toevoeging aan
-- policies/zz_client_read_grants.sql; zie die bestanden voor de volledige
-- motivatie.
--
-- Kern: de rij wordt geschreven vóór de bezorging én vóór de notify_*-filter.
-- Wie ooit één schakelaar uitzette, of nooit push aanzette, zag de gebeurtenis
-- tot nu toe nergens terug — en dat is een zwaardere consequentie dan wat de
-- instellingen beloven. De schakelaars sturen voortaan alleen of het toestel
-- piept; de gedeelde bezorger (_shared/meldingen.ts) doet rij eerst, push daarna.

-- 1. Tabel --------------------------------------------------------------------

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- De gebeurtenis, niet het kanaal: breder dan de vier notify_*-kolommen op
  -- profiles, want polls, VAR, pias en de lef-onthulling hebben geen voorkeur
  -- maar horen wél in de inbox.
  soort text not null check (
    soort in (
      'nieuwe_ronde', 'uitslag', 'vriendschapsverzoek', 'rangwissel',
      'pias', 'poll', 'var', 'speeldag_herinnering', 'lef'
    )
  ),
  title text not null,
  body text not null,
  -- Dezelfde deep-link als de push, zodat "via de melding" en "via de bel" op
  -- hetzelfde scherm uitkomen.
  url text not null,
  -- Gebeurtenis-id (#189), niet soort-id.
  tag text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index notifications_user_idx
  on public.notifications (user_id, created_at desc);

create index notifications_ongelezen_idx
  on public.notifications (user_id) where read_at is null;

-- Dezelfde tag vouwt samen zolang je de melding niet gelezen hebt — precies wat
-- renotify op het toestel doet. Partieel, dus meldingen_schrijven moet het
-- predicaat in ON CONFLICT herhalen.
create unique index notifications_open_tag_uidx
  on public.notifications (user_id, tag) where read_at is null;

alter table public.notifications enable row level security;

-- 2. Schrijven en opruimen ----------------------------------------------------

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

-- 3. Policies + grants --------------------------------------------------------

create policy "notifications_select_own" on public.notifications
  for select
  using (user_id = (select auth.uid()));

create policy "notifications_update_own" on public.notifications
  for update
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Geen insert- of delete-policy: schrijven doet de service-role, opruimen doet
-- prune_notifications. RLS kan geen kolommen beschermen, dus de update-grant is
-- smal — anders kon je je eigen melding herschrijven.
revoke insert, update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

grant select on table public.notifications to authenticated, anon;

-- 4. Realtime -----------------------------------------------------------------

-- De teller in de balk beweegt mee terwijl de app openstaat. RLS blijft gelden
-- op de stroom, dus je ontvangt enkel je eigen rijen.
alter publication supabase_realtime add table public.notifications;
