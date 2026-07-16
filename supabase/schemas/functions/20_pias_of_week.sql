-- Pias van de week: berekent per groep, per ISO-week de "pias" — de grootste
-- choke, d.w.z. de speler die als duidelijkste favoriet toch verloor.
--
-- Zelfde filosofie als recompute_ratings (functions/09_ratings.sql): bij elke
-- wijziging aan matches wordt de hele tabel opnieuw opgebouwd uit de afgeronde
-- groepsmatches. Voor de schaal van een vriendengroep ruim voldoende, en het
-- blijft altijd correct — ook na score-correcties.
--
-- De winkans wordt bepaald uit de PRE-match ratings (rating_history.rating_before),
-- gemiddeld per team op de 400-schaal, identiek aan expected() in src/lib/elo.ts,
-- recompute_ratings en prediction_win_chance. Een choke = het verliezende team
-- was favoriet met winkans > 0.65 (= 1 - UPSET_MAX_KANS uit src/lib/feed.ts).
create or replace function public.recompute_pias()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- WHERE true: de authenticator-rol laadt safeupdate, die ongekwalificeerde
  -- DELETE blokkeert — ook binnen deze SECURITY DEFINER-functie (zie 09_ratings).
  delete from public.pias_of_week where true;

  insert into public.pias_of_week
    (group_id, iso_year, iso_week, player_id, match_id, win_chance, week_start)
  with chokes as (
    -- Alle afgeronde groepsmatches met een winnaar, met hun ISO-week.
    select
      m.id                                                                as match_id,
      m.group_id,
      extract(isoyear from coalesce(m.played_at, m.created_at))::smallint as iso_year,
      extract(week    from coalesce(m.played_at, m.created_at))::smallint as iso_week,
      date_trunc('week', coalesce(m.played_at, m.created_at))::date       as week_start,
      m.winner_team_id                                                    as winner_team_id,
      case when m.winner_team_id = m.team_a_id then m.team_b_id else m.team_a_id end
                                                                          as loser_team_id
    from public.matches m
    where m.status = 'completed'
      and m.group_id is not null
      and m.winner_team_id is not null
  ),
  rated as (
    -- Pre-match ratings van de vier spelers uit rating_history (basis 1000
    -- als er nog geen historie is, bv. verwijderde speler).
    select
      c.*,
      lt.player1_id as l1, lt.player2_id as l2,
      coalesce(rl1.rating_before, 1000) as rl1,
      coalesce(rl2.rating_before, 1000) as rl2,
      coalesce(rw1.rating_before, 1000) as rw1,
      coalesce(rw2.rating_before, 1000) as rw2
    from chokes c
    join public.teams lt on lt.id = c.loser_team_id
    join public.teams wt on wt.id = c.winner_team_id
    left join public.rating_history rl1
      on rl1.match_id = c.match_id and rl1.player_id = lt.player1_id
    left join public.rating_history rl2
      on rl2.match_id = c.match_id and rl2.player_id = lt.player2_id
    left join public.rating_history rw1
      on rw1.match_id = c.match_id and rw1.player_id = wt.player1_id
    left join public.rating_history rw2
      on rw2.match_id = c.match_id and rw2.player_id = wt.player2_id
  ),
  scored as (
    select
      r.*,
      -- Winkans van het verliezende team vóór de match. Geklemd op < 1 zodat
      -- de check-constraint nooit sneuvelt bij extreme rating-verschillen.
      least(
        0.9999,
        round(
          1.0 / (1.0 + power(10.0,
            ((r.rw1 + r.rw2) / 2.0 - (r.rl1 + r.rl2) / 2.0) / 400.0)),
          4)
      ) as loser_chance
    from rated r
  ),
  best as (
    -- Per (groep, ISO-week) de pijnlijkste choke: hoogste verlieskans.
    select distinct on (group_id, iso_year, iso_week)
      group_id, iso_year, iso_week, week_start, match_id, loser_chance,
      l1, l2, rl1, rl2
    from scored
    where loser_chance > 0.65
    order by group_id, iso_year, iso_week, loser_chance desc, match_id
  )
  select
    b.group_id, b.iso_year, b.iso_week,
    -- De pias: de verliezer met de hoogste pre-match rating (de grootste naam
    -- die flopte); bij gelijke rating de eerste speler van het team.
    case when b.rl1 >= b.rl2 then b.l1 else b.l2 end as player_id,
    b.match_id, b.loser_chance, b.week_start
  from best b;
end;
$$;

revoke execute on function public.recompute_pias() from public;

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
