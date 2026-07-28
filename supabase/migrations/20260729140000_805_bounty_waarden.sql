-- #805 Bounty-waarden bijgesteld: de pool start op 2 in plaats van 15 en groeit
-- met 5 per opeenvolgende zege, tot het plafond van 30 na zes zeges —
-- 2 · 7 · 12 · 17 · 22 · 27 · 30. De laatste sprong is +3, want daar knipt het
-- plafond.
--
-- Een verse bounty is daarmee een schrammetje in plaats van een halve match:
-- het jagen begint pas te lonen als de leider écht ongeslagen doorstoomt, en
-- een leider die af en toe verliest betaalt nauwelijks meer dan de gewone Elo.
--
-- Alleen de formule verandert. Dragerschap, verdeling en de invoeringsdatum
-- blijven zoals in 20260729100000_805_bounty.sql; zie
-- supabase/schemas/functions/31_bounty.sql voor de volledige motivatie.
--
-- Bewust géén recompute_ratings(): al uitgekeerde bounty's blijven staan zoals
-- ze destijds op de kaart aangekondigd zijn. Let op de keerzijde van afgeleide
-- data: een latere recompute (na een correctie of een verwijderde match) rekent
-- de hele historie wél met deze formule opnieuw uit.

create or replace function public.bounty_value(p_streak int)
returns int
language sql
immutable
set search_path = ''
as $$
  select least(2 + 5 * greatest(coalesce(p_streak, 0), 0), 30);
$$;
