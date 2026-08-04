-- #1003 Geheim wapen: één joker per kalendermaand. Spiegel van het nieuwe
-- supabase/schemas/tables/24_match_jokers.sql en
-- supabase/schemas/functions/35_match_jokers.sql, plus de aanpassingen aan
-- tables/05_matches.sql (het enum), tables/08_ratings.sql (rating_history),
-- functions/09_ratings.sql (de Elo-kern), functions/30_match_stakes.sql (de
-- anti-stapel-check) en policies/zz_client_read_grants.sql; zie die bestanden
-- voor de volledige motivatie.
--
-- Kern: drie kaarten, waarvan er twee de rating raken. schild zet de mutatie
-- van die ene speler op 0 (geen verlies, maar ook geen winst),
-- dubbel_of_niets verdubbelt hem in beide richtingen, en wissel_van_kant is
-- een sociale afspraak zonder Elo-gevolg. Het maandtegoed wordt niet
-- uitgedeeld maar afgeleid: één rij per speler per maand, afgedwongen door een
-- unieke index — zoals het dagtegoed van de lef-tip (#804).

-- 1. Type + tabel -----------------------------------------------------------

create type public.joker_type as enum (
  'schild',
  'dubbel_of_niets',
  'wissel_van_kant'
);

create table public.match_jokers (
  match_id uuid not null references public.matches (id) on delete cascade,
  player_id uuid not null references public.profiles (id) on delete cascade,
  group_id uuid not null references public.groups (id) on delete cascade,
  joker public.joker_type not null,
  -- Eerste dag van de maand van de match, in clubtijd, serverside gezet door
  -- de guard. Snapshot van het speelmoment (zoals play_date bij de lef-tip):
  -- verschuift de match later naar een andere maand, dan blijft de kolom staan
  -- en kan een tijdswijziging niet op de unieke index botsen.
  period_month date not null,
  created_at timestamptz not null default now(),
  primary key (match_id, player_id)
);

-- Het maandtegoed. Een telling in de guard zou onder twee gelijktijdige
-- inserts allebei doorlaten, een unieke index niet.
create unique index match_jokers_one_per_month
  on public.match_jokers (player_id, period_month);
create index match_jokers_group_idx on public.match_jokers (group_id);

alter table public.match_jokers enable row level security;

-- 2. Policies + grants ------------------------------------------------------

create policy "match_jokers_select_member" on public.match_jokers
  for select
  using (public.is_group_member(group_id, (select auth.uid())));

create policy "match_jokers_insert_own" on public.match_jokers
  for insert
  with check (
    player_id = (select auth.uid())
    and public.is_group_member(group_id, (select auth.uid()))
  );

-- Bewust geen update-policy: van kaart wisselen is intrekken en opnieuw spelen.
create policy "match_jokers_delete_own" on public.match_jokers
  for delete
  using (player_id = (select auth.uid()));

-- period_month wordt uitsluitend door de guard gezet en draagt het tegoed; RLS
-- kan geen kolommen beschermen, dus de insert-grant is smal.
revoke insert, update on public.match_jokers from authenticated;
grant insert (match_id, player_id, group_id, joker) on public.match_jokers to authenticated;
grant select on table public.match_jokers to authenticated, anon;

-- 3. Guards -----------------------------------------------------------------

create or replace function public.match_jokers_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  tz constant text := 'Europe/Brussels';
  -- Zelfde drempel als de lef-tip: E[Δ] = 0 geldt alleen als E de wérkelijke
  -- winkans is, en iedereen start op 1000. Geldt niet voor wissel_van_kant,
  -- die de rating niet raakt.
  min_games constant int := 10;
  m record;
begin
  select id, group_id, status, played_at, team_a_id, team_b_id, format
    into m
    from public.matches
    where id = new.match_id;

  if m.id is null then
    raise exception 'match bestaat niet';
  end if;
  if m.group_id is null or m.group_id is distinct from new.group_id then
    raise exception 'een joker kan alleen op groepsmatches';
  end if;
  if m.status <> 'scheduled' then
    raise exception 'deze match is al begonnen of afgerond';
  end if;
  if m.played_at is null then
    raise exception 'deze match heeft nog geen starttijd';
  end if;
  if m.played_at <= now() then
    raise exception 'de match is al begonnen';
  end if;
  if not (
       public.is_team_member(m.team_a_id, new.player_id)
       or public.is_team_member(m.team_b_id, new.player_id)
     ) then
    raise exception 'alleen spelers uit deze match kunnen een joker spelen';
  end if;
  if new.joker = 'wissel_van_kant' and m.format <> '2v2' then
    raise exception 'van kant wisselen kan alleen in het dubbelspel';
  end if;
  if new.joker in ('schild', 'dubbel_of_niets')
     and coalesce(
           (select games from public.player_ratings where player_id = new.player_id),
           0
         ) < min_games then
    raise exception
      'je rating is nog niet ingelopen: deze joker kan vanaf % gespeelde matches',
      min_games;
  end if;
  -- Anti-stapelen: naast een lef-tip zou dubbel_of_niets ×4 opleveren en zou
  -- een schild die lef-tip geruisloos laten verdampen. Eén risicokeuze per
  -- match; wissel_van_kant raakt de rating niet en mag er wél naast.
  if new.joker in ('schild', 'dubbel_of_niets')
     and exists (
       select 1 from public.match_stakes s
       where s.match_id = new.match_id and s.player_id = new.player_id
     ) then
    raise exception 'je lef staat al op deze match: trek die eerst in';
  end if;

  new.period_month := date_trunc('month', m.played_at at time zone tz)::date;
  return new;
end;
$$;

create trigger match_jokers_guard
  before insert or update on public.match_jokers
  for each row execute function public.match_jokers_guard();

create or replace function public.match_jokers_delete_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  m record;
begin
  if pg_trigger_depth() > 1 then
    return old; -- cascade (match of groep verwijderd): altijd toestaan
  end if;
  select status, played_at into m from public.matches where id = old.match_id;
  if not found then
    return old; -- match al verwijderd
  end if;
  if m.status <> 'scheduled' or (m.played_at is not null and m.played_at <= now()) then
    raise exception 'je joker staat vast: de match is al begonnen of afgerond';
  end if;
  return old;
end;
$$;

create trigger match_jokers_delete_guard
  before delete on public.match_jokers
  for each row execute function public.match_jokers_delete_guard();

-- Andere kant van het anti-stapelen: de lef-tip weigert een match waar al een
-- rating-joker van dezelfde speler op staat. Volledige herdefinitie van
-- match_stakes_guard (#804) met die ene extra check erbij.
create or replace function public.match_stakes_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  tz constant text := 'Europe/Brussels';
  min_games constant int := 10;
  m record;
begin
  select id, group_id, status, played_at, team_a_id, team_b_id
    into m
    from public.matches
    where id = new.match_id;

  if m.id is null then
    raise exception 'match bestaat niet';
  end if;
  if m.group_id is null or m.group_id is distinct from new.group_id then
    raise exception 'een lef-tip kan alleen op groepsmatches';
  end if;
  if m.status <> 'scheduled' then
    raise exception 'deze match is al begonnen of afgerond';
  end if;
  if m.played_at is null then
    raise exception 'deze match heeft nog geen starttijd';
  end if;
  if m.played_at <= now() then
    raise exception 'de match is al begonnen';
  end if;
  if not (
       public.is_team_member(m.team_a_id, new.player_id)
       or public.is_team_member(m.team_b_id, new.player_id)
     ) then
    raise exception 'alleen spelers uit deze match kunnen inzetten';
  end if;
  if coalesce(
       (select games from public.player_ratings where player_id = new.player_id),
       0
     ) < min_games then
    raise exception
      'je rating is nog niet ingelopen: inzetten kan vanaf % gespeelde matches',
      min_games;
  end if;
  if exists (
       select 1 from public.match_jokers j
       where j.match_id = new.match_id
         and j.player_id = new.player_id
         and j.joker in ('schild', 'dubbel_of_niets')
     ) then
    raise exception 'je joker staat al op deze match: trek die eerst in';
  end if;

  new.play_date := (m.played_at at time zone tz)::date;
  return new;
end;
$$;

-- 4. Factor ------------------------------------------------------------------

-- De joker van één speler op één match, of null.
create or replace function public._player_joker(p_player uuid, p_match uuid)
returns public.joker_type
language sql
security definer
set search_path = ''
stable
as $$
  select j.joker
    from public.match_jokers j
    where j.match_id = p_match and j.player_id = p_player;
$$;

revoke execute on function public._player_joker(uuid, uuid) from public;

-- Lef-tip en joker in één multiplier: schild → 0, dubbel_of_niets → 2 (alleen
-- met winnaar, zoals de lef-tip), anders de lef-tip-factor. greatest() en geen
-- product: de guards verbieden de combinatie al, maar een rij die er buiten om
-- toch komt mag hooguit ×2 opleveren en nooit ×4. Pure functie van opgeslagen
-- data, dus recompute_ratings() geeft hetzelfde als het incrementele pad.
create or replace function public._effect_factor(
  p_player uuid,
  p_match uuid,
  p_has_winner boolean,
  p_joker public.joker_type
)
returns numeric
language sql
security definer
set search_path = ''
stable
as $$
  select case
    when p_joker = 'schild' then 0.0
    else greatest(
      public._stake_factor(p_player, p_match, p_has_winner),
      case when p_joker = 'dubbel_of_niets' and p_has_winner then 2.0 else 1.0 end
    )
  end;
$$;

revoke execute on function public._effect_factor(uuid, uuid, boolean, public.joker_type) from public;

-- 5. rating_history: gespeelde joker meeloggen -------------------------------

-- Bestaande rijen krijgen null; recent_rating_history en ratings_as_of (#731)
-- selecteren expliciete kolommen en blijven dus ongewijzigd.
alter table public.rating_history
  add column joker public.joker_type;

-- 6. Elo-kern ----------------------------------------------------------------

-- _apply_rating krijgt er een parameter bij. create or replace zou een overload
-- maken in plaats van een vervanging, dus eerst droppen; de revoke execute moet
-- daarna opnieuw (rechten verdwijnen mee met de functie). Beide eerdere
-- signaturen worden gedropt: die van vóór de Pechvogel-meter (#1005) en die
-- mét p_troost, zodat er geen overload achterblijft ongeacht welke van de twee
-- in deze databank staat.
drop function if exists public._apply_rating(uuid, uuid, int, timestamptz, numeric, int);
drop function if exists public._apply_rating(uuid, uuid, int, timestamptz, numeric, int, int);

create or replace function public._apply_rating(
  p_player uuid,
  p_match uuid,
  p_delta int,
  p_ts timestamptz,
  p_factor numeric,
  p_bounty int,
  p_troost int,
  p_joker public.joker_type
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before int;
  v_after int;
begin
  select rating into v_before from public.player_ratings where player_id = p_player;
  if v_before is null then
    v_before := 1000;
  end if;
  v_after := v_before + p_delta;

  insert into public.player_ratings (player_id, rating, games, updated_at)
  values (p_player, v_after, 1, now())
  on conflict (player_id) do update
    set rating = v_after,
        games = public.player_ratings.games + 1,
        updated_at = now();

  insert into public.rating_history (
    player_id, match_id, rating_before, rating_after, delta, played_at,
    stake_factor, bounty_delta, troost_delta, joker
  )
  values (
    p_player, p_match, v_before, v_after, p_delta, p_ts,
    p_factor, p_bounty, p_troost, p_joker
  );
end;
$$;

revoke execute on function public._apply_rating(
  uuid, uuid, int, timestamptz, numeric, int, int, public.joker_type
) from public;

-- Rekenkern: identiek aan #805, met _stake_factor vervangen door de
-- gecombineerde _effect_factor en de gespeelde joker erbij in de log.
create or replace function public._apply_match_rating(p_match uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  k constant numeric := 24;      -- K-factor
  base constant int := 1000;
  m record;
  a1 uuid; a2 uuid; b1 uuid; b2 uuid;
  ra numeric; rb numeric;        -- teamratings (gemiddelde van de aanwezige spelers)
  ea numeric;                    -- verwachte score team A
  sa numeric;                    -- werkelijke score team A (1/0.5/0)
  da numeric; db numeric;        -- ongeronde rating-delta per team
  winnaar boolean;               -- geen winnaar = gelijkspel (#804)
  f numeric;                     -- effectieve multiplier van de speler in kwestie
  jk public.joker_type;          -- gespeelde joker van die speler (#1003)
  bounties jsonb;                -- bounty-verschuiving per speler (#805)
  bo int;                        -- bounty van de speler in kwestie
  ru int;                        -- mutatie vóór troost (lef, joker en bounty verwerkt)
  tr int;                        -- troostdemper van de speler in kwestie (#1005)
begin
  select mt.id, mt.team_a_id, mt.team_b_id, mt.winner_team_id,
         coalesce(mt.played_at, mt.created_at) as ts
    into m
    from public.matches mt
    where mt.id = p_match;

  if m.id is null then
    return;
  end if;

  select ta.player1_id, ta.player2_id, tb.player1_id, tb.player2_id
    into a1, a2, b1, b2
    from public.teams ta, public.teams tb
    where ta.id = m.team_a_id and tb.id = m.team_b_id;

  -- Ontbrekende teams (verwijderd?) overslaan.
  if a1 is null or b1 is null then
    return;
  end if;

  -- Bij singles (a2/b2 null) telt alleen de rating van de ene speler; anders
  -- zou een fantoom-partner van 1000 meegemiddeld worden.
  ra := case when a2 is null
    then coalesce((select rating from public.player_ratings where player_id = a1), base)
    else (
      coalesce((select rating from public.player_ratings where player_id = a1), base)
      + coalesce((select rating from public.player_ratings where player_id = a2), base)
    ) / 2.0
  end;
  rb := case when b2 is null
    then coalesce((select rating from public.player_ratings where player_id = b1), base)
    else (
      coalesce((select rating from public.player_ratings where player_id = b1), base)
      + coalesce((select rating from public.player_ratings where player_id = b2), base)
    ) / 2.0
  end;

  ea := 1.0 / (1.0 + power(10.0, (rb - ra) / 400.0));
  sa := case
          when m.winner_team_id = m.team_a_id then 1.0
          when m.winner_team_id = m.team_b_id then 0.0
          else 0.5
        end;

  da := k * (sa - ea);
  db := k * ((1.0 - sa) - (1.0 - ea));

  -- De factor gaat op de ONGERONDE delta en er wordt daarna één keer afgerond;
  -- round() op de al afgeronde int zou een ander getal geven en het
  -- incrementele pad van recompute_ratings laten driften.
  winnaar := m.winner_team_id is not null;

  -- Bounty (#805): komt bovenop de (verdubbelde of afgeschermde) mutatie. Een
  -- schild schermt de bounty bewust níét af: de pool is een strikte overdracht,
  -- dus zou de drager niets betalen terwijl de winnaars wél ontvangen, dan
  -- maakt elke claim Elo bij.
  select coalesce(jsonb_object_agg(x.player_id::text, x.bounty), '{}'::jsonb)
    into bounties
    from public._bounty_deltas(m.id) x;

  -- Troostdemper (#1005) komt er als laatste bij, over de al door lef, joker en
  -- bounty bewerkte mutatie. Wie een schild speelde levert niets in en krijgt
  -- dus ook geen troost: _troost_delta geeft bij een niet-negatieve mutatie 0.
  jk := public._player_joker(a1, m.id);
  f := public._effect_factor(a1, m.id, winnaar, jk);
  bo := coalesce((bounties ->> a1::text)::int, 0);
  ru := round(da * f)::int + bo;
  tr := public._troost_delta(m.id, a1, ru);
  perform public._apply_rating(a1, m.id, ru + tr, m.ts, f, bo, tr, jk);
  if a2 is not null then
    jk := public._player_joker(a2, m.id);
    f := public._effect_factor(a2, m.id, winnaar, jk);
    bo := coalesce((bounties ->> a2::text)::int, 0);
    ru := round(da * f)::int + bo;
    tr := public._troost_delta(m.id, a2, ru);
    perform public._apply_rating(a2, m.id, ru + tr, m.ts, f, bo, tr, jk);
  end if;
  jk := public._player_joker(b1, m.id);
  f := public._effect_factor(b1, m.id, winnaar, jk);
  bo := coalesce((bounties ->> b1::text)::int, 0);
  ru := round(db * f)::int + bo;
  tr := public._troost_delta(m.id, b1, ru);
  perform public._apply_rating(b1, m.id, ru + tr, m.ts, f, bo, tr, jk);
  if b2 is not null then
    jk := public._player_joker(b2, m.id);
    f := public._effect_factor(b2, m.id, winnaar, jk);
    bo := coalesce((bounties ->> b2::text)::int, 0);
    ru := round(db * f)::int + bo;
    tr := public._troost_delta(m.id, b2, ru);
    perform public._apply_rating(b2, m.id, ru + tr, m.ts, f, bo, tr, jk);
  end if;
end;
$$;

revoke execute on function public._apply_match_rating(uuid) from public;

-- 7. Realtime ----------------------------------------------------------------

alter publication supabase_realtime add table public.match_jokers;
