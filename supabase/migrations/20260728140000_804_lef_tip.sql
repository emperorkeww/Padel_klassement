-- #804 Lef-tip: een deelnemer zet vóór de aftrap zijn eigen Elo-mutatie dubbel
-- op het spel (winst ×2 én verlies ×2). Spiegel van
-- supabase/schemas/tables/21_match_stakes.sql,
-- supabase/schemas/functions/30_match_stakes.sql,
-- supabase/schemas/policies/match_stakes.sql en de aanpassingen aan
-- tables/08_ratings.sql + functions/09_ratings.sql; zie die bestanden voor de
-- volledige motivatie. Kern: symmetrisch risico houdt de verwachting op nul —
-- winst ×2 met verlies ÷2 zou 1,5 · K · E · (1 − E) gratis Elo per match
-- opleveren en het klassement laten oplopen.

-- 1. Tabel + het lef-tegoed -------------------------------------------------

create table public.match_stakes (
  match_id uuid not null references public.matches (id) on delete cascade,
  player_id uuid not null references public.profiles (id) on delete cascade,
  group_id uuid not null references public.groups (id) on delete cascade,
  -- Speeldag in clubtijd, serverside gezet door de guard. De unieke index
  -- hieronder dwingt het tegoed (één inzet per speeldag) atomair af; een
  -- telling in de guard zou onder gelijktijdige inserts allebei doorlaten.
  play_date date not null,
  created_at timestamptz not null default now(),
  primary key (match_id, player_id)
);

create unique index match_stakes_one_per_day
  on public.match_stakes (player_id, play_date);
create index match_stakes_group_idx on public.match_stakes (group_id);

alter table public.match_stakes enable row level security;

-- 2. Policies + grants ------------------------------------------------------

create policy "match_stakes_select_member" on public.match_stakes
  for select
  using (public.is_group_member(group_id, (select auth.uid())));

create policy "match_stakes_insert_own" on public.match_stakes
  for insert
  with check (
    player_id = (select auth.uid())
    and public.is_group_member(group_id, (select auth.uid()))
  );

-- Bewust geen update-policy: aan een inzet valt niets te wijzigen.
create policy "match_stakes_delete_own" on public.match_stakes
  for delete
  using (player_id = (select auth.uid()));

revoke insert, update on public.match_stakes from authenticated;
grant insert (match_id, player_id, group_id) on public.match_stakes to authenticated;
grant select on table public.match_stakes to authenticated, anon;

-- 3. Guards -----------------------------------------------------------------

create or replace function public.match_stakes_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  tz constant text := 'Europe/Brussels';
  -- Drempel tegen het verdubbelen van een nog niet ingelopen rating: E[Δ] = 0
  -- geldt alleen als E de wérkelijke winkans is, en iedereen start op 1000.
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

  new.play_date := (m.played_at at time zone tz)::date;
  return new;
end;
$$;

create trigger match_stakes_guard
  before insert or update on public.match_stakes
  for each row execute function public.match_stakes_guard();

create or replace function public.match_stakes_delete_guard()
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
    raise exception 'je inzet staat vast: de match is al begonnen of afgerond';
  end if;
  return old;
end;
$$;

create trigger match_stakes_delete_guard
  before delete on public.match_stakes
  for each row execute function public.match_stakes_delete_guard();

-- Multiplier van één speler op één match. Gelijkspel telt niet mee:
-- K · (0,5 − E) is voor een underdog positief en mag geen beloning voor een
-- mislukte tip worden.
create or replace function public._stake_factor(
  p_player uuid,
  p_match uuid,
  p_has_winner boolean
)
returns numeric
language sql
security definer
set search_path = ''
stable
as $$
  select case
    when p_has_winner and exists (
      select 1
      from public.match_stakes s
      where s.match_id = p_match and s.player_id = p_player
    ) then 2.0
    else 1.0
  end;
$$;

revoke execute on function public._stake_factor(uuid, uuid, boolean) from public;

-- 4. rating_history: gebruikte factor meeloggen -----------------------------

-- Bestaande rijen krijgen 1.00; recent_rating_history en ratings_as_of (#731)
-- selecteren expliciete kolommen en blijven dus ongewijzigd.
alter table public.rating_history
  add column stake_factor numeric(3, 2) not null default 1.0;

-- 5. Elo-kern ---------------------------------------------------------------

-- _apply_rating krijgt er een parameter bij. create or replace zou een
-- overload maken in plaats van een vervanging, dus eerst droppen; de
-- revoke execute moet daarna opnieuw (rechten verdwijnen mee met de functie).
drop function if exists public._apply_rating(uuid, uuid, int, timestamptz);

create or replace function public._apply_rating(
  p_player uuid,
  p_match uuid,
  p_delta int,
  p_ts timestamptz,
  p_factor numeric
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

  insert into public.rating_history (player_id, match_id, rating_before, rating_after, delta, played_at, stake_factor)
  values (p_player, p_match, v_before, v_after, p_delta, p_ts, p_factor);
end;
$$;

revoke execute on function public._apply_rating(uuid, uuid, int, timestamptz, numeric) from public;

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
  f numeric;                     -- lef-tip-multiplier van de speler in kwestie
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

  -- Lef-tip (#804): wie ingezet heeft krijgt zijn eigen mutatie ×2, in beide
  -- richtingen — dubbel of niets. De factor gaat op de ONGERONDE delta en er
  -- wordt daarna één keer afgerond; round() op de al afgeronde int zou een
  -- ander getal geven en het incrementele pad van recompute_ratings laten
  -- driften. De factor is strikt individueel: partner en tegenstanders houden
  -- hun normale mutatie, waardoor een match met inzet niet langer zero-sum is.
  winnaar := m.winner_team_id is not null;

  f := public._stake_factor(a1, m.id, winnaar);
  perform public._apply_rating(a1, m.id, round(da * f)::int, m.ts, f);
  if a2 is not null then
    f := public._stake_factor(a2, m.id, winnaar);
    perform public._apply_rating(a2, m.id, round(da * f)::int, m.ts, f);
  end if;
  f := public._stake_factor(b1, m.id, winnaar);
  perform public._apply_rating(b1, m.id, round(db * f)::int, m.ts, f);
  if b2 is not null then
    f := public._stake_factor(b2, m.id, winnaar);
    perform public._apply_rating(b2, m.id, round(db * f)::int, m.ts, f);
  end if;
end;
$$;

revoke execute on function public._apply_match_rating(uuid) from public;

-- 6. Realtime ---------------------------------------------------------------

alter publication supabase_realtime add table public.match_stakes;
