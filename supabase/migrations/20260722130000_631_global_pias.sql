-- #631: Pias-editie op de FUT-kaart — lees-RPC voor de globale pias.
-- Spiegel van supabase/schemas/functions/25_global_pias.sql; zie dat bestand
-- voor de volledige motivatie (RLS toont per kijker alleen eigen groepen,
-- de kaart is overal globaal, dus de server beslist).
create or replace function public.get_global_pias(weken_terug int default 1)
returns table (
  iso_year   smallint,
  iso_week   smallint,
  week_start date,
  player_id  uuid,
  win_chance numeric,
  beschermd  boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct on (p.iso_year, p.iso_week)
    p.iso_year, p.iso_week, p.week_start, p.player_id, p.win_chance,
    coalesce(pr.roast_schild, false) as beschermd
  from public.pias_of_week p
  left join public.profiles pr on pr.id = p.player_id
  where p.week_start >=
    (date_trunc('week', now()) - make_interval(weeks => weken_terug))::date
  order by p.iso_year, p.iso_week, p.win_chance desc, p.match_id
$$;

grant execute on function public.get_global_pias(int) to authenticated;
