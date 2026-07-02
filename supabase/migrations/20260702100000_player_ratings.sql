
  create table "public"."player_ratings" (
    "player_id" uuid not null,
    "rating" integer not null default 1000,
    "games" integer not null default 0,
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."player_ratings" enable row level security;


  create table "public"."rating_history" (
    "id" uuid not null default gen_random_uuid(),
    "player_id" uuid not null,
    "match_id" uuid not null,
    "rating_before" integer not null,
    "rating_after" integer not null,
    "delta" integer not null,
    "played_at" timestamp with time zone not null
      );


alter table "public"."rating_history" enable row level security;

CREATE UNIQUE INDEX player_ratings_pkey ON public.player_ratings USING btree (player_id);

CREATE UNIQUE INDEX rating_history_pkey ON public.rating_history USING btree (id);

CREATE INDEX rating_history_player_idx ON public.rating_history USING btree (player_id, played_at);

alter table "public"."player_ratings" add constraint "player_ratings_pkey" PRIMARY KEY using index "player_ratings_pkey";

alter table "public"."rating_history" add constraint "rating_history_pkey" PRIMARY KEY using index "rating_history_pkey";

alter table "public"."player_ratings" add constraint "player_ratings_player_id_fkey" FOREIGN KEY (player_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."player_ratings" validate constraint "player_ratings_player_id_fkey";

alter table "public"."rating_history" add constraint "rating_history_match_id_fkey" FOREIGN KEY (match_id) REFERENCES public.matches(id) ON DELETE CASCADE not valid;

alter table "public"."rating_history" validate constraint "rating_history_match_id_fkey";

alter table "public"."rating_history" add constraint "rating_history_player_id_fkey" FOREIGN KEY (player_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."rating_history" validate constraint "rating_history_player_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public._apply_rating(p_player uuid, p_match uuid, p_delta integer, p_ts timestamp with time zone)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.trigger_recompute_ratings()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform public.recompute_ratings();
  return null;
end;
$function$
;

grant delete on table "public"."player_ratings" to "anon";

grant insert on table "public"."player_ratings" to "anon";

grant references on table "public"."player_ratings" to "anon";

grant select on table "public"."player_ratings" to "anon";

grant trigger on table "public"."player_ratings" to "anon";

grant truncate on table "public"."player_ratings" to "anon";

grant update on table "public"."player_ratings" to "anon";

grant delete on table "public"."player_ratings" to "authenticated";

grant insert on table "public"."player_ratings" to "authenticated";

grant references on table "public"."player_ratings" to "authenticated";

grant select on table "public"."player_ratings" to "authenticated";

grant trigger on table "public"."player_ratings" to "authenticated";

grant truncate on table "public"."player_ratings" to "authenticated";

grant update on table "public"."player_ratings" to "authenticated";

grant delete on table "public"."player_ratings" to "service_role";

grant insert on table "public"."player_ratings" to "service_role";

grant references on table "public"."player_ratings" to "service_role";

grant select on table "public"."player_ratings" to "service_role";

grant trigger on table "public"."player_ratings" to "service_role";

grant truncate on table "public"."player_ratings" to "service_role";

grant update on table "public"."player_ratings" to "service_role";

grant delete on table "public"."rating_history" to "anon";

grant insert on table "public"."rating_history" to "anon";

grant references on table "public"."rating_history" to "anon";

grant select on table "public"."rating_history" to "anon";

grant trigger on table "public"."rating_history" to "anon";

grant truncate on table "public"."rating_history" to "anon";

grant update on table "public"."rating_history" to "anon";

grant delete on table "public"."rating_history" to "authenticated";

grant insert on table "public"."rating_history" to "authenticated";

grant references on table "public"."rating_history" to "authenticated";

grant select on table "public"."rating_history" to "authenticated";

grant trigger on table "public"."rating_history" to "authenticated";

grant truncate on table "public"."rating_history" to "authenticated";

grant update on table "public"."rating_history" to "authenticated";

grant delete on table "public"."rating_history" to "service_role";

grant insert on table "public"."rating_history" to "service_role";

grant references on table "public"."rating_history" to "service_role";

grant select on table "public"."rating_history" to "service_role";

grant trigger on table "public"."rating_history" to "service_role";

grant truncate on table "public"."rating_history" to "service_role";

grant update on table "public"."rating_history" to "service_role";


  create policy "Ratings zijn publiek leesbaar"
  on "public"."player_ratings"
  as permissive
  for select
  to public
using (true);



  create policy "Rating-historie is publiek leesbaar"
  on "public"."rating_history"
  as permissive
  for select
  to public
using (true);


CREATE TRIGGER matches_recompute_ratings AFTER INSERT OR DELETE OR UPDATE ON public.matches FOR EACH STATEMENT EXECUTE FUNCTION public.trigger_recompute_ratings();

-- Eenmalige backfill: rating opbouwen uit de reeds afgeronde matches.
select public.recompute_ratings();

