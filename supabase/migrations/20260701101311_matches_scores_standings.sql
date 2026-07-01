create type "public"."match_status" as enum ('scheduled', 'in_progress', 'completed', 'cancelled');


  create table "public"."match_points" (
    "id" uuid not null default gen_random_uuid(),
    "match_id" uuid not null,
    "set_number" smallint not null,
    "game_number" smallint not null,
    "point_number" smallint not null,
    "won_by_team_id" uuid not null,
    "is_golden_point" boolean not null default false,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."match_points" enable row level security;


  create table "public"."matches" (
    "id" uuid not null default gen_random_uuid(),
    "team_a_id" uuid not null,
    "team_b_id" uuid not null,
    "status" public.match_status not null default 'scheduled'::public.match_status,
    "winner_team_id" uuid,
    "played_at" timestamp with time zone,
    "created_by" uuid,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."matches" enable row level security;


  create table "public"."teams" (
    "id" uuid not null default gen_random_uuid(),
    "name" text,
    "player1_id" uuid not null,
    "player2_id" uuid not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."teams" enable row level security;

CREATE UNIQUE INDEX match_points_match_id_set_number_game_number_point_number_key ON public.match_points USING btree (match_id, set_number, game_number, point_number);

CREATE INDEX match_points_match_idx ON public.match_points USING btree (match_id);

CREATE UNIQUE INDEX match_points_pkey ON public.match_points USING btree (id);

CREATE UNIQUE INDEX matches_pkey ON public.matches USING btree (id);

CREATE INDEX matches_team_a_idx ON public.matches USING btree (team_a_id);

CREATE INDEX matches_team_b_idx ON public.matches USING btree (team_b_id);

CREATE UNIQUE INDEX teams_pkey ON public.teams USING btree (id);

CREATE UNIQUE INDEX teams_unique_pair ON public.teams USING btree (LEAST(player1_id, player2_id), GREATEST(player1_id, player2_id));

alter table "public"."match_points" add constraint "match_points_pkey" PRIMARY KEY using index "match_points_pkey";

alter table "public"."matches" add constraint "matches_pkey" PRIMARY KEY using index "matches_pkey";

alter table "public"."teams" add constraint "teams_pkey" PRIMARY KEY using index "teams_pkey";

alter table "public"."match_points" add constraint "match_points_game_number_check" CHECK ((game_number >= 1)) not valid;

alter table "public"."match_points" validate constraint "match_points_game_number_check";

alter table "public"."match_points" add constraint "match_points_match_id_fkey" FOREIGN KEY (match_id) REFERENCES public.matches(id) ON DELETE CASCADE not valid;

alter table "public"."match_points" validate constraint "match_points_match_id_fkey";

alter table "public"."match_points" add constraint "match_points_match_id_set_number_game_number_point_number_key" UNIQUE using index "match_points_match_id_set_number_game_number_point_number_key";

alter table "public"."match_points" add constraint "match_points_point_number_check" CHECK ((point_number >= 1)) not valid;

alter table "public"."match_points" validate constraint "match_points_point_number_check";

alter table "public"."match_points" add constraint "match_points_set_number_check" CHECK (((set_number >= 1) AND (set_number <= 3))) not valid;

alter table "public"."match_points" validate constraint "match_points_set_number_check";

alter table "public"."match_points" add constraint "match_points_won_by_team_id_fkey" FOREIGN KEY (won_by_team_id) REFERENCES public.teams(id) ON DELETE RESTRICT not valid;

alter table "public"."match_points" validate constraint "match_points_won_by_team_id_fkey";

alter table "public"."matches" add constraint "matches_created_by_fkey" FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL not valid;

alter table "public"."matches" validate constraint "matches_created_by_fkey";

alter table "public"."matches" add constraint "matches_distinct_teams" CHECK ((team_a_id <> team_b_id)) not valid;

alter table "public"."matches" validate constraint "matches_distinct_teams";

alter table "public"."matches" add constraint "matches_team_a_id_fkey" FOREIGN KEY (team_a_id) REFERENCES public.teams(id) ON DELETE RESTRICT not valid;

alter table "public"."matches" validate constraint "matches_team_a_id_fkey";

alter table "public"."matches" add constraint "matches_team_b_id_fkey" FOREIGN KEY (team_b_id) REFERENCES public.teams(id) ON DELETE RESTRICT not valid;

alter table "public"."matches" validate constraint "matches_team_b_id_fkey";

alter table "public"."matches" add constraint "matches_winner_team_id_fkey" FOREIGN KEY (winner_team_id) REFERENCES public.teams(id) ON DELETE RESTRICT not valid;

alter table "public"."matches" validate constraint "matches_winner_team_id_fkey";

alter table "public"."matches" add constraint "matches_winner_valid" CHECK (((winner_team_id IS NULL) OR ((winner_team_id = team_a_id) OR (winner_team_id = team_b_id)))) not valid;

alter table "public"."matches" validate constraint "matches_winner_valid";

alter table "public"."teams" add constraint "teams_distinct_players" CHECK ((player1_id <> player2_id)) not valid;

alter table "public"."teams" validate constraint "teams_distinct_players";

alter table "public"."teams" add constraint "teams_player1_id_fkey" FOREIGN KEY (player1_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."teams" validate constraint "teams_player1_id_fkey";

alter table "public"."teams" add constraint "teams_player2_id_fkey" FOREIGN KEY (player2_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."teams" validate constraint "teams_player2_id_fkey";

create or replace view "public"."standings" with (security_invoker=true) as  WITH results AS (
         SELECT matches.team_a_id AS team_id,
            matches.winner_team_id
           FROM public.matches
          WHERE (matches.status = 'completed'::public.match_status)
        UNION ALL
         SELECT matches.team_b_id AS team_id,
            matches.winner_team_id
           FROM public.matches
          WHERE (matches.status = 'completed'::public.match_status)
        )
 SELECT t.id AS team_id,
    t.name AS team_name,
    count(*) AS played,
    count(*) FILTER (WHERE (r.winner_team_id = r.team_id)) AS won,
    count(*) FILTER (WHERE ((r.winner_team_id IS NOT NULL) AND (r.winner_team_id <> r.team_id))) AS lost,
    (count(*) FILTER (WHERE (r.winner_team_id = r.team_id)) * 3) AS points
   FROM (results r
     JOIN public.teams t ON ((t.id = r.team_id)))
  GROUP BY t.id, t.name;


grant delete on table "public"."match_points" to "anon";

grant insert on table "public"."match_points" to "anon";

grant references on table "public"."match_points" to "anon";

grant select on table "public"."match_points" to "anon";

grant trigger on table "public"."match_points" to "anon";

grant truncate on table "public"."match_points" to "anon";

grant update on table "public"."match_points" to "anon";

grant delete on table "public"."match_points" to "authenticated";

grant insert on table "public"."match_points" to "authenticated";

grant references on table "public"."match_points" to "authenticated";

grant select on table "public"."match_points" to "authenticated";

grant trigger on table "public"."match_points" to "authenticated";

grant truncate on table "public"."match_points" to "authenticated";

grant update on table "public"."match_points" to "authenticated";

grant delete on table "public"."match_points" to "service_role";

grant insert on table "public"."match_points" to "service_role";

grant references on table "public"."match_points" to "service_role";

grant select on table "public"."match_points" to "service_role";

grant trigger on table "public"."match_points" to "service_role";

grant truncate on table "public"."match_points" to "service_role";

grant update on table "public"."match_points" to "service_role";

grant delete on table "public"."matches" to "anon";

grant insert on table "public"."matches" to "anon";

grant references on table "public"."matches" to "anon";

grant select on table "public"."matches" to "anon";

grant trigger on table "public"."matches" to "anon";

grant truncate on table "public"."matches" to "anon";

grant update on table "public"."matches" to "anon";

grant delete on table "public"."matches" to "authenticated";

grant insert on table "public"."matches" to "authenticated";

grant references on table "public"."matches" to "authenticated";

grant select on table "public"."matches" to "authenticated";

grant trigger on table "public"."matches" to "authenticated";

grant truncate on table "public"."matches" to "authenticated";

grant update on table "public"."matches" to "authenticated";

grant delete on table "public"."matches" to "service_role";

grant insert on table "public"."matches" to "service_role";

grant references on table "public"."matches" to "service_role";

grant select on table "public"."matches" to "service_role";

grant trigger on table "public"."matches" to "service_role";

grant truncate on table "public"."matches" to "service_role";

grant update on table "public"."matches" to "service_role";

grant delete on table "public"."teams" to "anon";

grant insert on table "public"."teams" to "anon";

grant references on table "public"."teams" to "anon";

grant select on table "public"."teams" to "anon";

grant trigger on table "public"."teams" to "anon";

grant truncate on table "public"."teams" to "anon";

grant update on table "public"."teams" to "anon";

grant delete on table "public"."teams" to "authenticated";

grant insert on table "public"."teams" to "authenticated";

grant references on table "public"."teams" to "authenticated";

grant select on table "public"."teams" to "authenticated";

grant trigger on table "public"."teams" to "authenticated";

grant truncate on table "public"."teams" to "authenticated";

grant update on table "public"."teams" to "authenticated";

grant delete on table "public"."teams" to "service_role";

grant insert on table "public"."teams" to "service_role";

grant references on table "public"."teams" to "service_role";

grant select on table "public"."teams" to "service_role";

grant trigger on table "public"."teams" to "service_role";

grant truncate on table "public"."teams" to "service_role";

grant update on table "public"."teams" to "service_role";


  create policy "Match-aanmaker kan punten toevoegen"
  on "public"."match_points"
  as permissive
  for insert
  to authenticated
with check ((EXISTS ( SELECT 1
   FROM public.matches m
  WHERE ((m.id = match_points.match_id) AND (m.created_by = ( SELECT auth.uid() AS uid))))));



  create policy "Punten zijn publiek leesbaar"
  on "public"."match_points"
  as permissive
  for select
  to public
using (true);



  create policy "Aanmaker kan match bijwerken"
  on "public"."matches"
  as permissive
  for update
  to authenticated
using ((( SELECT auth.uid() AS uid) = created_by))
with check ((( SELECT auth.uid() AS uid) = created_by));



  create policy "Gebruiker kan match aanmaken"
  on "public"."matches"
  as permissive
  for insert
  to authenticated
with check ((( SELECT auth.uid() AS uid) = created_by));



  create policy "Matches zijn publiek leesbaar"
  on "public"."matches"
  as permissive
  for select
  to public
using (true);



  create policy "Speler kan eigen team aanmaken"
  on "public"."teams"
  as permissive
  for insert
  to authenticated
with check (((( SELECT auth.uid() AS uid) = player1_id) OR (( SELECT auth.uid() AS uid) = player2_id)));



  create policy "Teamlid kan team bijwerken"
  on "public"."teams"
  as permissive
  for update
  to authenticated
using (((( SELECT auth.uid() AS uid) = player1_id) OR (( SELECT auth.uid() AS uid) = player2_id)))
with check (((( SELECT auth.uid() AS uid) = player1_id) OR (( SELECT auth.uid() AS uid) = player2_id)));



  create policy "Teams zijn publiek leesbaar"
  on "public"."teams"
  as permissive
  for select
  to public
using (true);



