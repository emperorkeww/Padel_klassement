drop view if exists "public"."group_player_standings";

drop view if exists "public"."player_standings";


  create table "public"."match_predictions" (
    "match_id" uuid not null,
    "player_id" uuid not null,
    "group_id" uuid not null,
    "predicted_team_id" uuid not null,
    "win_chance" numeric not null,
    "points" smallint,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."match_predictions" enable row level security;

CREATE INDEX match_predictions_group_idx ON public.match_predictions USING btree (group_id);

CREATE UNIQUE INDEX match_predictions_pkey ON public.match_predictions USING btree (match_id, player_id);

alter table "public"."match_predictions" add constraint "match_predictions_pkey" PRIMARY KEY using index "match_predictions_pkey";

alter table "public"."match_predictions" add constraint "match_predictions_group_id_fkey" FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE not valid;

alter table "public"."match_predictions" validate constraint "match_predictions_group_id_fkey";

alter table "public"."match_predictions" add constraint "match_predictions_match_id_fkey" FOREIGN KEY (match_id) REFERENCES public.matches(id) ON DELETE CASCADE not valid;

alter table "public"."match_predictions" validate constraint "match_predictions_match_id_fkey";

alter table "public"."match_predictions" add constraint "match_predictions_player_id_fkey" FOREIGN KEY (player_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."match_predictions" validate constraint "match_predictions_player_id_fkey";

alter table "public"."match_predictions" add constraint "match_predictions_predicted_team_id_fkey" FOREIGN KEY (predicted_team_id) REFERENCES public.teams(id) ON DELETE CASCADE not valid;

alter table "public"."match_predictions" validate constraint "match_predictions_predicted_team_id_fkey";

alter table "public"."match_predictions" add constraint "match_predictions_win_chance_check" CHECK (((win_chance > (0)::numeric) AND (win_chance < (1)::numeric))) not valid;

alter table "public"."match_predictions" validate constraint "match_predictions_win_chance_check";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.grade_match_predictions()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if new.status = 'completed' then
    update public.match_predictions p
       set points = case
             when new.winner_team_id is not null
              and p.predicted_team_id = new.winner_team_id
             then public.prediction_points(p.win_chance)
             else 0
           end
     where p.match_id = new.id;
  elsif old.status = 'completed' then
    update public.match_predictions p
       set points = null
     where p.match_id = new.id;
  end if;
  return null;
end;
$function$
;

create or replace view "public"."group_prediction_standings" with (security_invoker = true) as  SELECT mp.group_id,
    p.id AS player_id,
    p.username,
    p.full_name,
    count(*) FILTER (WHERE (mp.points IS NOT NULL)) AS predicted,
    count(*) FILTER (WHERE (mp.points > 0)) AS correct,
    COALESCE(sum(mp.points), (0)::bigint) AS points
   FROM (public.match_predictions mp
     JOIN public.profiles p ON ((p.id = mp.player_id)))
  GROUP BY mp.group_id, p.id, p.username, p.full_name;


CREATE OR REPLACE FUNCTION public.match_predictions_delete_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  m record;
begin
  if pg_trigger_depth() > 1 then
    return old; -- cascade (match of groep verwijderd): altijd toestaan
  end if;
  select status, played_at into m from public.matches where id = old.match_id;
  if not found then
    return old; -- match al verwijderd
  end if;
  if m.status <> 'scheduled' or (m.played_at is not null and m.played_at <= now()) then
    raise exception 'deze tip is vergrendeld: de match is al begonnen of afgerond';
  end if;
  return old;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.match_predictions_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  m record;
begin
  -- Doorlaat voor de grader: een UPDATE die de tip zelf niet wijzigt
  -- (alleen points) hoeft niet opnieuw gevalideerd te worden.
  if tg_op = 'UPDATE'
     and new.predicted_team_id = old.predicted_team_id
     and new.match_id = old.match_id
     and new.player_id = old.player_id
     and new.group_id = old.group_id then
    return new;
  end if;

  select id, group_id, status, played_at, team_a_id, team_b_id
    into m
    from public.matches
    where id = new.match_id;

  if m.id is null then
    raise exception 'match bestaat niet';
  end if;
  if m.group_id is null or m.group_id is distinct from new.group_id then
    raise exception 'tippen kan alleen op groepsmatches';
  end if;
  if m.status <> 'scheduled' then
    raise exception 'deze match is al begonnen of afgerond';
  end if;
  if m.played_at is not null and m.played_at <= now() then
    raise exception 'de match is al begonnen';
  end if;
  if new.predicted_team_id not in (m.team_a_id, m.team_b_id) then
    raise exception 'het getipte team speelt niet mee in deze match';
  end if;

  new.win_chance := public.prediction_win_chance(new.match_id, new.predicted_team_id);
  new.points := null;
  new.updated_at := now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.prediction_points(p_chance numeric)
 RETURNS smallint
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select greatest(1, least(4, round((1 - p_chance) * 5)))::smallint;
$function$
;

CREATE OR REPLACE FUNCTION public.prediction_win_chance(p_match uuid, p_team uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  base constant int := 1000;
  m record;
  v_other uuid;
  p1 uuid; p2 uuid; o1 uuid; o2 uuid;
  r_team numeric; r_other numeric;
begin
  select team_a_id, team_b_id into m from public.matches where id = p_match;
  if m.team_a_id is null then
    raise exception 'match bestaat niet';
  end if;
  v_other := case when p_team = m.team_a_id then m.team_b_id else m.team_a_id end;

  select t.player1_id, t.player2_id into p1, p2 from public.teams t where t.id = p_team;
  select t.player1_id, t.player2_id into o1, o2 from public.teams t where t.id = v_other;

  r_team := (
    coalesce((select rating from public.player_ratings where player_id = p1), base)
    + coalesce((select rating from public.player_ratings where player_id = p2), base)
  ) / 2.0;
  r_other := (
    coalesce((select rating from public.player_ratings where player_id = o1), base)
    + coalesce((select rating from public.player_ratings where player_id = o2), base)
  ) / 2.0;

  return round(1.0 / (1.0 + power(10.0, (r_other - r_team) / 400.0)), 4);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.create_fair_round(p_group_id uuid, p_players uuid[])
 RETURNS SETOF uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := (select auth.uid());
  v_round smallint;
  v_n int := coalesce(array_length(p_players, 1), 0);
  v_i int;
  v_team_a uuid;
  v_team_b uuid;
  v_match_id uuid;
begin
  if v_uid is null then
    raise exception 'Niet ingelogd';
  end if;
  if not public.is_group_member(p_group_id, v_uid) then
    raise exception 'Geen toegang tot deze groep';
  end if;
  if v_n < 4 or v_n % 4 <> 0 then
    raise exception 'Aantal spelers moet een veelvoud van 4 zijn (nu %).', v_n;
  end if;

  if exists (
    select 1 from unnest(p_players) as pid
    where not public.is_group_member(p_group_id, pid)
  ) then
    raise exception 'Alle spelers moeten lid zijn van deze groep';
  end if;

  select coalesce(max(round_number), 0) + 1 into v_round
  from public.matches
  where group_id = p_group_id;

  v_i := 1;
  while v_i + 3 <= v_n loop
    if p_players[v_i] in (p_players[v_i + 1], p_players[v_i + 2], p_players[v_i + 3])
       or p_players[v_i + 1] in (p_players[v_i + 2], p_players[v_i + 3])
       or p_players[v_i + 2] = p_players[v_i + 3] then
      raise exception 'De vier spelers per baan moeten verschillend zijn';
    end if;

    v_team_a := public._ensure_team(p_players[v_i], p_players[v_i + 1]);
    v_team_b := public._ensure_team(p_players[v_i + 2], p_players[v_i + 3]);

    insert into public.matches (team_a_id, team_b_id, status, group_id, round_number, created_by)
    values (v_team_a, v_team_b, 'scheduled', p_group_id, v_round, v_uid)
    returning id into v_match_id;

    return next v_match_id;
    v_i := v_i + 4;
  end loop;

  return;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.create_group_invite(p_group_id uuid, p_days integer DEFAULT 14)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := (select auth.uid());
  v_token uuid;
begin
  if v_uid is null then
    raise exception 'Niet ingelogd';
  end if;
  if not public.is_group_owner(p_group_id, v_uid) then
    raise exception 'Alleen de eigenaar kan een uitnodiging maken';
  end if;

  select token into v_token
  from public.group_invites
  where group_id = p_group_id
    and (expires_at is null or expires_at > now())
  order by created_at desc
  limit 1;

  if v_token is null then
    insert into public.group_invites (group_id, created_by, expires_at)
    values (p_group_id, v_uid, now() + make_interval(days => greatest(p_days, 1)))
    returning token into v_token;
  end if;

  return v_token;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.create_planned_match(p_a1 uuid, p_a2 uuid, p_b1 uuid, p_b2 uuid, p_played_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_group_id uuid DEFAULT NULL::uuid, p_set_scores jsonb DEFAULT NULL::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := (select auth.uid());
  v_team_a uuid;
  v_team_b uuid;
  v_match uuid;
begin
  if v_uid is null then
    raise exception 'Niet ingelogd';
  end if;
  if p_a1 is null or p_a2 is null or p_b1 is null or p_b2 is null then
    raise exception 'Vier spelers vereist';
  end if;
  if p_a1 in (p_a2, p_b1, p_b2) or p_a2 in (p_b1, p_b2) or p_b1 = p_b2 then
    raise exception 'De vier spelers moeten verschillend zijn';
  end if;

  -- Loggen binnen een groep mag alleen als je zelf lid bent.
  if p_group_id is not null and not public.is_group_member(p_group_id, v_uid) then
    raise exception 'Geen toegang tot deze groep';
  end if;

  -- Jezelf, je vrienden, je eigen gasten of (binnen een groep) medeleden.
  if not public._can_add_player(v_uid, p_a1, p_group_id)
     or not public._can_add_player(v_uid, p_a2, p_group_id)
     or not public._can_add_player(v_uid, p_b1, p_group_id)
     or not public._can_add_player(v_uid, p_b2, p_group_id) then
    raise exception 'Je kunt alleen jezelf, je vrienden, je eigen gasten en groepsleden aan een match toevoegen';
  end if;

  v_team_a := public._ensure_team(p_a1, p_a2);
  v_team_b := public._ensure_team(p_b1, p_b2);

  insert into public.matches (
    team_a_id, team_b_id, status, played_at, created_by, group_id, set_scores
  )
  values (
    v_team_a, v_team_b, 'scheduled', p_played_at, v_uid, p_group_id, p_set_scores
  )
  returning id into v_match;

  return v_match;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_friend_suggestions(p_limit integer DEFAULT 12)
 RETURNS TABLE(id uuid, mutual_count integer, mutual_ids uuid[])
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with me as (select auth.uid() as uid),
  -- Mijn geaccepteerde vrienden.
  my_friends as (
    select case when f.requester_id = m.uid then f.addressee_id else f.requester_id end as friend_id
    from public.friendships f, me m
    where f.status = 'accepted' and m.uid in (f.requester_id, f.addressee_id)
  ),
  -- Iedereen met wie ik al enige relatie heb (pending/accepted/declined) -> uitsluiten.
  related as (
    select case when f.requester_id = m.uid then f.addressee_id else f.requester_id end as rid
    from public.friendships f, me m
    where m.uid in (f.requester_id, f.addressee_id)
  ),
  -- Vrienden-van-vrienden met de gemeenschappelijke (geaccepteerde) vrienden.
  fof as (
    select case when f.requester_id = mf.friend_id then f.addressee_id else f.requester_id end as cand,
           count(*)::int as mutual,
           array_agg(mf.friend_id) as mutual_ids
    from public.friendships f
    join my_friends mf on mf.friend_id in (f.requester_id, f.addressee_id)
    where f.status = 'accepted'
    group by 1
  )
  select p.id,
         coalesce(fof.mutual, 0) as mutual_count,
         coalesce(fof.mutual_ids, '{}') as mutual_ids
  from public.profiles p
  left join fof on fof.cand = p.id
  where p.id <> (select uid from me)
    and not p.is_guest
    and p.id not in (select rid from related)
  order by mutual_count desc, random()
  limit p_limit;
$function$
;

create or replace view "public"."group_player_standings" with (security_invoker = true) as  WITH team_results AS (
         SELECT matches.group_id,
            matches.team_a_id AS team_id,
            matches.winner_team_id,
            matches.score_a AS scored_for,
            matches.score_b AS scored_against
           FROM public.matches
          WHERE ((matches.status = 'completed'::public.match_status) AND (matches.group_id IS NOT NULL))
        UNION ALL
         SELECT matches.group_id,
            matches.team_b_id AS team_id,
            matches.winner_team_id,
            matches.score_b AS scored_for,
            matches.score_a AS scored_against
           FROM public.matches
          WHERE ((matches.status = 'completed'::public.match_status) AND (matches.group_id IS NOT NULL))
        ), player_team AS (
         SELECT teams.id AS team_id,
            teams.player1_id AS player_id
           FROM public.teams
        UNION ALL
         SELECT teams.id AS team_id,
            teams.player2_id AS player_id
           FROM public.teams
        )
 SELECT tr.group_id,
    p.id AS player_id,
    p.username,
    p.full_name,
    count(*) AS played,
    count(*) FILTER (WHERE (tr.winner_team_id = tr.team_id)) AS won,
    count(*) FILTER (WHERE (tr.winner_team_id IS NULL)) AS drawn,
    count(*) FILTER (WHERE ((tr.winner_team_id IS NOT NULL) AND (tr.winner_team_id <> tr.team_id))) AS lost,
    ((count(*) FILTER (WHERE (tr.winner_team_id = tr.team_id)) * 3) + count(*) FILTER (WHERE (tr.winner_team_id IS NULL))) AS points,
    COALESCE(sum((COALESCE((tr.scored_for)::integer, 0) - COALESCE((tr.scored_against)::integer, 0))), (0)::bigint) AS goal_diff
   FROM ((team_results tr
     JOIN player_team pt ON ((pt.team_id = tr.team_id)))
     JOIN public.profiles p ON ((p.id = pt.player_id)))
  GROUP BY tr.group_id, p.id, p.username, p.full_name;


create or replace view "public"."player_standings" with (security_invoker = true) as  WITH team_results AS (
         SELECT matches.team_a_id AS team_id,
            matches.winner_team_id,
            matches.score_a AS scored_for,
            matches.score_b AS scored_against
           FROM public.matches
          WHERE (matches.status = 'completed'::public.match_status)
        UNION ALL
         SELECT matches.team_b_id AS team_id,
            matches.winner_team_id,
            matches.score_b AS scored_for,
            matches.score_a AS scored_against
           FROM public.matches
          WHERE (matches.status = 'completed'::public.match_status)
        ), player_team AS (
         SELECT teams.id AS team_id,
            teams.player1_id AS player_id
           FROM public.teams
        UNION ALL
         SELECT teams.id AS team_id,
            teams.player2_id AS player_id
           FROM public.teams
        )
 SELECT p.id AS player_id,
    p.username,
    p.full_name,
    count(*) AS played,
    count(*) FILTER (WHERE (tr.winner_team_id = tr.team_id)) AS won,
    count(*) FILTER (WHERE (tr.winner_team_id IS NULL)) AS drawn,
    count(*) FILTER (WHERE ((tr.winner_team_id IS NOT NULL) AND (tr.winner_team_id <> tr.team_id))) AS lost,
    ((count(*) FILTER (WHERE (tr.winner_team_id = tr.team_id)) * 3) + count(*) FILTER (WHERE (tr.winner_team_id IS NULL))) AS points,
    COALESCE(sum((COALESCE((tr.scored_for)::integer, 0) - COALESCE((tr.scored_against)::integer, 0))), (0)::bigint) AS goal_diff
   FROM ((team_results tr
     JOIN player_team pt ON ((pt.team_id = tr.team_id)))
     JOIN public.profiles p ON ((p.id = pt.player_id)))
  WHERE (NOT p.is_guest)
  GROUP BY p.id, p.username, p.full_name;


grant delete on table "public"."match_predictions" to "anon";

grant insert on table "public"."match_predictions" to "anon";

grant references on table "public"."match_predictions" to "anon";

grant select on table "public"."match_predictions" to "anon";

grant trigger on table "public"."match_predictions" to "anon";

grant truncate on table "public"."match_predictions" to "anon";

grant update on table "public"."match_predictions" to "anon";

grant delete on table "public"."match_predictions" to "authenticated";

grant references on table "public"."match_predictions" to "authenticated";

grant select on table "public"."match_predictions" to "authenticated";

grant trigger on table "public"."match_predictions" to "authenticated";

grant truncate on table "public"."match_predictions" to "authenticated";

grant delete on table "public"."match_predictions" to "service_role";

grant insert on table "public"."match_predictions" to "service_role";

grant references on table "public"."match_predictions" to "service_role";

grant select on table "public"."match_predictions" to "service_role";

grant trigger on table "public"."match_predictions" to "service_role";

grant truncate on table "public"."match_predictions" to "service_role";

grant update on table "public"."match_predictions" to "service_role";


  create policy "match_predictions_delete_own"
  on "public"."match_predictions"
  as permissive
  for delete
  to public
using ((player_id = ( SELECT auth.uid() AS uid)));



  create policy "match_predictions_insert_own"
  on "public"."match_predictions"
  as permissive
  for insert
  to public
with check (((player_id = ( SELECT auth.uid() AS uid)) AND public.is_group_member(group_id, ( SELECT auth.uid() AS uid))));



  create policy "match_predictions_select_member"
  on "public"."match_predictions"
  as permissive
  for select
  to public
using (public.is_group_member(group_id, ( SELECT auth.uid() AS uid)));



  create policy "match_predictions_update_own"
  on "public"."match_predictions"
  as permissive
  for update
  to public
using ((player_id = ( SELECT auth.uid() AS uid)))
with check ((player_id = ( SELECT auth.uid() AS uid)));


CREATE TRIGGER match_predictions_delete_guard BEFORE DELETE ON public.match_predictions FOR EACH ROW EXECUTE FUNCTION public.match_predictions_delete_guard();

CREATE TRIGGER match_predictions_guard BEFORE INSERT OR UPDATE ON public.match_predictions FOR EACH ROW EXECUTE FUNCTION public.match_predictions_guard();

CREATE TRIGGER matches_grade_predictions AFTER UPDATE OF status, winner_team_id ON public.matches FOR EACH ROW EXECUTE FUNCTION public.grade_match_predictions();

-- Kolomgrants (migra neemt kolomprivileges niet mee in de diff): win_chance en
-- points worden uitsluitend serverside gezet, zie policies/match_predictions.sql.
-- De revoke is nodig omdat de default privileges anders alsnog volledige
-- insert/update geven.
revoke insert, update on public.match_predictions from authenticated;
grant insert (match_id, player_id, group_id, predicted_team_id),
      update (match_id, player_id, group_id, predicted_team_id)
  on public.match_predictions to authenticated;

alter publication supabase_realtime add table public.match_predictions;


