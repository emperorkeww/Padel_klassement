-- #645: Zwarte Piet-editie op de FUT-kaart — lees-RPC voor de globale Piet.
-- Spiegel van supabase/schemas/functions/26_global_zwarte_piet.sql; zie dat
-- bestand voor de volledige motivatie (RLS toont per kijker alleen eigen
-- groepen, de kaart is overal globaal, dus de server beslist).
create or replace function public.get_global_zwarte_piet()
returns table (
  player_id uuid,
  reden     text,
  ernst     int,
  detail    text,
  since     date,
  beschermd boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select z.holder_id as player_id, z.reden, z.ernst, z.detail, z.since,
    coalesce(pr.roast_schild, false) as beschermd
  from public.zwarte_piet z
  left join public.profiles pr on pr.id = z.holder_id
  order by z.ernst desc, z.since, z.holder_id, z.group_id
  limit 1
$$;

grant execute on function public.get_global_zwarte_piet() to authenticated;
