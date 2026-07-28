-- #805 Bounty, deel 2: de verschuiving meegeven aan de client, zodat de feed
-- kan vertellen wie de reeks van de leider brak en voor hoeveel. Zonder dit
-- staat er alleen een ongewoon groot ▲-getal zonder uitleg, en verdwijnt het
-- sappigste moment van de hele feature in de ruis. Spiegel van
-- supabase/schemas/functions/29_rating_history.sql.
--
-- recent_rating_history krijgt er een kolom bij. Het returntype wijzigt daarmee,
-- en dat kan create or replace niet: eerst droppen. Zelfde ingreep als bij de
-- lef-tip (20260728160000_804_lef_tip_historie.sql).
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
  bounty_delta int
)
language sql
stable
set search_path = ''
as $$
  select h.player_id, h.match_id, h.rating_before, h.rating_after, h.delta,
    h.played_at, h.stake_factor, h.bounty_delta
  from (
    select r.player_id, r.match_id, r.rating_before, r.rating_after, r.delta,
      r.played_at, r.stake_factor, r.bounty_delta,
      row_number() over (
        partition by r.player_id
        order by r.played_at desc, r.id desc
      ) as rn
    from public.rating_history r
  ) h
  where h.rn <= least(greatest(coalesce(p_limit, 20), 1), 50)
  order by h.player_id, h.played_at, h.match_id
$$;
