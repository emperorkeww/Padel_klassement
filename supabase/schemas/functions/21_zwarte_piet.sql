-- De Zwarte Piet: bepaalt per groep de huidige drager van het schande-token.
--
-- Volgorde-afhankelijk (recency + verlossing-bij-winst), dus we replayen de
-- volledige matchhistorie chronologisch — zelfde filosofie als recompute_ratings.
-- Altijd correct, óók na score-correcties. Pure spiegel in src/lib/zwartePiet.ts.
--
-- Pre-pass (CTE's): per afgeronde groepsmatch de ergste flopper + de winnaars.
-- Kwalificerende afgangen en hun ernst zijn dezelfde als de pias van de maand
-- (src/lib/maandpias.ts): bagel (110), afdroging (50+marge, ≥4), zwarte-reeks
-- (40+reeks, ≥3), choke (30+round(kans*10), favoriet ≥0.6). De choke gebruikt de
-- pre-match ratings uit rating_history, net als recompute_pias.
-- Daarna een sequentiële loop die per groep de drager laat rondgaan.
create or replace function public.recompute_zwarte_piet()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_group  uuid := null;
  v_holder uuid := null;
  v_from   uuid := null;
  v_reden  text := null;
  v_ernst  int  := null;
  v_detail text := null;
  v_match  uuid := null;
  v_since  date := null;
begin
  -- WHERE true: safeupdate blokkeert een ongekwalificeerde DELETE (zie 09_ratings).
  delete from public.zwarte_piet where true;

  for r in
    with completed as (
      select m.id as match_id, m.group_id,
             coalesce(m.played_at, m.created_at) as ts,
             m.winner_team_id, m.team_a_id, m.team_b_id, m.score_a, m.score_b
      from public.matches m
      where m.status = 'completed' and m.group_id is not null
    ),
    -- Elke deelnemer per match met uitkomst W/L/D (D voor gelijkspel).
    participants as (
      select c.match_id, c.group_id, c.ts, c.winner_team_id,
             c.team_a_id, c.team_b_id, c.score_a, c.score_b,
             pt.player_id, pt.team_id,
             case when c.winner_team_id is null then 'D'
                  when c.winner_team_id = pt.team_id then 'W'
                  else 'L' end as outcome
      from completed c
      join (
        select id as team_id, player1_id as player_id from public.teams
        union all
        -- singles-teams hebben geen tweede speler
        select id as team_id, player2_id as player_id from public.teams
        where player2_id is not null
      ) pt on pt.team_id in (c.team_a_id, c.team_b_id)
    ),
    -- Lopende verliesreeks per (groep, speler): rij-index minus de laatste
    -- niet-verlies-index (gaps-and-islands). Gelijkspel/winst zetten 'm op 0.
    base as (
      select p.*,
             row_number() over w as rn,
             case when p.outcome <> 'L' then row_number() over w end as nlrn
      from participants p
      window w as (partition by p.group_id, p.player_id order by p.ts, p.match_id)
    ),
    streaked as (
      select b.*,
             b.rn - coalesce(
               max(b.nlrn) over (
                 partition by b.group_id, b.player_id
                 order by b.ts, b.match_id
                 rows between unbounded preceding and current row),
               0) as loss_streak
      from base b
    ),
    -- Winkans van het verliezende team vóór de match (favoriet als ≥0.5), voor
    -- de choke — identiek aan recompute_pias.
    match_choke as (
      -- Bij singles telt alleen de rating van de ene speler mee (geen
      -- fantoom-1000-partner in het gemiddelde).
      select c.match_id,
             least(0.9999, round(
               1.0 / (1.0 + power(10.0,
                 ((coalesce(rw1.rating_before, 1000)
                   + case when wt.player2_id is null then coalesce(rw1.rating_before, 1000)
                          else coalesce(rw2.rating_before, 1000) end) / 2.0
                  - (coalesce(rl1.rating_before, 1000)
                     + case when lt.player2_id is null then coalesce(rl1.rating_before, 1000)
                            else coalesce(rl2.rating_before, 1000) end) / 2.0)
                 / 400.0)), 4)) as loser_chance
      from completed c
      join public.teams lt
        on lt.id = case when c.winner_team_id = c.team_a_id then c.team_b_id else c.team_a_id end
      join public.teams wt on wt.id = c.winner_team_id
      left join public.rating_history rl1 on rl1.match_id = c.match_id and rl1.player_id = lt.player1_id
      left join public.rating_history rl2 on rl2.match_id = c.match_id and rl2.player_id = lt.player2_id
      left join public.rating_history rw1 on rw1.match_id = c.match_id and rw1.player_id = wt.player1_id
      left join public.rating_history rw2 on rw2.match_id = c.match_id and rw2.player_id = wt.player2_id
      where c.winner_team_id is not null
    ),
    -- Verliezers met eigen/tegenscore, verliesreeks en team-choke-kans.
    losers as (
      select s.match_id, s.group_id, s.player_id, s.loss_streak,
             case when s.team_id = s.team_a_id then s.score_a else s.score_b end as mij,
             case when s.team_id = s.team_a_id then s.score_b else s.score_a end as hen,
             mc.loser_chance
      from streaked s
      left join match_choke mc on mc.match_id = s.match_id
      where s.outcome = 'L'
    ),
    -- De ergste afgang per verliezende speler (hoogste ernst wint).
    afgang as (
      select l.match_id, l.player_id, k.reden, k.ernst, k.detail
      from losers l
      cross join lateral (
        select c.reden, c.ernst, c.detail
        from (values
          ('bagel'::text,
           case when l.mij = 0 and l.hen > 0 then 110 end,
           'slikte een bagel 🥯'::text),
          ('afdroging',
           case when (l.hen - l.mij) >= 4 then 50 + (l.hen - l.mij) end,
           'ging met ' || (l.hen - l.mij) || ' games verschil de boot in'),
          ('zwarte-reeks',
           case when l.loss_streak >= 3 then 40 + l.loss_streak end,
           'verloor ' || l.loss_streak || '× op rij'),
          ('choke',
           case when l.loser_chance >= 0.6 then 30 + round(l.loser_chance * 10)::int end,
           'was torenhoge favoriet en ging tóch onderuit (' || round(l.loser_chance * 100)::int || '% kans)')
        ) as c(reden, ernst, detail)
        where c.ernst is not null
        order by c.ernst desc
        limit 1
      ) k
    ),
    -- Per match de ergste flopper (hoogste ernst, tie-break laagste id).
    worst as (
      select distinct on (match_id)
             match_id, player_id, reden, ernst, detail
      from afgang
      order by match_id, ernst desc, player_id
    ),
    -- Overzicht per beslissende match: winnaars + eventuele ergste flopper.
    summary as (
      select c.group_id, c.match_id, c.ts,
             wt.player1_id as win_p1, wt.player2_id as win_p2,
             w.player_id as worst_player, w.reden as worst_reden,
             w.ernst as worst_ernst, w.detail as worst_detail
      from completed c
      join public.teams wt on wt.id = c.winner_team_id
      left join worst w on w.match_id = c.match_id
      where c.winner_team_id is not null
    )
    select * from summary order by group_id, ts, match_id
  loop
    -- Groepswissel: vorige drager wegschrijven, staat resetten.
    if v_group is distinct from r.group_id then
      if v_holder is not null then
        insert into public.zwarte_piet
          (group_id, holder_id, from_id, reden, ernst, detail, match_id, since)
        values (v_group, v_holder, v_from, v_reden, v_ernst, v_detail, v_match, v_since);
      end if;
      v_group := r.group_id;
      v_holder := null; v_from := null; v_reden := null;
      v_ernst := null; v_detail := null; v_match := null; v_since := null;
    end if;

    if r.worst_player is not null then
      -- Recency: een nieuwe flopper pakt de Piet af. Dezelfde drager die
      -- opnieuw flopt houdt 'm (since blijft lopen).
      if v_holder is null or v_holder <> r.worst_player then
        v_from := v_holder;
        v_holder := r.worst_player;
        v_reden := r.worst_reden;
        v_ernst := r.worst_ernst;
        v_detail := r.worst_detail;
        v_match := r.match_id;
        v_since := r.ts::date;
      end if;
    elsif v_holder is not null
      and (v_holder = r.win_p1 or v_holder is not distinct from r.win_p2) then
      -- Geen flop en de drager won: verlost → Piet vrij. Expliciet null-safe:
      -- "in (..., null)" zou bij een singles-winnaar naar null evalueren.
      v_holder := null;
    end if;
  end loop;

  -- Laatste groep wegschrijven.
  if v_holder is not null then
    insert into public.zwarte_piet
      (group_id, holder_id, from_id, reden, ernst, detail, match_id, since)
    values (v_group, v_holder, v_from, v_reden, v_ernst, v_detail, v_match, v_since);
  end if;
end;
$$;

-- #1049: `from public` alléén was niet genoeg. Supabase geeft anon en
-- authenticated een eigen EXECUTE-grant op nieuwe functies in `public`, en een
-- revoke van PUBLIC laat die staan. Deze functie was daardoor met een gewone
-- rpc()-aanroep te starten door élke bezoeker, ook uitgelogd — een security
-- definer-functie die het hele klassement herschrijft. Zelfde formulering als
-- expire_point_appeals() al had.
revoke execute on function public.recompute_zwarte_piet()
  from public, anon, authenticated;

-- #1049: expliciete grant voor de service-role, zodat het beheerpaneel de keten
-- opnieuw kan laten lopen na een handmatige correctie. Tot nu toe was de enige
-- route een dummy-update op `matches` — en die vuurt óók de push-webhooks af.
-- Zelfde patroon als expire_point_appeals() al had.
grant execute on function public.recompute_zwarte_piet() to service_role;

-- Trigger-wrapper: herberekent na elke wijziging aan matches. Naam sorteert ná
-- de matches_ratings_*-triggers ("r" < "z"), zodat rating_history al vernieuwd is
-- als we de choke bepalen.
create or replace function public.trigger_recompute_zwarte_piet()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.recompute_zwarte_piet();
  return null;
end;
$$;

revoke execute on function public.trigger_recompute_zwarte_piet() from public;

create trigger matches_zwarte_piet
  after insert or update or delete on public.matches
  for each statement
  execute function public.trigger_recompute_zwarte_piet();
