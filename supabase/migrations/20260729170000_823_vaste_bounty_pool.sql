-- #823 Vaste bounty-pool: elke verslagen drager betaalt 16 Elo, ongeacht de
-- lengte van diens zegereeks. In een 2v2 delen de winnaars dit als 8/8; in
-- singles krijgt de enige winnaar de volledige 16.
--
-- De parameter blijft bestaan voor call-compatibiliteit met active_bounties
-- en _bounty_deltas. bounty_streak blijft eveneens bestaan: de feed gebruikt
-- die nog om een verdedigde bounty op de recentste gewonnen match te tonen.

create or replace function public.bounty_value(p_streak int)
returns int
language sql
immutable
set search_path = ''
as $$
  select 16;
$$;
