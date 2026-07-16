-- ELO-berekening. Hybride model: een nieuwe match die chronologisch ná alle
-- andere afgeronde matches valt (het normale pad: loggen of afronden met
-- played_at = now()) wordt incrementeel toegepast op alleen de vier betrokken
-- spelers. Elke andere Elo-relevante wijziging — correctie van een oudere
-- match, verwijdering, herordening via played_at — valt terug op een volledige
-- herberekening, want ELO is volgorde-afhankelijk en stateful. Beide paden
-- delen dezelfde rekenkern (_apply_match_rating), zodat ze niet kunnen driften.

-- Past het rating-verschil van één match toe op één speler: werkt
-- player_ratings bij en logt een rij in rating_history.
create or replace function public._apply_rating(
  p_player uuid,
  p_match uuid,
  p_delta int,
  p_ts timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before int;
  v_after int;
begin
  select rating into v_before from public.player_ratings where player_id = p_player;
  if v_before is null then
    v_before := 1000;
  end if;
  v_after := v_before + p_delta;

  insert into public.player_ratings (player_id, rating, games, updated_at)
  values (p_player, v_after, 1, now())
  on conflict (player_id) do update
    set rating = v_after,
        games = public.player_ratings.games + 1,
        updated_at = now();

  insert into public.rating_history (player_id, match_id, rating_before, rating_after, delta, played_at)
  values (p_player, p_match, v_before, v_after, p_delta, p_ts);
end;
$$;

revoke execute on function public._apply_rating(uuid, uuid, int, timestamptz) from public;

-- Rekenkern: berekent de ELO-delta's van één match op basis van de huidige
-- player_ratings en past ze toe op de vier betrokken spelers. Wordt door
-- zowel het incrementele pad als de volledige recompute gebruikt.
create or replace function public._apply_match_rating(p_match uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  k constant numeric := 24;      -- K-factor
  base constant int := 1000;
  m record;
  a1 uuid; a2 uuid; b1 uuid; b2 uuid;
  ra numeric; rb numeric;        -- teamratings (gemiddelde van de aanwezige spelers)
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

  -- Bij singles (a2/b2 null) telt alleen de rating van de ene speler; anders
  -- zou een fantoom-partner van 1000 meegemiddeld worden.
  ra := case when a2 is null
    then coalesce((select rating from public.player_ratings where player_id = a1), base)
    else (
      coalesce((select rating from public.player_ratings where player_id = a1), base)
      + coalesce((select rating from public.player_ratings where player_id = a2), base)
    ) / 2.0
  end;
  rb := case when b2 is null
    then coalesce((select rating from public.player_ratings where player_id = b1), base)
    else (
      coalesce((select rating from public.player_ratings where player_id = b1), base)
      + coalesce((select rating from public.player_ratings where player_id = b2), base)
    ) / 2.0
  end;

  ea := 1.0 / (1.0 + power(10.0, (rb - ra) / 400.0));
  sa := case
          when m.winner_team_id = m.team_a_id then 1.0
          when m.winner_team_id = m.team_b_id then 0.0
          else 0.5
        end;

  da := round(k * (sa - ea));
  db := round(k * ((1.0 - sa) - (1.0 - ea)));

  perform public._apply_rating(a1, m.id, da, m.ts);
  if a2 is not null then
    perform public._apply_rating(a2, m.id, da, m.ts);
  end if;
  perform public._apply_rating(b1, m.id, db, m.ts);
  if b2 is not null then
    perform public._apply_rating(b2, m.id, db, m.ts);
  end if;
end;
$$;

revoke execute on function public._apply_match_rating(uuid) from public;

-- Herberekent alle ratings van nul af aan uit de afgeronde matches.
create or replace function public.recompute_ratings()
returns void
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

revoke execute on function public.recompute_ratings() from public;

-- Trigger-dispatcher: kiest per statement tussen niets doen, incrementeel
-- toepassen (nieuwe matches op het einde van de chronologische keten) of een
-- volledige recompute (al het overige). Statement-level met transition tables,
-- zodat een multi-row statement hooguit één recompute veroorzaakt.
create or replace function public.matches_ratings_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

-- Let op: pias_of_week en zwarte_piet lezen rating_history en rekenen op de
-- alfabetische triggervolgorde ("ratings" < "refresh_pias" < "zwarte_piet").
create trigger matches_ratings_ins
  after insert on public.matches
  referencing new table as new_rows
  for each statement
  execute function public.matches_ratings_trigger();

-- Geen UPDATE OF-kolomlijst: die kan niet samen met transition tables
-- (Postgres-beperking). De Elo-tuple-vergelijking in de dispatcher maakt
-- irrelevante updates alsnog een goedkope no-op.
create trigger matches_ratings_upd
  after update on public.matches
  referencing old table as old_rows new table as new_rows
  for each statement
  execute function public.matches_ratings_trigger();

create trigger matches_ratings_del
  after delete on public.matches
  referencing old table as old_rows
  for each statement
  execute function public.matches_ratings_trigger();
