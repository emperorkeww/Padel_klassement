-- #1025 Rudy's VAR: een deelnemer betwist één punt uit de eindstand, de andere
-- deelnemers stemmen, en bij een toekenning verschuift het punt écht. Spiegel
-- van de nieuwe supabase/schemas/tables/25_point_appeals.sql,
-- functions/36_point_appeals.sql en policies/point_appeals.sql, plus de
-- toevoeging aan policies/zz_client_read_grants.sql; zie die bestanden voor de
-- volledige motivatie.
--
-- Kern: het beroep hangt aan matches.score_a/score_b en niet aan match_points.
-- Die tabel heeft in de hele codebase geen schrijver (alleen seed.sql), dus een
-- VAR op punt-rijen zou op geen enkele match zichtbaar zijn. De kopscore is
-- bovendien "de autoritaire aggregaat voor stand en ratings" (05_matches.sql):
-- één eenheid verschuiven laat de hele afgeleide keten meebewegen via de
-- bestaande statement-triggers op public.matches.

-- 1. Tabellen ---------------------------------------------------------------

create table public.point_appeals (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  claimant_id uuid not null references public.profiles (id) on delete cascade,
  -- Welke set het punt in viel (1-based, index in matches.set_scores); alleen
  -- gevuld als de match een per-set uitslag heeft, zodat kopscore en set-stand
  -- samen bewegen. De guard dwingt beide kanten af.
  set_number smallint check (set_number is null or set_number between 1 and 5),
  reden text not null check (
    reden in ('ons-punt', 'dubbele-stuit', 'net', 'buiten', 'verkeerd-ingetikt')
  ),
  toelichting text check (toelichting is null or length(toelichting) <= 140),
  -- 'verlopen' = de uitslag wijzigde intussen langs een andere weg (#978/#681);
  -- 'tegoed-op' = de groep gaf je gelijk maar je VAR van die speeldag was al op.
  status text not null default 'open' check (
    status in ('open', 'toegekend', 'afgewezen', 'verlopen', 'tegoed-op')
  ),
  -- Stand bij het indienen, serverside gezet; wijkt de match daarvan af bij de
  -- afhandeling, dan vervalt het beroep in plaats van te stapelen.
  snapshot_a smallint not null,
  snapshot_b smallint not null,
  -- Speeldag in clubtijd; draagt het beroepstegoed (zie de index hieronder).
  play_date date not null,
  -- Sluiting van de stemming, 12 u na indienen. Niet gestemd = afgewezen.
  votes_close_at timestamptz not null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

-- Eén open beroep per match tegelijk, en één tóekenning per speler per
-- speeldag. Als partiële unieke indexen en niet als telling in de guard: twee
-- gelijktijdige inserts zouden een telling allebei passeren, een index niet.
create unique index point_appeals_one_open_per_match_uidx
  on public.point_appeals (match_id) where status = 'open';
create unique index point_appeals_tegoed_uidx
  on public.point_appeals (claimant_id, play_date) where status = 'toegekend';

create index point_appeals_match_idx on public.point_appeals (match_id);
create index point_appeals_claimant_idx on public.point_appeals (claimant_id);
create index point_appeals_open_idx
  on public.point_appeals (votes_close_at) where status = 'open';

alter table public.point_appeals enable row level security;

create table public.point_appeal_votes (
  appeal_id uuid not null references public.point_appeals (id) on delete cascade,
  voter_id uuid not null references public.profiles (id) on delete cascade,
  akkoord boolean not null,
  created_at timestamptz not null default now(),
  primary key (appeal_id, voter_id)
);

alter table public.point_appeal_votes enable row level security;

-- 2. Helpers ----------------------------------------------------------------

create or replace function public._is_match_deelnemer(p_match uuid, p_player uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.matches m
    where m.id = p_match
      and p_player is not null
      and (
        public.is_team_member(m.team_a_id, p_player)
        or public.is_team_member(m.team_b_id, p_player)
      )
  );
$$;

revoke execute on function public._is_match_deelnemer(uuid, uuid) from public;
grant execute on function public._is_match_deelnemer(uuid, uuid) to authenticated;

-- Wie mag een beroep zien: de spelers, plus de groep waar de match in hangt.
create or replace function public._mag_beroep_zien(p_match uuid, p_uid uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select p_uid is not null and exists (
    select 1
    from public.matches m
    where m.id = p_match
      and (
        public.is_team_member(m.team_a_id, p_uid)
        or public.is_team_member(m.team_b_id, p_uid)
        or (m.group_id is not null and public.is_group_member(m.group_id, p_uid))
      )
  );
$$;

revoke execute on function public._mag_beroep_zien(uuid, uuid) from public;
grant execute on function public._mag_beroep_zien(uuid, uuid) to authenticated;

-- De stemgerechtigden: de andere deelnemers, tegenpartij inbegrepen (bij 2v2
-- stemmen er zo drie, dus geen gelijkspel). Gasten vallen weg: die loggen nooit
-- in, dus hun stem zou nooit komen.
create or replace function public._beroep_stemgerechtigden(p_match uuid, p_claimant uuid)
returns uuid[]
language sql
security definer
set search_path = ''
stable
as $$
  select coalesce(array_agg(distinct s.speler), '{}'::uuid[])
  from (
    select unnest(array[ta.player1_id, ta.player2_id, tb.player1_id, tb.player2_id]) as speler
    from public.matches m
    join public.teams ta on ta.id = m.team_a_id
    join public.teams tb on tb.id = m.team_b_id
    where m.id = p_match
  ) s
  join public.profiles p on p.id = s.speler
  where s.speler is distinct from p_claimant
    and not p.is_guest;
$$;

revoke execute on function public._beroep_stemgerechtigden(uuid, uuid) from public;
grant execute on function public._beroep_stemgerechtigden(uuid, uuid) to authenticated;

-- 3. Guards -----------------------------------------------------------------

create or replace function public.point_appeals_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  tz constant text := 'Europe/Brussels';
  venster constant interval := interval '24 hours';
  stemvenster constant interval := interval '12 hours';
  m record;
  v_kant text;
  v_sets jsonb;
  v_tegen int;
begin
  select id, status, played_at, team_a_id, team_b_id, score_a, score_b, set_scores
    into m
    from public.matches
    where id = new.match_id;

  if m.id is null then
    raise exception 'match bestaat niet';
  end if;
  if m.status <> 'completed' then
    raise exception 'je kunt alleen een afgeronde match betwisten';
  end if;
  if m.played_at is null then
    raise exception 'deze match heeft geen speelmoment';
  end if;
  if now() > m.played_at + venster then
    raise exception 'het VAR-venster van 24 uur is gesloten';
  end if;
  if not public._is_match_deelnemer(m.id, new.claimant_id) then
    raise exception 'alleen spelers uit deze match kunnen betwisten';
  end if;
  if m.score_a is null or m.score_b is null then
    raise exception 'deze match heeft geen ingevulde uitslag';
  end if;

  v_kant := case
    when public.is_team_member(m.team_a_id, new.claimant_id) then 'a'
    else 'b'
  end;

  if (v_kant = 'a' and m.score_b <= 0) or (v_kant = 'b' and m.score_a <= 0) then
    raise exception 'de tegenpartij heeft geen punt om af te staan';
  end if;

  v_sets := m.set_scores;
  if jsonb_typeof(v_sets) = 'array' and jsonb_array_length(v_sets) > 0 then
    if new.set_number is null then
      raise exception 'geef aan in welke set het punt viel';
    end if;
    if new.set_number > jsonb_array_length(v_sets) then
      raise exception 'die set staat niet in de uitslag';
    end if;
    v_tegen := case
      when v_kant = 'a' then (v_sets -> (new.set_number - 1) ->> 1)::int
      else (v_sets -> (new.set_number - 1) ->> 0)::int
    end;
    if v_tegen is null or v_tegen <= 0 then
      raise exception 'de tegenpartij heeft in die set geen punt om af te staan';
    end if;
  elsif new.set_number is not null then
    raise exception 'deze match heeft geen set-stand';
  end if;

  if coalesce(
       array_length(public._beroep_stemgerechtigden(m.id, new.claimant_id), 1),
       0
     ) = 0 then
    raise exception 'er is niemand die over dit beroep kan stemmen';
  end if;

  new.play_date := (m.played_at at time zone tz)::date;

  if exists (
    select 1 from public.point_appeals a
    where a.claimant_id = new.claimant_id
      and a.play_date = new.play_date
      and a.status = 'toegekend'
      and a.id is distinct from new.id
  ) then
    raise exception 'je VAR-tegoed van deze speeldag is al gebruikt';
  end if;

  new.snapshot_a := m.score_a;
  new.snapshot_b := m.score_b;
  new.status := 'open';
  new.resolved_at := null;
  new.votes_close_at := now() + stemvenster;
  return new;
end;
$$;

create trigger point_appeals_guard
  before insert on public.point_appeals
  for each row execute function public.point_appeals_guard();

create or replace function public.point_appeal_votes_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  a record;
begin
  select id, match_id, claimant_id, status, votes_close_at
    into a
    from public.point_appeals
    where id = new.appeal_id;

  if a.id is null then
    raise exception 'dit beroep bestaat niet';
  end if;
  if a.status <> 'open' then
    raise exception 'over dit beroep is al uitspraak gedaan';
  end if;
  if now() > a.votes_close_at then
    raise exception 'de stemming is gesloten';
  end if;
  if new.voter_id = a.claimant_id then
    raise exception 'je stemt niet over je eigen beroep';
  end if;
  if not (new.voter_id = any (public._beroep_stemgerechtigden(a.match_id, a.claimant_id))) then
    raise exception 'alleen de andere spelers uit deze match kunnen stemmen';
  end if;
  return new;
end;
$$;

create trigger point_appeal_votes_guard
  before insert on public.point_appeal_votes
  for each row execute function public.point_appeal_votes_guard();

-- 4. De uitspraak -----------------------------------------------------------

create or replace function public.resolve_point_appeal(
  p_appeal_id uuid,
  p_venster_verlopen boolean default false
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  a record;
  m record;
  v_kiezers uuid[];
  v_n int;
  v_voor int;
  v_tegen int;
  v_kant text;
  v_a smallint;
  v_b smallint;
  v_sets jsonb;
  v_sa int;
  v_sb int;
  v_winner uuid;
begin
  select * into a from public.point_appeals where id = p_appeal_id for update;
  if not found then
    return 'onbekend';
  end if;
  if a.status <> 'open' then
    return a.status;
  end if;

  v_kiezers := public._beroep_stemgerechtigden(a.match_id, a.claimant_id);
  v_n := coalesce(array_length(v_kiezers, 1), 0);
  select count(*) filter (where v.akkoord),
         count(*) filter (where not v.akkoord)
    into v_voor, v_tegen
    from public.point_appeal_votes v
    where v.appeal_id = a.id
      and v.voter_id = any (v_kiezers);

  -- Strikte meerderheid vóór wint; bij gelijkspel blijft de uitslag staan.
  if v_voor * 2 <= v_n then
    if v_tegen * 2 >= v_n or p_venster_verlopen then
      update public.point_appeals
         set status = 'afgewezen', resolved_at = now()
       where id = a.id;
      return 'afgewezen';
    end if;
    return 'open';
  end if;

  select id, team_a_id, team_b_id, score_a, score_b, set_scores
    into m
    from public.matches
    where id = a.match_id
    for update;

  if not found
     or m.score_a is distinct from a.snapshot_a
     or m.score_b is distinct from a.snapshot_b then
    update public.point_appeals
       set status = 'verlopen', resolved_at = now()
     where id = a.id;
    return 'verlopen';
  end if;

  v_kant := case
    when public.is_team_member(m.team_a_id, a.claimant_id) then 'a'
    else 'b'
  end;
  v_a := m.score_a + case when v_kant = 'a' then 1 else -1 end;
  v_b := m.score_b + case when v_kant = 'b' then 1 else -1 end;
  if v_a < 0 or v_b < 0 then
    update public.point_appeals
       set status = 'verlopen', resolved_at = now()
     where id = a.id;
    return 'verlopen';
  end if;

  v_sets := m.set_scores;
  if a.set_number is not null
     and jsonb_typeof(v_sets) = 'array'
     and jsonb_array_length(v_sets) >= a.set_number then
    v_sa := (v_sets -> (a.set_number - 1) ->> 0)::int
            + case when v_kant = 'a' then 1 else -1 end;
    v_sb := (v_sets -> (a.set_number - 1) ->> 1)::int
            + case when v_kant = 'b' then 1 else -1 end;
    if v_sa < 0 or v_sb < 0 then
      update public.point_appeals
         set status = 'verlopen', resolved_at = now()
       where id = a.id;
      return 'verlopen';
    end if;
    v_sets := jsonb_set(v_sets, array[(a.set_number - 1)::text, '0'], to_jsonb(v_sa));
    v_sets := jsonb_set(v_sets, array[(a.set_number - 1)::text, '1'], to_jsonb(v_sb));
  end if;

  v_winner := case
    when v_a > v_b then m.team_a_id
    when v_b > v_a then m.team_b_id
    else null
  end;

  -- Eerst het beroep: dat is wat op het tegoed botst. Won je vandaag al een
  -- beroep, dan geeft point_appeals_tegoed_uidx hier een unique_violation en
  -- blijft de uitslag ongemoeid.
  begin
    update public.point_appeals
       set status = 'toegekend', resolved_at = now()
     where id = a.id;
  exception when unique_violation then
    update public.point_appeals
       set status = 'tegoed-op', resolved_at = now()
     where id = a.id;
    return 'tegoed-op';
  end;

  -- De correctie. Ratings, pias, Zwarte Piet, bounty en rangstand bewegen mee
  -- via de statement-triggers op public.matches; de toto-tips via
  -- matches_grade_predictions (die op winner_team_id in de SET-lijst vuurt).
  -- De Elo-kern kijkt alleen naar winner_team_id: een toekenning die de winnaar
  -- niet omdraait laat het klassement bewust ongemoeid.
  update public.matches
     set score_a = v_a,
         score_b = v_b,
         set_scores = v_sets,
         winner_team_id = v_winner
   where id = m.id;

  return 'toegekend';
end;
$$;

-- Expliciet ook van anon en authenticated afnemen: Supabase's default
-- privileges geven elke nieuwe functie EXECUTE aan die rollen, en zonder deze
-- revoke kan iedere ingelogde gebruiker resolve_point_appeal(…, true)
-- aanroepen en een openstaand beroep vroegtijdig laten afwijzen.
revoke execute on function public.resolve_point_appeal(uuid, boolean)
  from public, anon, authenticated;

create or replace function public.point_appeal_votes_resolve()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.resolve_point_appeal(new.appeal_id);
  return null;
end;
$$;

create trigger point_appeal_votes_resolve
  after insert on public.point_appeal_votes
  for each row execute function public.point_appeal_votes_resolve();

-- Voor de cron-gestuurde Edge Function die verlopen beroepen sluit.
create or replace function public.expire_point_appeals()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_aantal int := 0;
begin
  for v_id in
    select id from public.point_appeals
    where status = 'open' and votes_close_at <= now()
    order by votes_close_at
  loop
    perform public.resolve_point_appeal(v_id, true);
    v_aantal := v_aantal + 1;
  end loop;
  return v_aantal;
end;
$$;

revoke execute on function public.expire_point_appeals()
  from public, anon, authenticated;
grant execute on function public.expire_point_appeals() to service_role;

-- 5. Policies + grants ------------------------------------------------------

create policy "point_appeals_select_zichtbaar" on public.point_appeals
  for select
  using (public._mag_beroep_zien(match_id, (select auth.uid())));

create policy "point_appeals_insert_own" on public.point_appeals
  for insert
  with check (
    claimant_id = (select auth.uid())
    and public._is_match_deelnemer(match_id, (select auth.uid()))
  );

-- Bewust geen update- of delete-policy: er is geen "toch niet"-knop, en de
-- afhandeling loopt uitsluitend via de SECURITY DEFINER-functies.
revoke insert, update on public.point_appeals from authenticated;
grant insert (match_id, claimant_id, set_number, reden, toelichting)
  on public.point_appeals to authenticated;

create policy "point_appeal_votes_select_zichtbaar" on public.point_appeal_votes
  for select
  using (
    exists (
      select 1 from public.point_appeals a
      where a.id = appeal_id
        and public._mag_beroep_zien(a.match_id, (select auth.uid()))
    )
  );

create policy "point_appeal_votes_insert_own" on public.point_appeal_votes
  for insert
  with check (voter_id = (select auth.uid()));

revoke insert, update on public.point_appeal_votes from authenticated;
grant insert (appeal_id, voter_id, akkoord)
  on public.point_appeal_votes to authenticated;

grant select on table public.point_appeals, public.point_appeal_votes
  to authenticated, anon;
