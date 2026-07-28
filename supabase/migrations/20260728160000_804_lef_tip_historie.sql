-- #804 Lef-tip, deel 2: de gebruikte multiplier meegeven aan de client, zodat
-- de feed een verdubbelde mutatie kan uitleggen ("▲ 24 rating · lef ×2") in
-- plaats van een onverklaarbaar groot getal te tonen naast een ploegmaat die
-- de helft kreeg. Spiegel van supabase/schemas/functions/29_rating_history.sql.
--
-- recent_rating_history krijgt er een kolom bij. Het returntype wijzigt
-- daarmee, en dat kan create or replace niet: eerst droppen.
drop function if exists public.recent_rating_history(int);

create or replace function public.recent_rating_history(p_limit int default 20)
returns table (
  player_id uuid,
  match_id uuid,
  rating_before int,
  rating_after int,
  delta int,
  played_at timestamptz,
  stake_factor numeric
)
language sql
stable
set search_path = ''
as $$
  select h.player_id, h.match_id, h.rating_before, h.rating_after, h.delta,
    h.played_at, h.stake_factor
  from (
    select r.player_id, r.match_id, r.rating_before, r.rating_after, r.delta,
      r.played_at, r.stake_factor,
      row_number() over (
        partition by r.player_id
        order by r.played_at desc, r.id desc
      ) as rn
    from public.rating_history r
  ) h
  where h.rn <= least(greatest(coalesce(p_limit, 20), 1), 50)
  order by h.player_id, h.played_at, h.match_id
$$;
