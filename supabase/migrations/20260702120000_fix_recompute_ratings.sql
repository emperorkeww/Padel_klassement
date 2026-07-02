-- Reparatie: recompute_ratings met een gekwalificeerde DELETE (WHERE true).
--
-- De fix voor de safeupdate-blokkade werd eerder in de reeds-toegepaste
-- migratie 20260702100000 aangepast. Omdat die versie op de remote database al
-- als toegepast geregistreerd stond, kreeg de remote de fix niet via db push.
-- Deze forward-only migratie herdefinieert de functie idempotent (CREATE OR
-- REPLACE), zodat elke omgeving de correcte versie krijgt. Zie ook
-- schemas/functions/09_ratings.sql (bron van waarheid) — inhoud identiek, dus
-- db diff blijft schoon.

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
  -- WHERE true is vereist: de authenticator-rol laadt de safeupdate-library,
  -- die ongekwalificeerde DELETE (zonder WHERE) blokkeert — ook binnen deze
  -- SECURITY DEFINER-functie, want de library werkt sessiebreed.
  delete from public.rating_history where true;
  delete from public.player_ratings where true;

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

-- Herbereken meteen, zodat een remote met de oude (mislukte) staat alsnog
-- correcte ratings krijgt.
select public.recompute_ratings();
