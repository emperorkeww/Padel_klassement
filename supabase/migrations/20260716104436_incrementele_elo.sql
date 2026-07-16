drop trigger if exists "matches_recompute_ratings" on "public"."matches";

drop function if exists "public"."trigger_recompute_ratings"();

CREATE INDEX matches_completed_order_idx ON public.matches USING btree (COALESCE(played_at, created_at), created_at, id) WHERE (status = 'completed'::public.match_status);

CREATE INDEX rating_history_match_idx ON public.rating_history USING btree (match_id);

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public._apply_match_rating(p_match uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  k constant numeric := 24;      -- K-factor
  base constant int := 1000;
  m record;
  a1 uuid; a2 uuid; b1 uuid; b2 uuid;
  ra numeric; rb numeric;        -- teamratings (gemiddelde van twee spelers)
  ea numeric;                    -- verwachte score team A
  sa numeric;                    -- werkelijke score team A (1/0.5/0)
  da int; db int;                -- rating-delta per team
begin
  select mt.id, mt.team_a_id, mt.team_b_id, mt.winner_team_id,
         coalesce(mt.played_at, mt.created_at) as ts
    into m
    from public.matches mt
    where mt.id = p_match;

  if m.id is null then
    return;
  end if;

  select ta.player1_id, ta.player2_id, tb.player1_id, tb.player2_id
    into a1, a2, b1, b2
    from public.teams ta, public.teams tb
    where ta.id = m.team_a_id and tb.id = m.team_b_id;

  -- Ontbrekende teams (verwijderd?) overslaan.
  if a1 is null or b1 is null then
    return;
  end if;

  ra := (
    coalesce((select rating from public.player_ratings where player_id = a1), base)
    + coalesce((select rating from public.player_ratings where player_id = a2), base)
  ) / 2.0;
  rb := (
    coalesce((select rating from public.player_ratings where player_id = b1), base)
    + coalesce((select rating from public.player_ratings where player_id = b2), base)
  ) / 2.0;

  ea := 1.0 / (1.0 + power(10.0, (rb - ra) / 400.0));
  sa := case
          when m.winner_team_id = m.team_a_id then 1.0
          when m.winner_team_id = m.team_b_id then 0.0
          else 0.5
        end;

  da := round(k * (sa - ea));
  db := round(k * ((1.0 - sa) - (1.0 - ea)));

  perform public._apply_rating(a1, m.id, da, m.ts);
  perform public._apply_rating(a2, m.id, da, m.ts);
  perform public._apply_rating(b1, m.id, db, m.ts);
  perform public._apply_rating(b2, m.id, db, m.ts);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.matches_ratings_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_full boolean := false;
  v_append uuid[] := '{}';
  v_min_ts timestamptz;
  v_min_created timestamptz;
  v_min_id uuid;
  v_id uuid;
begin
  -- Serialiseer ratingberekeningen: twee gelijktijdige transacties zien
  -- elkaars matches niet, waardoor de einde-keten-check anders allebei het
  -- incrementele pad zou kiezen met een verkeerde volgorde als gevolg.
  perform pg_advisory_xact_lock(hashtext('elo_ratings'));

  if tg_op = 'INSERT' then
    select coalesce(array_agg(n.id), '{}') into v_append
      from new_rows n
      where n.status = 'completed';

  elsif tg_op = 'DELETE' then
    -- De cascade heeft de rating_history-rijen al verwijderd; incrementeel
    -- terugdraaien kan dus niet meer.
    select exists (select 1 from old_rows o where o.status = 'completed')
      into v_full;

  else -- UPDATE
    -- Alleen rijen waarvan de Elo-relevante toestand echt wijzigt tellen mee;
    -- de rest (bv. score-correctie met dezelfde winnaar) is een no-op.
    select
      coalesce(array_agg(n.id) filter (where o.status <> 'completed'), '{}'),
      coalesce(bool_or(o.status = 'completed'), false)
      into v_append, v_full
      from new_rows n
      join old_rows o using (id)
      where (o.status = 'completed' or n.status = 'completed')
        and (o.status, o.winner_team_id, o.team_a_id, o.team_b_id,
             coalesce(o.played_at, o.created_at), o.created_at)
            is distinct from
            (n.status, n.winner_team_id, n.team_a_id, n.team_b_id,
             coalesce(n.played_at, n.created_at), n.created_at);
  end if;

  if v_full then
    perform public.recompute_ratings();
    return null;
  end if;

  if coalesce(array_length(v_append, 1), 0) = 0 then
    return null;
  end if;

  -- Einde-van-de-keten-check: bestaat er buiten de nieuwe matches een
  -- afgeronde match die chronologisch later valt (zelfde totale orde als de
  -- ORDER BY in recompute_ratings), dan is incrementeel toepassen onjuist.
  select coalesce(m.played_at, m.created_at), m.created_at, m.id
    into v_min_ts, v_min_created, v_min_id
    from public.matches m
    where m.id = any (v_append)
    order by 1, 2, 3
    limit 1;

  if exists (
       select 1
       from public.matches x
       where x.status = 'completed'
         and not (x.id = any (v_append))
         and (coalesce(x.played_at, x.created_at), x.created_at, x.id)
             > (v_min_ts, v_min_created, v_min_id)
     )
     -- Dubbel-apply-guard: als er al history voor deze matches bestaat, zou
     -- incrementeel toepassen duplicaten geven — recompute ruimt op.
     or exists (
       select 1 from public.rating_history h where h.match_id = any (v_append)
     )
  then
    perform public.recompute_ratings();
    return null;
  end if;

  for v_id in
    select m.id
    from public.matches m
    where m.id = any (v_append)
    order by coalesce(m.played_at, m.created_at), m.created_at, m.id
  loop
    perform public._apply_match_rating(v_id);
  end loop;

  return null;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.match_smoesjes_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  m record;
  v_loser uuid;
  l record;
begin
  select id, group_id, status, winner_team_id, team_a_id, team_b_id
    into m
    from public.matches
    where id = new.match_id;

  if m.id is null then
    raise exception 'match bestaat niet';
  end if;
  if m.group_id is null or m.group_id is distinct from new.group_id then
    raise exception 'een smoes plaatsen kan alleen op groepsmatches';
  end if;
  if m.status <> 'completed' then
    raise exception 'deze match is nog niet afgerond';
  end if;
  if m.winner_team_id is null then
    raise exception 'bij een gelijkspel valt er niets goed te praten';
  end if;

  -- Het verliezende team en de vraag of de speler daarin zat.
  v_loser := case when m.winner_team_id = m.team_a_id then m.team_b_id else m.team_a_id end;
  select player1_id, player2_id into l from public.teams where id = v_loser;
  if new.player_id not in (l.player1_id, l.player2_id) then
    raise exception 'alleen wie de match verloor mag een smoes plaatsen';
  end if;

  new.updated_at := now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.recompute_ratings()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  m record;
begin
  -- WHERE true is vereist: de authenticator-rol laadt de safeupdate-library,
  -- die ongekwalificeerde DELETE (zonder WHERE) blokkeert — ook binnen deze
  -- SECURITY DEFINER-functie, want de library werkt sessiebreed.
  delete from public.rating_history where true;
  delete from public.player_ratings where true;

  for m in
    select mt.id
    from public.matches mt
    where mt.status = 'completed'
    order by coalesce(mt.played_at, mt.created_at), mt.created_at, mt.id
  loop
    perform public._apply_match_rating(m.id);
  end loop;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.recompute_zwarte_piet()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
        select id as team_id, player2_id as player_id from public.teams
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
      select c.match_id,
             least(0.9999, round(
               1.0 / (1.0 + power(10.0,
                 ((coalesce(rw1.rating_before, 1000) + coalesce(rw2.rating_before, 1000)) / 2.0
                  - (coalesce(rl1.rating_before, 1000) + coalesce(rl2.rating_before, 1000)) / 2.0)
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
    elsif v_holder is not null and v_holder in (r.win_p1, r.win_p2) then
      -- Geen flop en de drager won: verlost → Piet vrij.
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
$function$
;

CREATE TRIGGER matches_ratings_del AFTER DELETE ON public.matches REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT EXECUTE FUNCTION public.matches_ratings_trigger();

CREATE TRIGGER matches_ratings_ins AFTER INSERT ON public.matches REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION public.matches_ratings_trigger();

CREATE TRIGGER matches_ratings_upd AFTER UPDATE ON public.matches REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION public.matches_ratings_trigger();

-- db diff genereert geen grants: interne functies niet publiek aanroepbaar maken.
revoke execute on function public._apply_match_rating(uuid) from public;
revoke execute on function public.matches_ratings_trigger() from public;
