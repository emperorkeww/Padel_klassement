-- Voorspellersklassement (toto, #116) per groep, live berekend uit beoordeelde
-- tips. Onbeoordeelde tips (match nog open of geannuleerd) tellen niet mee.
-- Seizoensfiltering gebeurt clientside (src/lib/predictions.ts), zoals bij de
-- andere standen.
create view public.group_prediction_standings
with (security_invoker = true) as
select
  mp.group_id,
  p.id                                          as player_id,
  p.username,
  p.full_name,
  count(*) filter (where mp.points is not null) as predicted,
  count(*) filter (where mp.points > 0)         as correct,
  coalesce(sum(mp.points), 0)                   as points
from public.match_predictions mp
join public.profiles p on p.id = mp.player_id
group by mp.group_id, p.id, p.username, p.full_name;
