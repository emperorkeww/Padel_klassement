-- Globale Zwarte Piet (#645): de drager over álle groepen heen — de rij uit
-- zwarte_piet met de hoogste ernst, tie-breaks: oudste since (draagt 'm het
-- langst), laagste holder_id, dan group_id voor determinisme. Omdat de invoer
-- de per-groep-dragers zijn, is de globale Piet per definitie ook de Piet van
-- z'n eigen groep; kaart en groepsweergave spreken elkaar nooit tegen.
-- Anders dan get_global_pias is er geen weekvenster: het token is tijdloos en
-- bestaat tot verlossing (winst van de drager).
--
-- SECURITY DEFINER om dezelfde reden als get_global_pias (25_global_pias.sql):
-- zwarte_piet toont onder RLS alleen eigen groepen, terwijl de FUT-kaart
-- overal globaal is (#621/#624) — iedereen moet dezélfde Piet zien. Het
-- resultaat lekt bewust geen group_id/match_id uit vreemde groepen — alleen
-- wie, waarom (reden/detail, zonder naam), hoe erg en sinds wanneer.
-- `beschermd` (profiles.roast_schild, #183) reist mee zodat de client de
-- kaart kan laten zwijgen zónder dat er een vervangende Piet doorschuift.
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
