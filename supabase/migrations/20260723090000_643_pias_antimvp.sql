-- #643: pias van de week verbreed van choke-only naar de anti-MVP-regels van
-- bepaalPias (bagel / afdroging / zwarte reeks / choke ≥ 0.6), zodat het
-- dashboard-alarm, de banner, de feed én de FUT-kaart (#631) dezelfde persoon
-- aanwijzen. Spiegel van supabase/schemas/tables/15_pias_of_week.sql en
-- schemas/functions/20_pias_of_week.sql + 25_global_pias.sql; zie die
-- bestanden voor de volledige regels en motivatie.

-- 1) Tabel: reden/ernst/waarde erbij, win_chance alleen nog voor chokes.
alter table public.pias_of_week
  add column reden  text,
  add column ernst  smallint,
  add column waarde numeric;

alter table public.pias_of_week alter column win_chance drop not null;
alter table public.pias_of_week drop constraint if exists pias_of_week_win_chance_check;
alter table public.pias_of_week
  add constraint pias_of_week_win_chance_check
  check (win_chance is null or (win_chance > 0 and win_chance < 1));

-- 2) recompute_pias: anti-MVP-spiegel van bepaalPias/ergsteRedenVoor.
create or replace function public.recompute_pias()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  with deelnames as (
    select
      m.id                                                                as match_id,
      m.group_id,
      extract(isoyear from coalesce(m.played_at, m.created_at))::smallint as iso_year,
      extract(week    from coalesce(m.played_at, m.created_at))::smallint as iso_week,
      date_trunc('week', coalesce(m.played_at, m.created_at))::date       as week_start,
      coalesce(m.played_at, m.created_at)                                 as gespeeld,
      lid.team_id,
      lid.player_id,
      case
        when m.winner_team_id is null       then 'D'
        when m.winner_team_id = lid.team_id then 'W'
        else 'L'
      end                                                                 as uitkomst,
      case when lid.team_id = m.team_a_id then m.score_a else m.score_b end as mij,
      case when lid.team_id = m.team_a_id then m.score_b else m.score_a end as hen
    from public.matches m
    cross join lateral (
      select t.id as team_id, u.player_id
      from public.teams t
      cross join lateral unnest(
        array_remove(array[t.player1_id, t.player2_id], null)
      ) as u(player_id)
      where t.id in (m.team_a_id, m.team_b_id)
    ) lid
    where m.status = 'completed' and m.group_id is not null
  ),
  teamrating as (
    select d.match_id, d.team_id,
      case when count(rh.rating_before) = count(*)
           then avg(rh.rating_before) end as rating
    from (select distinct match_id, team_id, player_id from deelnames) d
    left join public.rating_history rh
      on rh.match_id = d.match_id and rh.player_id = d.player_id
    group by d.match_id, d.team_id
  ),
  kansen as (
    select d.match_id, d.player_id,
      1.0 / (1.0 + power(10.0, (thun.rating - teigen.rating) / 400.0)) as kans
    from deelnames d
    join public.matches m on m.id = d.match_id
    join teamrating teigen
      on teigen.match_id = d.match_id and teigen.team_id = d.team_id
    join teamrating thun
      on thun.match_id = d.match_id
     and thun.team_id = case when d.team_id = m.team_a_id
                             then m.team_b_id else m.team_a_id end
    where d.uitkomst = 'L'
      and teigen.rating is not null and thun.rating is not null
  ),
  reeksen as (
    select player_id, group_id, iso_year, iso_week, max(lengte) as reeks
    from (
      select player_id, group_id, iso_year, iso_week, eiland, count(*) as lengte
      from (
        select d.*,
          count(*) filter (where d.uitkomst <> 'L') over (
            partition by d.player_id, d.group_id, d.iso_year, d.iso_week
            order by d.gespeeld, d.match_id
          ) as eiland
        from deelnames d
      ) genummerd
      where uitkomst = 'L'
      group by player_id, group_id, iso_year, iso_week, eiland
    ) eilanden
    group by player_id, group_id, iso_year, iso_week
  ),
  per_speler as (
    select
      d.player_id, d.group_id, d.iso_year, d.iso_week,
      min(d.week_start) as week_start,
      count(*) filter (where d.uitkomst = 'L' and d.mij = 0 and d.hen > 0) as bagels,
      max(d.hen - d.mij) filter (where d.uitkomst = 'L') as marge,
      max(k.kans) filter (where d.uitkomst = 'L' and k.kans >= 0.5) as kans,
      (array_agg(d.match_id order by d.gespeeld desc, d.match_id desc)
         filter (where d.uitkomst = 'L'))[1] as match_id
    from deelnames d
    left join kansen k on k.match_id = d.match_id and k.player_id = d.player_id
    group by d.player_id, d.group_id, d.iso_year, d.iso_week
  ),
  kandidaten as (
    select ps.*, x.reden, x.ernst, x.waarde, x.prio
    from per_speler ps
    left join reeksen r using (player_id, group_id, iso_year, iso_week)
    cross join lateral (
      values
        ('bagel',        100 + ps.bagels * 10,
         ps.bagels::numeric,               1, ps.bagels > 0),
        ('afdroging',    50 + coalesce(ps.marge, 0),
         ps.marge::numeric,                2, coalesce(ps.marge, 0) >= 4),
        ('zwarte-reeks', 40 + coalesce(r.reeks, 0),
         r.reeks::numeric,                 3, coalesce(r.reeks, 0) >= 3),
        ('choke',        30 + round(coalesce(ps.kans, 0) * 10)::int,
         round(ps.kans::numeric, 4),       4, coalesce(ps.kans, 0) >= 0.6)
    ) as x(reden, ernst, waarde, prio, geldig)
    where x.geldig
  ),
  beste_per_speler as (
    select distinct on (player_id, group_id, iso_year, iso_week) *
    from kandidaten
    order by player_id, group_id, iso_year, iso_week, ernst desc, prio
  ),
  computed as (
    select distinct on (group_id, iso_year, iso_week)
      group_id, iso_year, iso_week, player_id, match_id,
      reden, ernst::smallint as ernst, waarde,
      case when reden = 'choke' then waarde end as win_chance,
      week_start
    from beste_per_speler
    order by group_id, iso_year, iso_week, ernst desc, player_id
  ),
  upsert as (
    insert into public.pias_of_week
      (group_id, iso_year, iso_week, player_id, match_id,
       reden, ernst, waarde, win_chance, week_start)
    select group_id, iso_year, iso_week, player_id, match_id,
           reden, ernst, waarde, win_chance, week_start
    from computed
    on conflict (group_id, iso_year, iso_week) do update
      set player_id  = excluded.player_id,
          match_id   = excluded.match_id,
          reden      = excluded.reden,
          ernst      = excluded.ernst,
          waarde     = excluded.waarde,
          win_chance = excluded.win_chance,
          week_start = excluded.week_start
      where (pias_of_week.player_id, pias_of_week.match_id, pias_of_week.reden,
             pias_of_week.ernst, pias_of_week.waarde, pias_of_week.win_chance,
             pias_of_week.week_start)
            is distinct from
            (excluded.player_id, excluded.match_id, excluded.reden,
             excluded.ernst, excluded.waarde, excluded.win_chance,
             excluded.week_start)
  )
  delete from public.pias_of_week p
  where not exists (
    select 1 from computed c
    where (c.group_id, c.iso_year, c.iso_week)
        = (p.group_id, p.iso_year, p.iso_week)
  );
