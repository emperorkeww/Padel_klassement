-- De Zwarte Piet (#185): rondgaand schande-token per groep (singleton-tabel),
-- gevuld door een SECURITY DEFINER-replay-trigger. Read-only voor clients.
--
-- NB: `supabase db diff` genereerde ook spurious drops/herbouw van de standen-
-- views (zónder security_invoker) en van storage-avatarpolicies, plus write-
-- grants op deze read-only tabel en géén `revoke execute`. Handmatig
-- verwijderd/toegevoegd — zie geheugen over db diff-ruis.

create table "public"."zwarte_piet" (
    "group_id" uuid not null,
    "holder_id" uuid not null,
    "from_id" uuid,
    "reden" text not null,
    "ernst" integer not null,
    "detail" text not null,
    "match_id" uuid not null,
    "since" date not null,
    "created_at" timestamp with time zone not null default now()
);

alter table "public"."zwarte_piet" enable row level security;

CREATE UNIQUE INDEX zwarte_piet_pkey ON public.zwarte_piet USING btree (group_id);

alter table "public"."zwarte_piet" add constraint "zwarte_piet_pkey" PRIMARY KEY using index "zwarte_piet_pkey";

alter table "public"."zwarte_piet" add constraint "zwarte_piet_from_id_fkey" FOREIGN KEY (from_id) REFERENCES public.profiles(id) ON DELETE SET NULL not valid;
alter table "public"."zwarte_piet" validate constraint "zwarte_piet_from_id_fkey";

alter table "public"."zwarte_piet" add constraint "zwarte_piet_group_id_fkey" FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE not valid;
alter table "public"."zwarte_piet" validate constraint "zwarte_piet_group_id_fkey";

alter table "public"."zwarte_piet" add constraint "zwarte_piet_holder_id_fkey" FOREIGN KEY (holder_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;
alter table "public"."zwarte_piet" validate constraint "zwarte_piet_holder_id_fkey";

alter table "public"."zwarte_piet" add constraint "zwarte_piet_match_id_fkey" FOREIGN KEY (match_id) REFERENCES public.matches(id) ON DELETE CASCADE not valid;
alter table "public"."zwarte_piet" validate constraint "zwarte_piet_match_id_fkey";

alter table "public"."zwarte_piet" add constraint "zwarte_piet_reden_check" CHECK ((reden = ANY (ARRAY['bagel'::text, 'afdroging'::text, 'zwarte-reeks'::text, 'choke'::text]))) not valid;
alter table "public"."zwarte_piet" validate constraint "zwarte_piet_reden_check";

set check_function_bodies = off;

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
    losers as (
      select s.match_id, s.group_id, s.player_id, s.loss_streak,
             case when s.team_id = s.team_a_id then s.score_a else s.score_b end as mij,
             case when s.team_id = s.team_a_id then s.score_b else s.score_a end as hen,
             mc.loser_chance
      from streaked s
      left join match_choke mc on mc.match_id = s.match_id
      where s.outcome = 'L'
    ),
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
    worst as (
      select distinct on (match_id)
             match_id, player_id, reden, ernst, detail
      from afgang
      order by match_id, ernst desc, player_id
    ),
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
      v_holder := null;
    end if;
  end loop;

  if v_holder is not null then
    insert into public.zwarte_piet
      (group_id, holder_id, from_id, reden, ernst, detail, match_id, since)
    values (v_group, v_holder, v_from, v_reden, v_ernst, v_detail, v_match, v_since);
  end if;
end;
$function$
;

revoke execute on function public.recompute_zwarte_piet() from public;

CREATE OR REPLACE FUNCTION public.trigger_recompute_zwarte_piet()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform public.recompute_zwarte_piet();
  return null;
end;
$function$
;

revoke execute on function public.trigger_recompute_zwarte_piet() from public;

-- Read-only voor clients: enkel select. Alleen de SECURITY DEFINER-trigger schrijft.
grant select on table "public"."zwarte_piet" to "anon";
grant select on table "public"."zwarte_piet" to "authenticated";
grant delete    on table "public"."zwarte_piet" to "service_role";
grant insert    on table "public"."zwarte_piet" to "service_role";
grant references on table "public"."zwarte_piet" to "service_role";
grant select    on table "public"."zwarte_piet" to "service_role";
grant trigger   on table "public"."zwarte_piet" to "service_role";
grant truncate  on table "public"."zwarte_piet" to "service_role";
grant update    on table "public"."zwarte_piet" to "service_role";

create policy "zwarte_piet_select_member"
  on "public"."zwarte_piet"
  as permissive
  for select
  to public
using (public.is_group_member(group_id, ( SELECT auth.uid() AS uid)));

CREATE TRIGGER matches_zwarte_piet AFTER INSERT OR DELETE OR UPDATE ON public.matches FOR EACH STATEMENT EXECUTE FUNCTION public.trigger_recompute_zwarte_piet();
