-- #1099 Agenda-abonnement: één onraadbare feed-URL per speler, zodat zijn
-- agenda-app zélf ophaalt welke speeldagen vaststaan. Spiegel van de nieuwe
-- supabase/schemas/tables/28_calendar_feeds.sql,
-- supabase/schemas/functions/39_calendar_feed.sql en
-- supabase/schemas/policies/calendar_feeds.sql, plus de toevoeging aan
-- policies/zz_client_read_grants.sql; zie die bestanden voor de motivatie.
--
-- Kern: een gedownloade .ics is een momentopname en blijft dat. Een feed die de
-- agenda-app zelf ophaalt volgt een verzet moment mee en laat een afgelaste
-- speeldag verdwijnen — zonder dat iemand nog iets moet downloaden.
--
-- Met de hand geschreven: `supabase db diff` kan hier niet draaien zolang het
-- declaratieve schema achterloopt op de migraties (player_rank_state en
-- profiles.notify_rank_change uit 20260719120000 staan niet in schemas/).

-- 1. Tabel --------------------------------------------------------------------

create table public.calendar_feeds (
  token uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index calendar_feeds_player_idx
  on public.calendar_feeds (player_id, created_at desc);

alter table public.calendar_feeds enable row level security;

-- 2. RLS + grants -------------------------------------------------------------

-- Je ziet alleen je eigen links. Aanmaken en intrekken lopen via de
-- definer-functies hieronder, dus bewust geen insert- of update-policy.
create policy "calendar_feeds_select_own" on public.calendar_feeds
  for select
  using (player_id = (select auth.uid()));

-- PostgREST heeft naast een policy ook een tabelgrant nodig (#465).
grant select on table public.calendar_feeds to authenticated, anon;

-- 3. Uitlezen van een feed ----------------------------------------------------

-- SECURITY DEFINER omdat de aanroeper niet ingelogd is: een agenda-app stuurt
-- geen JWT. Het token is de hele afscherming. Onbekend of ingetrokken → NULL,
-- zodat de edge function er een 404 van kan maken zonder onderscheid; een
-- geldig token zonder speeldagen → [].
--
-- Alleen booked en locked: een kandidaat-moment uit een open poll is geen
-- afspraak. Geen access_code (#675): een feed-URL lekt per ontwerp naar de
-- servers van Google of Apple. De banen (#802) gaan wél mee.
--
-- Het tijdstip komt hier al omgerekend uit. play_poll_options bewaart de
-- kalenderdag en de kloktijd van de club (#322); `at time zone club_timezone`
-- maakt daar het echte moment van, ook voor een club buiten Europe/Brussels.
create or replace function public.calendar_feed_events(
  p_token uuid,
  p_from date,
  p_to date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player uuid;
  v_events jsonb;
begin
  select player_id into v_player
  from public.calendar_feeds
  where token = p_token and revoked_at is null;

  if v_player is null then
    return null;
  end if;

  select coalesce(jsonb_agg(to_jsonb(e) order by e.starts_at), '[]'::jsonb)
  into v_events
  from (
    select
      p.id as poll_id,
      g.name as group_name,
      p.club_name,
      p.club_city,
      p.courts,
      o.duration,
      ((o.date + o.start_time::time) at time zone p.club_timezone) as starts_at,
      coalesce(p.booked_at, p.locked_at, p.created_at) as changed_at
    from public.play_polls p
    join public.play_poll_options o on o.id = p.locked_option_id
    join public.groups g on g.id = p.group_id
    -- Lidmaatschap nu, niet toen: wie een groep verlaat houdt haar speeldagen
    -- niet in zijn agenda.
    join public.group_members m
      on m.group_id = p.group_id and m.player_id = v_player
    where p.status in ('booked', 'locked')
      and o.date between p_from and p_to
  ) e;

  return v_events;
end;
$$;

grant execute on function public.calendar_feed_events(uuid, date, date)
  to anon, authenticated;

-- 4. Uitgeven en intrekken ----------------------------------------------------

-- Eén handeling: "ik wil een nieuwe link" betekent altijd "en de oude mag
-- stoppen" — anders blijft een gelekte link gewoon werken.
create or replace function public.rotate_calendar_feed()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_token uuid;
begin
  if v_uid is null then
    raise exception 'Niet ingelogd';
  end if;

  update public.calendar_feeds
  set revoked_at = now()
  where player_id = v_uid and revoked_at is null;

  insert into public.calendar_feeds (player_id)
  values (v_uid)
  returning token into v_token;

  return v_token;
end;
$$;

grant execute on function public.rotate_calendar_feed() to authenticated;

create or replace function public.revoke_calendar_feeds()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Niet ingelogd';
  end if;

  update public.calendar_feeds
  set revoked_at = now()
  where player_id = v_uid and revoked_at is null;
end;
$$;

grant execute on function public.revoke_calendar_feeds() to authenticated;
