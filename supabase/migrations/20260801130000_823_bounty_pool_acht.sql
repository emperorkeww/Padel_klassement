-- Bounty-pool van 16 naar 8 (#823). Nog steeds een vaste waarde, los van de
-- zegereeks van de drager — alleen de hoogte is bijgesteld.
--
-- Waarom 8: de Elo-kern draait op K = 24 (09_ratings.sql), waardoor een
-- normale partij zo'n 10 à 14 Elo verschuift. Met een pool van 16 kostte het
-- verlies van je kop meer dan de match zelf: één nederlaag tegen een zwakkere
-- uitdager tikte harder aan dan het resultaat rechtvaardigt, en de troon werd
-- er structureel instabiel van. Een derde van K houdt de bounty voelbaar
-- zonder de uitslag te overstemmen. 8 is bovendien even, dus in een dubbel
-- delen de winnaars exact 4/4 en komt de oneven-restregel in _bounty_deltas
-- niet meer in beeld.
--
-- De bounty is een pure functie van opgeslagen data: bestaande matches houden
-- hun oude uitkering tot er een recompute_ratings() overheen gaat, en dán
-- rekent de hele historie met de nieuwe waarde. Dat is deterministisch en
-- gewenst — er blijft geen mengeling van twee pools in de boeken staan.

create or replace function public.bounty_value(p_streak int)
returns int
language sql
immutable
set search_path = ''
as $$
  select 8;
$$;