end;
$$;

-- 3) Backfill met de nieuwe regels; oude choke-only rijen worden geüpdatet of
--    opgeruimd, waarna de nieuwe kolommen overal gevuld zijn.
select public.recompute_pias();

alter table public.pias_of_week
  alter column reden  set not null,
  alter column ernst  set not null,
  alter column waarde set not null;
alter table public.pias_of_week
  add constraint pias_of_week_reden_check
  check (reden in ('bagel', 'afdroging', 'zwarte-reeks', 'choke'));

-- 4) get_global_pias: kiest nu op ernst (tie: laagste player_id, dan groep) en
--    geeft reden/ernst/waarde mee. Return-type wijzigt → eerst droppen.
drop function if exists public.get_global_pias(int);
create or replace function public.get_global_pias(weken_terug int default 1)
returns table (
  iso_year   smallint,
  iso_week   smallint,
  week_start date,
  player_id  uuid,
  reden      text,
  ernst      smallint,
  waarde     numeric,
  win_chance numeric,
  beschermd  boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct on (p.iso_year, p.iso_week)
    p.iso_year, p.iso_week, p.week_start, p.player_id,
    p.reden, p.ernst, p.waarde, p.win_chance,
    coalesce(pr.roast_schild, false) as beschermd
  from public.pias_of_week p
  left join public.profiles pr on pr.id = p.player_id
  where p.week_start >=
    (date_trunc('week', now()) - make_interval(weeks => weken_terug))::date
  order by p.iso_year, p.iso_week, p.ernst desc, p.player_id, p.group_id
$$;

grant execute on function public.get_global_pias(int) to authenticated;
