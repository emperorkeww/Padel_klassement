-- De agenda-feed (#1099). Drie functies: uitlezen (voor de agenda-app van de
-- gebruiker), en een link uitgeven of intrekken (voor de gebruiker zelf).

-- Wat er achter één feed-token zit.
--
-- SECURITY DEFINER omdat de aanroeper niet ingelogd ís: een agenda-app stuurt
-- geen JWT. Het token is de hele afscherming, en daarom staat de RLS-omzeiling
-- hier in één auditeerbare functie in plaats van in een edge function met een
-- service-role-sleutel.
--
-- Drie keuzes die bepalen of dit doet wat mensen ervan verwachten:
--
-- 1. Alleen wat vaststaat: booked en locked. Een kandidaat-moment uit een open
--    poll is geen afspraak, en vijf momenten per poll zouden de agenda van
--    iemand met drie groepen dichtsmeren met dingen die misschien nooit
--    doorgaan. Wat vaststaat gaat mee; waarover nog gestemd wordt staat in de app.
-- 2. Géén access_code (#675). Die is in de database bewust member-only, en een
--    feed-URL lekt per ontwerp: hij belandt op de servers van Google of Apple en
--    iedereen die de link heeft leest hem mee. De banen (#802) gaan wél mee.
-- 3. Het tijdstip komt hier al omgerekend uit. play_poll_options bewaart de
--    kalenderdag en de kloktijd van de club (#322); die combinatie in de zone
--    van díé club interpreteren is precies wat `at time zone` doet. Zo klopt ook
--    een club buiten Europe/Brussels, en hoeft de edge function niets te weten
--    van tijdzones.
--
-- Onbekend of ingetrokken token → NULL, zodat de aanroeper er een 404 van kan
-- maken zonder onderscheid. Een geldig token zonder speeldagen → [].
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

-- Alleen anon: de agenda-app is niet ingelogd. Dat is dezelfde blootstelling als
-- de feed-URL zelf — in beide gevallen is het token de sleutel.
grant execute on function public.calendar_feed_events(uuid, date, date) to anon, authenticated;

-- Geeft een nieuwe feed-link uit en trekt alle vorige in. Eén handeling, want
-- "ik wil een nieuwe" betekent altijd "en de oude mag stoppen" — anders blijft
-- een gelekte link gewoon werken.
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

-- Stoppen zonder nieuwe link: alles intrekken.
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
