-- Pias van de week: berekent per groep, per ISO-week de "pias" — sinds #643
-- de anti-MVP volgens exact dezelfde regels als bepaalPias/ergsteRedenVoor
-- (src/features/groups/maandpias.ts), zodat het dashboard-alarm, de banner,
-- de feed en de FUT-kaart dezelfde persoon aanwijzen:
--   bagel        verloor een partij met 0 eigen games          ernst 100 + 10n
--   afdroging    verloor met ≥ 4 games verschil                ernst 50 + marge
--   zwarte-reeks ≥ 3 verliezen op rij binnen de week           ernst 40 + n
--   choke        verloor als favoriet met winkans ≥ 0.6        ernst 30 + round(kans*10)
-- Per speler telt zijn ergste reden (tie: bagel > afdroging > reeks > choke,
-- de insertievolgorde van ergsteRedenVoor); per (groep, week) wint de hoogste
-- ernst, bij gelijke ernst het laagste player_id — beide identiek aan
-- bepaalPias. De client-spiegel pickPias (src/features/standings/pias.ts)
-- composeert daarom letterlijk óver bepaalPias.
--
-- Diff-gebaseerd (#203): bij elke wijziging aan matches wordt de stand opnieuw
-- berekend, maar alleen échte verschillen raken de tabel — nieuwe weken worden
-- geïnsert, gewijzigde weken geüpdatet en vervallen weken verwijderd. Rijen
-- die niet veranderen ondergaan géén DML, zodat triggers op pias_of_week
-- (push-webhook, realtime) enkel bij een echte pias-wissel vuren en
-- created_at het moment van de eerste aanwijzing blijft.
--
-- De choke-winkans komt uit de PRE-match ratings (rating_history.rating_before),
-- gemiddeld per team op de 400-schaal, identiek aan expected() in
-- src/features/rating/elo.ts. Let op: anders dan de oude choke-only variant is
-- er GEEN 1000-terugval — ontbreekt een rating, dan telt de match niet als
-- choke-kandidaat (spiegel van favorietKans, die dan null geeft).
create or replace function public.recompute_pias()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  with deelnames as (
    -- Elke (afgeronde groepsmatch, deelnemer): uitkomst + eigen/tegen-score.
    -- Draws (winner null) tellen mee: ze breken een zwarte reeks, net als
    -- ergsteRedenVoor (alles behalve 'L' reset de teller).
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
    -- Pre-match teamrating per (match, team): gemiddelde van de aanwezige
    -- rating_history-rijen, maar alléén als élk teamlid er een heeft (geen
    -- 1000-terugval — spiegel van favorietKans). Singles: de ene speler zelf.
    select d.match_id, d.team_id,
      case when count(rh.rating_before) = count(*)
           then avg(rh.rating_before) end as rating
    from (select distinct match_id, team_id, player_id from deelnames) d
    left join public.rating_history rh
      on rh.match_id = d.match_id and rh.player_id = d.player_id
    group by d.match_id, d.team_id
  ),
  kansen as (
    -- Winkans van het eigen (verliezende) team vóór de match. Alleen relevant
    -- voor verliezers; de favoriet-ondergrens (≥ 0.5) zit in favorietKans, de
    -- choke-drempel (≥ 0.6) in de kandidatenstap.
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
    -- Langste aaneengesloten verliesreeks per (speler, groep, week):
    -- gaps-and-islands op de chronologische uitkomsten binnen de week.
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
    -- Grondstoffen per (speler, groep, week), spiegel van ergsteRedenVoor.
    -- Het anker is de laatste verloren match (voor de feed-datering).
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
    -- Alle geldige redenen per speler, met dezelfde ernst-formules en
    -- dezelfde volgorde-prioriteit bij gelijke ernst als ergsteRedenVoor.
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
    -- Per (groep, week) de gênantste speler; tie-break laagste player_id,
    -- identiek aan bepaalPias.
    select distinct on (group_id, iso_year, iso_week)
      group_id, iso_year, iso_week, player_id, match_id,
      reden, ernst::smallint as ernst, waarde,
      case when reden = 'choke' then waarde end as win_chance,
      week_start
    from beste_per_speler
    order by group_id, iso_year, iso_week, ernst desc, player_id
  ),
  upsert as (
    -- Alleen nieuwe of écht gewijzigde weken raken de tabel; de WHERE op de
    -- DO UPDATE slaat identieke rijen volledig over (geen DML, geen triggers).
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
  -- Vervallen weken opruimen (bv. na correctie of verwijdering van de
  -- ankermatch). De delete ziet de snapshot van vóór dit statement, dus de
  -- zojuist geüpsertte rijen zijn hier onzichtbaar en blijven staan. De
  -- WHERE-clausule houdt bovendien safeupdate tevreden (de authenticator-rol
  -- laadt die, ook binnen deze SECURITY DEFINER-functie — zie 09_ratings).
  delete from public.pias_of_week p
  where not exists (
    select 1 from computed c
    where (c.group_id, c.iso_year, c.iso_week)
        = (p.group_id, p.iso_year, p.iso_week)
  );
end;
$$;

-- #1049: `from public` alléén was niet genoeg. Supabase geeft anon en
-- authenticated een eigen EXECUTE-grant op nieuwe functies in `public`, en een
-- revoke van PUBLIC laat die staan. Deze functie was daardoor met een gewone
-- rpc()-aanroep te starten door élke bezoeker, ook uitgelogd — een security
-- definer-functie die het hele klassement herschrijft. Zelfde formulering als
-- expire_point_appeals() al had.
revoke execute on function public.recompute_pias()
  from public, anon, authenticated;

-- #1049: expliciete grant voor de service-role, zodat het beheerpaneel de keten
-- opnieuw kan laten lopen na een handmatige correctie. Tot nu toe was de enige
-- route een dummy-update op `matches` — en die vuurt óók de push-webhooks af.
-- Zelfde patroon als expire_point_appeals() al had.
grant execute on function public.recompute_pias() to service_role;

-- Trigger-wrapper: herberekent na elke wijziging aan matches. Draait ná de
-- matches_ratings_*-triggers (alfabetische triggervolgorde: "ratings" <
-- "refresh"), zodat rating_history al vernieuwd is als we de choke bepalen.
create or replace function public.trigger_recompute_pias()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.recompute_pias();
  return null;
end;
$$;

create trigger matches_refresh_pias
  after insert or update or delete on public.matches
  for each statement
  execute function public.trigger_recompute_pias();
