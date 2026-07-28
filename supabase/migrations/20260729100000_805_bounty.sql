-- #805 Bounty op de "Big Daddy" of Dictator: wie bovenaan staat draagt een prijs
-- op z'n hoofd. Verslaat een team hem, dan verhuist de opgebouwde pool als extra
-- Elo naar de winnaars — strikt zero-sum, de drager betaalt precies wat de
-- winnaars samen krijgen. Spiegel van supabase/schemas/functions/31_bounty.sql,
-- views/active_bounties.sql en de aanpassingen aan tables/08_ratings.sql +
-- functions/09_ratings.sql; zie die bestanden voor de volledige motivatie.
--
-- Kern: er komt géén bounty_pools-tabel. recompute_ratings() speelt de hele
-- matchhistorie opnieuw af bij elke correctie; muteerbare state daarnaast gaat
-- driften. Zowel het dragerschap (player_ratings op het replay-moment) als de
-- pool (zegereeks uit matches, in dezelfde totale orde als de replay) is een
-- pure functie van opgeslagen data — net als _stake_factor bij de lef-tip.
--
-- De constante `vanaf` in _bounty_deltas begrenst de feature tot matches vanaf
-- 2026-07-29. Zonder die grens zou de eerstvolgende recompute met terugwerkende
-- kracht de hele historie herschrijven en de zittende #1 alsnog elke oude
-- nederlaag laten betalen.

-- 1. Bounty-functies --------------------------------------------------------

create or replace function public.bounty_value(p_streak int)
returns int
language sql
immutable
set search_path = ''
as $$
  select least(15 + 3 * greatest(coalesce(p_streak, 0), 0), 30);
$$;

-- Actieve zegereeks vlak vóór een punt in de historie. Snijdt op de totale orde
-- van recompute_ratings, zodat de reeks tijdens een replay exact de al
-- verwerkte matches ziet. Defaults ('infinity') = de reeks tot nu.
create or replace function public.bounty_streak(
  p_player uuid,
  p_ts timestamptz default 'infinity',
  p_created timestamptz default 'infinity',
  p_match uuid default '00000000-0000-0000-0000-000000000000'
)
returns int
language sql
security definer
set search_path = ''
stable
as $$
  with mijn as (
    select
      mt.winner_team_id,
      case
        when ta.player1_id = p_player or ta.player2_id = p_player
        then mt.team_a_id else mt.team_b_id
      end as mijn_team,
      row_number() over (
        order by coalesce(mt.played_at, mt.created_at) desc, mt.created_at desc, mt.id desc
      ) as rn
    from public.matches mt
    join public.teams ta on ta.id = mt.team_a_id
    join public.teams tb on tb.id = mt.team_b_id
    where mt.status = 'completed'
      and (coalesce(mt.played_at, mt.created_at), mt.created_at, mt.id)
          < (p_ts, p_created, p_match)
      and (ta.player1_id = p_player or ta.player2_id = p_player
           or tb.player1_id = p_player or tb.player2_id = p_player)
  )
  select coalesce(
    (select min(rn)::int - 1 from mijn where winner_team_id is distinct from mijn_team),
    (select count(*)::int from mijn)
  );
$$;

