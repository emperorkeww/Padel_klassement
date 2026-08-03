-- #1005 Pechvogel-meter: drie nipte nederlagen op rij leveren een demper op het
-- ratingverlies van de derde. Spiegel van
-- supabase/schemas/functions/33_pechvogel.sql (detectie + demper),
-- supabase/schemas/functions/09_ratings.sql (wiring in de Elo-kern),
-- supabase/schemas/tables/08_ratings.sql (kolom) en
-- supabase/schemas/functions/29_rating_history.sql (lees-RPC).
--
-- Historische matches blijven ongemoeid: de demper geldt pas vanaf de
-- vanaf-constante in _troost_delta, precies zoals bij de bounty (#805). Zonder
-- die grens zou de eerstvolgende recompute_ratings() de hele historie
-- herschrijven.

-- 1. De demper meelogbaar maken, naast stake_factor (#804) en bounty_delta (#805).
alter table public.rating_history
  add column troost_delta int not null default 0;

comment on column public.rating_history.troost_delta is
  'Troostdemper van de Pechvogel-meter (#1005), al verwerkt in delta.';

-- 2. Detectie + demper.

create or replace function public._is_nipt(p_a smallint, p_b smallint)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_a is not null
     and p_b is not null
     and p_a <> p_b
     and abs(p_a - p_b) <= 2;
$$;

revoke execute on function public._is_nipt(smallint, smallint) from public;

create or replace function public.pech_streak(
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
      public._is_nipt(mt.score_a, mt.score_b) as nipt,
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
    (
      select min(rn)::int - 1
      from mijn
      where not (
        nipt
        and winner_team_id is not null
        and winner_team_id is distinct from mijn_team
      )
    ),
    (select count(*)::int from mijn)
  );
$$;

grant execute on function public.pech_streak(uuid, timestamptz, timestamptz, uuid)
  to authenticated, anon;

create or replace function public._troost_delta(
  p_match uuid,
  p_player uuid,
  p_delta int
)
returns int
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  doel constant int := 3;
  troost_max constant int := 4;
  vanaf constant timestamptz := '2026-08-04 00:00:00+02';
  m record;
  v_mijn_team uuid;
  v_streak int;
  v_troost int;
begin
  if p_delta >= 0 then
    return 0;
  end if;

  select mt.id, mt.team_a_id, mt.team_b_id, mt.winner_team_id,
         mt.score_a, mt.score_b,
         coalesce(mt.played_at, mt.created_at) as ts, mt.created_at
    into m
    from public.matches mt
    where mt.id = p_match;

  if m.id is null or m.winner_team_id is null or m.ts < vanaf then
    return 0;
  end if;

  if not public._is_nipt(m.score_a, m.score_b) then
    return 0;
  end if;

  select case
           when ta.player1_id = p_player or ta.player2_id = p_player then m.team_a_id
           when tb.player1_id = p_player or tb.player2_id = p_player then m.team_b_id
         end
    into v_mijn_team
    from public.teams ta, public.teams tb
    where ta.id = m.team_a_id and tb.id = m.team_b_id;

  if v_mijn_team is null or m.winner_team_id = v_mijn_team then
    return 0;
  end if;

  v_streak := public.pech_streak(p_player, m.ts, m.created_at, m.id) + 1;
  if v_streak % doel <> 0 then
    return 0;
  end if;

  v_troost := least(troost_max, ((-p_delta) + 1) / 2);
  return least(v_troost, -p_delta);
end;
$$;

revoke execute on function public._troost_delta(uuid, uuid, int) from public;

-- 3. De Elo-kern. _apply_rating krijgt er een parameter bij; dat is een nieuwe
-- overload, dus de oude zes-argumentenversie moet weg — anders wordt de
-- aanroep dubbelzinnig zodra er een default in het spel komt en blijft er een
-- functie rondslingeren die nooit meer aangeroepen wordt.
drop function if exists public._apply_rating(uuid, uuid, int, timestamptz, numeric, int);

create or replace function public._apply_rating(
  p_player uuid,
  p_match uuid,
  p_delta int,
  p_ts timestamptz,
  p_factor numeric,
  p_bounty int,
  p_troost int
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
    stake_factor, bounty_delta, troost_delta
  )
  values (p_player, p_match, v_before, v_after, p_delta, p_ts, p_factor,
          p_bounty, p_troost);
end;
$$;

revoke execute on function public._apply_rating(uuid, uuid, int, timestamptz, numeric, int, int) from public;

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
  ru int;                        -- mutatie vóór troost (lef + bounty verwerkt)
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

  if a1 is null or b1 is null then
    return;
  end if;

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

  winnaar := m.winner_team_id is not null;

  select coalesce(jsonb_object_agg(x.player_id::text, x.bounty), '{}'::jsonb)
    into bounties
    from public._bounty_deltas(m.id) x;

  -- Troostdemper (#1005): gaat over de al door lef en bounty bewerkte mutatie
  -- en komt er als laatste bij, zodat de demper nooit verdubbeld wordt door een
  -- eigen lef-tip.
  f := public._stake_factor(a1, m.id, winnaar);
  bo := coalesce((bounties ->> a1::text)::int, 0);
  ru := round(da * f)::int + bo;
  tr := public._troost_delta(m.id, a1, ru);
  perform public._apply_rating(a1, m.id, ru + tr, m.ts, f, bo, tr);
  if a2 is not null then
    f := public._stake_factor(a2, m.id, winnaar);
    bo := coalesce((bounties ->> a2::text)::int, 0);
    ru := round(da * f)::int + bo;
    tr := public._troost_delta(m.id, a2, ru);
    perform public._apply_rating(a2, m.id, ru + tr, m.ts, f, bo, tr);
  end if;
  f := public._stake_factor(b1, m.id, winnaar);
  bo := coalesce((bounties ->> b1::text)::int, 0);
  ru := round(db * f)::int + bo;
  tr := public._troost_delta(m.id, b1, ru);
  perform public._apply_rating(b1, m.id, ru + tr, m.ts, f, bo, tr);
  if b2 is not null then
    f := public._stake_factor(b2, m.id, winnaar);
    bo := coalesce((bounties ->> b2::text)::int, 0);
    ru := round(db * f)::int + bo;
    tr := public._troost_delta(m.id, b2, ru);
    perform public._apply_rating(b2, m.id, ru + tr, m.ts, f, bo, tr);
  end if;
end;
$$;

revoke execute on function public._apply_match_rating(uuid) from public;

-- 4. De lees-RPC krijgt de kolom erbij. Het returntype wijzigt daarmee, en dat
-- kan create or replace niet: eerst droppen. Zelfde ingreep als bij de bounty
-- (20260729160000_805_bounty_historie.sql).
drop function if exists public.recent_rating_history(int);

create or replace function public.recent_rating_history(p_limit int default 20)
returns table (
  player_id uuid,
  match_id uuid,
  rating_before int,
  rating_after int,
  delta int,
  played_at timestamptz,
  stake_factor numeric,
  bounty_delta int,
  troost_delta int
)
language sql
stable
set search_path = ''
as $$
  select h.player_id, h.match_id, h.rating_before, h.rating_after, h.delta,
    h.played_at, h.stake_factor, h.bounty_delta, h.troost_delta
  from (
    select r.player_id, r.match_id, r.rating_before, r.rating_after, r.delta,
      r.played_at, r.stake_factor, r.bounty_delta, r.troost_delta,
      row_number() over (
        partition by r.player_id
        order by r.played_at desc, r.id desc
      ) as rn
    from public.rating_history r
  ) h
  where h.rn <= least(greatest(coalesce(p_limit, 20), 1), 50)
  order by h.player_id, h.played_at, h.match_id
$$;

grant execute on function public.recent_rating_history(int) to authenticated, anon;
