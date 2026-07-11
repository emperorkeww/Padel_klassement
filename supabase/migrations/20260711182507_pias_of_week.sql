-- Pias van de week (#127): per groep, per ISO-week één aangeduide "pias" — de
-- grootste choke (favoriet die verloor). Afgeleide, read-only data: enkel de
-- SECURITY DEFINER-trigger schrijft. Zie schemas/tables/15_pias_of_week.sql,
-- schemas/functions/20_pias_of_week.sql en schemas/policies/pias_of_week.sql.
--
-- NB: de door `supabase db diff` gegenereerde diff bevatte spurious drops/
-- herbouw van de standen-views (zónder security_invoker) en van storage-
-- avatarpolicies, plus write-grants op deze read-only tabel en géén
-- `revoke execute`. Die zijn hier handmatig verwijderd/toegevoegd.

create table "public"."pias_of_week" (
    "group_id" uuid not null,
    "iso_year" smallint not null,
    "iso_week" smallint not null,
    "player_id" uuid not null,
    "match_id" uuid not null,
    "win_chance" numeric not null,
    "week_start" date not null,
    "created_at" timestamp with time zone not null default now()
);

alter table "public"."pias_of_week" enable row level security;

CREATE INDEX pias_of_week_group_idx ON public.pias_of_week USING btree (group_id);

CREATE UNIQUE INDEX pias_of_week_pkey ON public.pias_of_week USING btree (group_id, iso_year, iso_week);

alter table "public"."pias_of_week" add constraint "pias_of_week_pkey" PRIMARY KEY using index "pias_of_week_pkey";

alter table "public"."pias_of_week" add constraint "pias_of_week_group_id_fkey" FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE not valid;

alter table "public"."pias_of_week" validate constraint "pias_of_week_group_id_fkey";

alter table "public"."pias_of_week" add constraint "pias_of_week_match_id_fkey" FOREIGN KEY (match_id) REFERENCES public.matches(id) ON DELETE CASCADE not valid;

alter table "public"."pias_of_week" validate constraint "pias_of_week_match_id_fkey";

alter table "public"."pias_of_week" add constraint "pias_of_week_player_id_fkey" FOREIGN KEY (player_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."pias_of_week" validate constraint "pias_of_week_player_id_fkey";

alter table "public"."pias_of_week" add constraint "pias_of_week_win_chance_check" CHECK (((win_chance > (0)::numeric) AND (win_chance < (1)::numeric))) not valid;

alter table "public"."pias_of_week" validate constraint "pias_of_week_win_chance_check";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.recompute_pias()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

revoke execute on function public.recompute_pias() from public;

CREATE OR REPLACE FUNCTION public.trigger_recompute_pias()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform public.recompute_pias();
  return null;
end;
$function$
;

revoke execute on function public.trigger_recompute_pias() from public;

-- Read-only voor clients: enkel select. Schrijven doet alleen de SECURITY
-- DEFINER-trigger (die als eigenaar draait en RLS/grants omzeilt).
grant select on table "public"."pias_of_week" to "anon";
grant select on table "public"."pias_of_week" to "authenticated";
grant delete on table "public"."pias_of_week" to "service_role";
grant insert on table "public"."pias_of_week" to "service_role";
grant references on table "public"."pias_of_week" to "service_role";
grant select on table "public"."pias_of_week" to "service_role";
grant trigger on table "public"."pias_of_week" to "service_role";
grant truncate on table "public"."pias_of_week" to "service_role";
grant update on table "public"."pias_of_week" to "service_role";

create policy "pias_of_week_select_member"
  on "public"."pias_of_week"
  as permissive
  for select
  to public
using (public.is_group_member(group_id, ( SELECT auth.uid() AS uid)));

CREATE TRIGGER matches_refresh_pias AFTER INSERT OR DELETE OR UPDATE ON public.matches FOR EACH STATEMENT EXECUTE FUNCTION public.trigger_recompute_pias();
