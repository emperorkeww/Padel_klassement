-- Globale pias (#631): de pias van de week over álle groepen heen — de
-- per-groep-rij uit pias_of_week met de hoogste winkans, met dezelfde
-- tie-break als recompute_pias (win_chance desc, match_id asc). Omdat
-- recompute_pias al over alle afgeronde groepsmatches gaat, is dit maximum
-- exact "de grootste choke van de club"; er is dus geen tweede berekening
-- naast pias_of_week nodig, en de globale pias is per definitie ook de pias
-- van z'n eigen groep.
--
-- SECURITY DEFINER omdat pias_of_week onder RLS alleen eigen groepen toont,
-- terwijl de FUT-kaart overal globaal is (#621/#624): iedereen moet dezélfde
-- pias zien. Het resultaat lekt bewust geen group_id/match_id uit vreemde
-- groepen — alleen wie, welke week en hoe pijnlijk. `beschermd`
-- (profiles.roast_schild, #183) reist mee zodat de client de kaart kan laten
-- zwijgen zónder dat er een vervangende pias doorschuift.
--
-- `weken_terug` begrenst het venster: default de lopende plus de vorige
-- ISO-week — dezelfde regel als de PiasBanner, zodat niemand een clownspak
-- van weken geleden draagt.
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
