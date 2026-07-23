-- Diagnose voor #607: waarom is public.zwarte_piet leeg in productie?
--
-- Uitvoeren in de Supabase SQL-editor (dashboard), sectie voor sectie
-- (selecteer de sectie en "Run selection") — alles is read-only; de dry-run
-- in sectie 2 wordt met rollback teruggedraaid.
--
-- Interpretatie:
--   • Sectie 2 geeft rijen terwijl sectie 1 leeg is  → de trigger draait niet
--     (drift) of iets wist rijen buiten de recompute om → Fix A (repair-
--     migratie + eenmalige recompute).
--   • Sectie 2 is ook leeg → sectie 3/4 laten zien waarom: dode criteria
--     (scores/ratings-anomalie → Fix B) of een legitiem verloste eindstand
--     per groep (→ alleen de UX-fix uit #607).

------------------------------------------------------------------------
-- 1. Huidige stand + trigger-check.
------------------------------------------------------------------------
select * from public.zwarte_piet;

select tgname, tgenabled  -- verwacht: matches_zwarte_piet met tgenabled 'O'
from pg_trigger
where tgrelid = 'public.matches'::regclass and not tgisinternal
order by tgname;

------------------------------------------------------------------------
-- 2. Dry-run: wat zou de recompute NU opleveren? (rollback = geen wijziging)
--    Selecteer deze drie statements samen en run ze in één keer.
------------------------------------------------------------------------
begin;
select public.recompute_zwarte_piet();
select * from public.zwarte_piet;
rollback;

------------------------------------------------------------------------
-- 3. Sanity-tellingen: is de invoer van de recompute gezond?
------------------------------------------------------------------------
select
  count(*)                                                   as completed,
  count(*) filter (where winner_team_id is not null)         as met_winnaar,
  count(*) filter (where score_a is not null
                     and score_b is not null)                as met_scores,
  count(*) filter (where winner_team_id is not null
                     and (score_a is null or score_b is null)) as winnaar_zonder_scores,
  count(*) filter (where exists (select 1 from public.rating_history rh
                                 where rh.match_id = m.id))  as met_rating_history
from public.matches m
where m.status = 'completed' and m.group_id is not null;

------------------------------------------------------------------------
-- 4. Eventlog per groep: de replay van recompute_zwarte_piet als SELECT.
--    Per beslissende match chronologisch: wie flopte (en waarom) en wie
--    wonnen. De state machine is met de hand na te lopen:
--      flopper ≠ huidige drager → drager wisselt naar de flopper;
--      geen flopper en de drager staat bij de winnaars → Piet vrij.
--    CTE's identiek aan supabase/schemas/functions/21_zwarte_piet.sql.
------------------------------------------------------------------------
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
    where player2_id is not null
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
             ((coalesce(rw1.rating_before, 1000)
               + case when wt.player2_id is null then coalesce(rw1.rating_before, 1000)
                      else coalesce(rw2.rating_before, 1000) end) / 2.0
              - (coalesce(rl1.rating_before, 1000)
                 + case when lt.player2_id is null then coalesce(rl1.rating_before, 1000)
                        else coalesce(rl2.rating_before, 1000) end) / 2.0)
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
  select l.match_id, l.player_id, l.mij, l.hen, l.loss_streak, l.loser_chance,
         k.reden, k.ernst
  from losers l
  cross join lateral (
    select c.reden, c.ernst
    from (values
      ('bagel'::text,
       case when l.mij = 0 and l.hen > 0 then 110 end),
      ('afdroging',
       case when (l.hen - l.mij) >= 4 then 50 + (l.hen - l.mij) end),
      ('zwarte-reeks',
       case when l.loss_streak >= 3 then 40 + l.loss_streak end),
      ('choke',
       case when l.loser_chance >= 0.6 then 30 + round(l.loser_chance * 10)::int end)
    ) as c(reden, ernst)
    where c.ernst is not null
    order by c.ernst desc
    limit 1
  ) k
),
worst as (
  select distinct on (match_id) match_id, player_id, reden, ernst
  from afgang
  order by match_id, ernst desc, player_id
)
select
  c.group_id,
  c.ts,
  c.match_id,
  c.score_a || '-' || c.score_b                        as score,
  w.player_id                                          as flopper,
  w.reden,
  w.ernst,
  wt.player1_id                                        as win_p1,
  wt.player2_id                                        as win_p2,
  case when w.player_id is not null then '→ flopper pakt/houdt de Piet'
       else '(verlossing als de drager bij de winnaars staat)'
  end                                                  as effect
from completed c
join public.teams wt on wt.id = c.winner_team_id
left join worst w on w.match_id = c.match_id
where c.winner_team_id is not null
order by c.group_id, c.ts, c.match_id;
