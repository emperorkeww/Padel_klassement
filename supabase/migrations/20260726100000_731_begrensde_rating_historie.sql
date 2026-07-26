-- #731: begrensde lees-RPC's op rating_history. Spiegel van
-- supabase/schemas/functions/29_rating_history.sql; zie dat bestand voor de
-- volledige motivatie. Kern: de client haalde de vólledige tabel op, PostgREST
-- kapt dat stil af op max_rows (1000) en rating_history groeit met ~4 rijen per
-- match. recent_rating_history laat de payload met het aantal SPELERS schalen
-- i.p.v. met het aantal matches; ratings_as_of bedient de tijdmachine met één
-- rij per speler.
create or replace function public.recent_rating_history(p_limit int default 20)
returns table (
  player_id uuid,
  match_id uuid,
  rating_before int,
  rating_after int,
  delta int,
  played_at timestamptz
)
language sql
stable
set search_path = ''
as $$
  select h.player_id, h.match_id, h.rating_before, h.rating_after, h.delta,
    h.played_at
  from (
    select r.player_id, r.match_id, r.rating_before, r.rating_after, r.delta,
      r.played_at,
      row_number() over (
        partition by r.player_id
        order by r.played_at desc, r.id desc
      ) as rn
    from public.rating_history r
  ) h
  where h.rn <= least(greatest(coalesce(p_limit, 20), 1), 50)
  order by h.player_id, h.played_at, h.match_id
$$;

create or replace function public.ratings_as_of(p_date date)
returns table (
  player_id uuid,
  rating int,
  played_at timestamptz
)
language sql
stable
set search_path = ''
as $$
  select distinct on (r.player_id) r.player_id, r.rating_after as rating,
    r.played_at
  from public.rating_history r
  where r.played_at < ((p_date + 1)::timestamp at time zone 'UTC')
  order by r.player_id, r.played_at desc, r.id desc
$$;

grant execute on function public.recent_rating_history(int) to authenticated, anon;
grant execute on function public.ratings_as_of(date) to authenticated, anon;
