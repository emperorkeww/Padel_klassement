-- Smoesjesmachine (#296): persistente smoezen op verloren groepsmatches, zichtbaar
-- voor de groep op de feed. Zie supabase/schemas/{tables,policies,functions}/
-- *match_smoesjes* voor de bron. Handmatig geschreven i.p.v. db diff: migra laat
-- kolomgrants en de realtime-publicatie weg, en die zijn hier essentieel.

  create table "public"."match_smoesjes" (
    "match_id" uuid not null,
    "player_id" uuid not null,
    "group_id" uuid not null,
    "smoes" text not null,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."match_smoesjes" enable row level security;

CREATE INDEX match_smoesjes_group_idx ON public.match_smoesjes USING btree (group_id);

CREATE UNIQUE INDEX match_smoesjes_pkey ON public.match_smoesjes USING btree (match_id, player_id);

alter table "public"."match_smoesjes" add constraint "match_smoesjes_pkey" PRIMARY KEY using index "match_smoesjes_pkey";

alter table "public"."match_smoesjes" add constraint "match_smoesjes_group_id_fkey" FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE not valid;

alter table "public"."match_smoesjes" validate constraint "match_smoesjes_group_id_fkey";

alter table "public"."match_smoesjes" add constraint "match_smoesjes_match_id_fkey" FOREIGN KEY (match_id) REFERENCES public.matches(id) ON DELETE CASCADE not valid;

alter table "public"."match_smoesjes" validate constraint "match_smoesjes_match_id_fkey";

alter table "public"."match_smoesjes" add constraint "match_smoesjes_player_id_fkey" FOREIGN KEY (player_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."match_smoesjes" validate constraint "match_smoesjes_player_id_fkey";

alter table "public"."match_smoesjes" add constraint "match_smoesjes_smoes_check" CHECK ((char_length(smoes) >= 1 AND char_length(smoes) <= 280)) not valid;

alter table "public"."match_smoesjes" validate constraint "match_smoesjes_smoes_check";

set check_function_bodies = off;

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

grant delete on table "public"."match_smoesjes" to "anon";

grant insert on table "public"."match_smoesjes" to "anon";

grant references on table "public"."match_smoesjes" to "anon";

grant select on table "public"."match_smoesjes" to "anon";

grant trigger on table "public"."match_smoesjes" to "anon";

grant truncate on table "public"."match_smoesjes" to "anon";

grant update on table "public"."match_smoesjes" to "anon";

grant delete on table "public"."match_smoesjes" to "authenticated";

grant references on table "public"."match_smoesjes" to "authenticated";

grant select on table "public"."match_smoesjes" to "authenticated";

grant trigger on table "public"."match_smoesjes" to "authenticated";

grant truncate on table "public"."match_smoesjes" to "authenticated";

grant delete on table "public"."match_smoesjes" to "service_role";

grant insert on table "public"."match_smoesjes" to "service_role";

grant references on table "public"."match_smoesjes" to "service_role";

grant select on table "public"."match_smoesjes" to "service_role";

grant trigger on table "public"."match_smoesjes" to "service_role";

grant truncate on table "public"."match_smoesjes" to "service_role";

grant update on table "public"."match_smoesjes" to "service_role";


  create policy "match_smoesjes_delete_own"
  on "public"."match_smoesjes"
  as permissive
  for delete
  to public
using ((player_id = ( SELECT auth.uid() AS uid)));



  create policy "match_smoesjes_insert_own"
  on "public"."match_smoesjes"
  as permissive
  for insert
  to public
with check (((player_id = ( SELECT auth.uid() AS uid)) AND public.is_group_member(group_id, ( SELECT auth.uid() AS uid))));



  create policy "match_smoesjes_select_member"
  on "public"."match_smoesjes"
  as permissive
  for select
  to public
using (public.is_group_member(group_id, ( SELECT auth.uid() AS uid)));



  create policy "match_smoesjes_update_own"
  on "public"."match_smoesjes"
  as permissive
  for update
  to public
using ((player_id = ( SELECT auth.uid() AS uid)))
with check ((player_id = ( SELECT auth.uid() AS uid)));


CREATE TRIGGER match_smoesjes_guard BEFORE INSERT OR UPDATE ON public.match_smoesjes FOR EACH ROW EXECUTE FUNCTION public.match_smoesjes_guard();

-- Kolomgrants (migra neemt kolomprivileges niet mee in de diff): updated_at wordt
-- uitsluitend serverside gezet, zie policies/match_smoesjes.sql. De revoke is
-- nodig omdat de default privileges anders alsnog volledige insert/update geven.
revoke insert, update on public.match_smoesjes from authenticated;
grant insert (match_id, player_id, group_id, smoes),
      update (match_id, player_id, group_id, smoes)
  on public.match_smoesjes to authenticated;

alter publication supabase_realtime add table public.match_smoesjes;
