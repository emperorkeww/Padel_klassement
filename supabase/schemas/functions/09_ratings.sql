-- ELO-berekening. Bewuste keuze: bij elke wijziging aan matches wordt de
-- volledige rating-historie opnieuw opgebouwd uit alle afgeronde matches in
-- chronologische volgorde. ELO is volgorde-afhankelijk en stateful; volledig
-- herberekenen houdt het altijd correct, óók bij score-correcties en
-- niet-chronologische invoer. Voor de schaal van een vriendengroep is dit ruim
-- voldoende; bij veel data kan dit later incrementeel gemaakt worden.

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

-- Herberekent alle ratings van nul af aan uit de afgeronde matches.
create or replace function public.recompute_ratings()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  m record;
  k constant numeric := 24;      -- K-factor
  base constant int := 1000;
  a1 uuid; a2 uuid; b1 uuid; b2 uuid;
  ra numeric; rb numeric;        -- teamratings (gemiddelde van twee spelers)
  ea numeric;                    -- verwachte score team A
  sa numeric;                    -- werkelijke score team A (1/0.5/0)
  da int; db int;                -- rating-delta per team
begin
  delete from public.rating_history;
  delete from public.player_ratings;

  for m in
    select mt.id, mt.team_a_id, mt.team_b_id, mt.winner_team_id,
           coalesce(mt.played_at, mt.created_at) as ts
    from public.matches mt
    where mt.status = 'completed'
    order by coalesce(mt.played_at, mt.created_at), mt.created_at, mt.id
  loop
    select ta.player1_id, ta.player2_id, tb.player1_id, tb.player2_id
      into a1, a2, b1, b2
      from public.teams ta, public.teams tb
      where ta.id = m.team_a_id and tb.id = m.team_b_id;

    -- Ontbrekende teams (verwijderd?) overslaan.
    if a1 is null or b1 is null then
      continue;
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
  end loop;
end;
$$;

revoke execute on function public.recompute_ratings() from public;

-- Trigger-wrapper: herberekent na elke wijziging aan matches.
create or replace function public.trigger_recompute_ratings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.recompute_ratings();
  return null;
end;
$$;

create trigger matches_recompute_ratings
  after insert or update or delete on public.matches
  for each statement
  execute function public.trigger_recompute_ratings();