-- Hoogst gerate niet-gast van een groep (de Big Daddy). Tie-break als in de
-- troon-replay (#545): langste lid eerst, dan id.
create or replace function public._group_leader(p_group uuid, p_min_games int)
returns uuid
language sql
security definer
set search_path = ''
stable
as $$
  select gm.player_id
  from public.group_members gm
  join public.profiles p on p.id = gm.player_id
  join public.player_ratings r on r.player_id = gm.player_id
  where gm.group_id = p_group
    and not p.is_guest
    and r.games >= p_min_games
  order by r.rating desc, p.created_at asc, p.id asc
  limit 1;
$$;

revoke execute on function public._group_leader(uuid, int) from public;

-- Elo-verschuiving door de bounty op één match: negatief voor de verslagen
-- drager(s), positief voor de winnaars, samen exact nul.
create or replace function public._bounty_deltas(p_match uuid)
returns table (player_id uuid, bounty int)
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  drempel constant int := 1600;   -- El Padelissimo-instap (#527, tiers.ts)
  min_games constant int := 3;    -- THIN_GAMES: dunne rating draagt geen kroon
  vanaf constant timestamptz := '2026-07-29 00:00:00+02';
  m record;
  d record;
  v_win_team uuid;
  v_los_team uuid;
  w1 uuid; w2 uuid;
  l1 uuid; l2 uuid;
  v_pot int := 0;
begin
  select mt.id, mt.team_a_id, mt.team_b_id, mt.winner_team_id, mt.group_id,
         coalesce(mt.played_at, mt.created_at) as ts, mt.created_at
    into m
    from public.matches mt
    where mt.id = p_match;

  if m.id is null or m.winner_team_id is null or m.ts < vanaf then
    return;
  end if;

  v_win_team := m.winner_team_id;
  v_los_team := case when v_win_team = m.team_a_id then m.team_b_id else m.team_a_id end;

  select t.player1_id, t.player2_id into w1, w2 from public.teams t where t.id = v_win_team;
  select t.player1_id, t.player2_id into l1, l2 from public.teams t where t.id = v_los_team;

  if w1 is null or l1 is null then
    return;
  end if;

  for d in
    select v.speler,
           public.bounty_value(
             public.bounty_streak(v.speler, m.ts, m.created_at, m.id)
           ) as pool
    from (select l1 as speler union select l2) v
    join public.profiles p on p.id = v.speler
    join public.player_ratings r on r.player_id = v.speler
    where not p.is_guest
      and r.games >= min_games
      and v.speler is distinct from w1
      and v.speler is distinct from w2
      and (
        r.rating >= drempel
        or (m.group_id is not null and v.speler = public._group_leader(m.group_id, min_games))
      )
  loop
    v_pot := v_pot + d.pool;
    player_id := d.speler;
    bounty := -d.pool;
    return next;
  end loop;

  if v_pot = 0 then
    return;
  end if;

  if w2 is null then
    player_id := w1; bounty := v_pot; return next;
  else
    player_id := w1; bounty := v_pot - (v_pot / 2); return next;
    player_id := w2; bounty := v_pot / 2; return next;
  end if;
end;
$$;

revoke execute on function public._bounty_deltas(uuid) from public;

-- 2. rating_history: de verschuiving meeloggen ------------------------------

-- Bestaande rijen krijgen 0; recent_rating_history en ratings_as_of (#731)
-- selecteren expliciete kolommen en blijven dus ongewijzigd.
alter table public.rating_history
  add column bounty_delta int not null default 0;

-- 3. Elo-kern ---------------------------------------------------------------

-- _apply_rating krijgt er een parameter bij. create or replace zou een overload
-- maken in plaats van een vervanging, dus eerst droppen; de revoke execute moet
-- daarna opnieuw (rechten verdwijnen mee met de functie).
drop function if exists public._apply_rating(uuid, uuid, int, timestamptz, numeric);

create or replace function public._apply_rating(
  p_player uuid,
  p_match uuid,
  p_delta int,
  p_ts timestamptz,
  p_factor numeric,
  p_bounty int
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
    stake_factor, bounty_delta
  )
  values (p_player, p_match, v_before, v_after, p_delta, p_ts, p_factor, p_bounty);
end;
$$;

revoke execute on function public._apply_rating(uuid, uuid, int, timestamptz, numeric, int) from public;

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
  bounties jsonb;                -- bounty-verschuiving per speler (#805)
  bo int;                        -- bounty van de speler in kwestie
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
  -- richtingen. De factor gaat op de ONGERONDE delta en er wordt daarna één
  -- keer afgerond.
  winnaar := m.winner_team_id is not null;

  -- Bounty (#805): de verslagen leider betaalt de pool op zijn hoofd en de
  -- winnaars delen die. Moet vóór de eerste _apply_rating opgehaald worden —
  -- daarna staat player_ratings al op de ná-match-stand en zou de drager-check
  -- de verkeerde ratings zien. De verschuiving komt bovenop de (eventueel
  -- verdubbelde) mutatie: de lef-tip gaat over je eigen zenuwen, een
  -- overgedragen pool verdubbelen zou de boekhouding uit balans trekken.
  select coalesce(jsonb_object_agg(x.player_id::text, x.bounty), '{}'::jsonb)
    into bounties
    from public._bounty_deltas(m.id) x;

  f := public._stake_factor(a1, m.id, winnaar);
  bo := coalesce((bounties ->> a1::text)::int, 0);
  perform public._apply_rating(a1, m.id, round(da * f)::int + bo, m.ts, f, bo);
  if a2 is not null then
    f := public._stake_factor(a2, m.id, winnaar);
    bo := coalesce((bounties ->> a2::text)::int, 0);
    perform public._apply_rating(a2, m.id, round(da * f)::int + bo, m.ts, f, bo);
  end if;
  f := public._stake_factor(b1, m.id, winnaar);
  bo := coalesce((bounties ->> b1::text)::int, 0);
  perform public._apply_rating(b1, m.id, round(db * f)::int + bo, m.ts, f, bo);
  if b2 is not null then
    f := public._stake_factor(b2, m.id, winnaar);
    bo := coalesce((bounties ->> b2::text)::int, 0);
    perform public._apply_rating(b2, m.id, round(db * f)::int + bo, m.ts, f, bo);
  end if;
end;
$$;

revoke execute on function public._apply_match_rating(uuid) from public;

-- 4. Wie draagt er nú een bounty ---------------------------------------------

create view public.active_bounties
with (security_invoker = true) as
with gekwalificeerd as (
  select r.player_id, r.rating, p.created_at
  from public.player_ratings r
  join public.profiles p on p.id = r.player_id
  where not p.is_guest and r.games >= 3
),
dragers as (
  select g.player_id, null::uuid as group_id, 'dictator' as reden
  from gekwalificeerd g
  where g.rating >= 1600
  union all
  -- Subquery: een distinct on heeft z'n eigen order by nodig, en die zou
  -- anders bij de union horen.
  select * from (
    select distinct on (gm.group_id)
           gm.player_id, gm.group_id, 'bigdaddy' as reden
    from public.group_members gm
    join gekwalificeerd g on g.player_id = gm.player_id
    order by gm.group_id, g.rating desc, g.created_at asc, g.player_id asc
  ) bd
)
select
  d.player_id,
  d.group_id,
  d.reden,
  s.streak,
  public.bounty_value(s.streak) as pool
from dragers d
cross join lateral (select public.bounty_streak(d.player_id) as streak) s;

grant select on public.active_bounties to authenticated, anon;

-- Bewust géén recompute_ratings(): de bestaande historie ligt vóór `vanaf` en
-- verandert dus niet. De eerste bounty valt op de eerste match die na de
-- invoering wordt afgerond.