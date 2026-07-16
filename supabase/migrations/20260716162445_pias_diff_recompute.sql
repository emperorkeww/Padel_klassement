set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.recompute_pias()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
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
    -- Pre-match ratings van de spelers uit rating_history (basis 1000 als er
    -- nog geen historie is, bv. verwijderde speler). Bij singles is player2
    -- null en blijft rl2/rw2 null, zodat er geen fantoom-1000 meegemiddeld wordt.
    select
      c.*,
      lt.player1_id as l1, lt.player2_id as l2,
      coalesce(rl1.rating_before, 1000) as rl1,
      case when lt.player2_id is not null then coalesce(rl2.rating_before, 1000) end as rl2,
      coalesce(rw1.rating_before, 1000) as rw1,
      case when wt.player2_id is not null then coalesce(rw2.rating_before, 1000) end as rw2
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
      -- coalesce(x2, x1) laat een singles-team op de rating van de ene speler
      -- uitkomen in plaats van op een gemiddelde met een fantoom-partner.
      least(
        0.9999,
        round(
          1.0 / (1.0 + power(10.0,
            ((r.rw1 + coalesce(r.rw2, r.rw1)) / 2.0
             - (r.rl1 + coalesce(r.rl2, r.rl1)) / 2.0) / 400.0)),
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
  ),
  computed as (
    select
      b.group_id, b.iso_year, b.iso_week,
      -- De pias: de verliezer met de hoogste pre-match rating (de grootste naam
      -- die flopte); bij gelijke rating de eerste speler van het team. Bij
      -- singles (l2 null) is er maar één kandidaat.
      case when b.l2 is null then b.l1
           when b.rl1 >= b.rl2 then b.l1
           else b.l2 end as player_id,
      b.match_id, b.loser_chance as win_chance, b.week_start
    from best b
  ),
  upsert as (
    -- Alleen nieuwe of écht gewijzigde weken raken de tabel; de WHERE op de
    -- DO UPDATE slaat identieke rijen volledig over (geen DML, geen triggers).
    insert into public.pias_of_week
      (group_id, iso_year, iso_week, player_id, match_id, win_chance, week_start)
    select group_id, iso_year, iso_week, player_id, match_id, win_chance, week_start
    from computed
    on conflict (group_id, iso_year, iso_week) do update
      set player_id  = excluded.player_id,
          match_id   = excluded.match_id,
          win_chance = excluded.win_chance,
          week_start = excluded.week_start
      where (pias_of_week.player_id, pias_of_week.match_id,
             pias_of_week.win_chance, pias_of_week.week_start)
            is distinct from
            (excluded.player_id, excluded.match_id,
             excluded.win_chance, excluded.week_start)
  )
  -- Vervallen weken opruimen (bv. na correctie of verwijdering van de
  -- choke-match). De delete ziet de snapshot van vóór dit statement, dus de
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
$function$
;
