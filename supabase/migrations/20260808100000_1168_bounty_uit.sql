-- #1168 Bounty uitzetten — effect terugdraaien en uit de UI halen. Spiegel van
-- supabase/schemas/functions/31_bounty.sql en supabase/schemas/views/
-- active_bounties.sql; zie die bestanden voor de volledige motivatie.
--
-- Kern: de bounty (#805, pool van 8 sinds #823) legde een prijs op het hoofd van
-- de dictator en de Big Daddy. Die gaat uit — niet alleen van nu af aan, maar
-- ook met terugwerkende kracht. Dat kán omdat de bounty nergens als muteerbare
-- state bestaat: _bounty_deltas is een pure functie van opgeslagen data, dus
-- één recompute_ratings() met pool 0 haalt de verschuiving uit élke historische
-- rij. Precies het mechanisme dat 20260801130000_823_bounty_pool_acht.sql al
-- beschreef, nu met 0 in plaats van 8.
--
-- De logica blijft bewust staan en levert alleen nul op. Weer aanzetten is de
-- waarde herstellen plus dezelfde replay als hieronder.
--
-- Met de hand geschreven en niet via `supabase db diff`: dat commando draait op
-- develop niet meer door bestaande schema-drift (zie de kop van
-- 20260805120000_1036_adminpaneel.sql). Deze migratie vervangt twee bestaande
-- objecten en draait daarna een herberekening; ze is één-op-één na te lezen
-- naast de schemabestanden.

-- 1. De kraan dicht ----------------------------------------------------------
--
-- Het enige punt waar de hoogte van de pool vandaan komt. Alles erboven en
-- eronder (de uitkering in _bounty_deltas, de aankondiging in active_bounties,
-- de spiegel in de client) volgt hieruit.
create or replace function public.bounty_value(p_streak int)
returns int
language sql
immutable
set search_path = ''
as $$
  select 0;
$$;

-- 2. Geen dragers meer aankondigen -------------------------------------------
--
-- Eén where erbij: zolang de pool 0 is levert de view geen rijen op. Daarmee
-- valt de hele UI in één keer stil — het klassement, de groepsstand, de banner
-- op de geplande matchkaart en de feed lezen allemaal hiervandaan. De kolommen
-- en hun types blijven identiek, dus `create or replace` behoudt de grant en de
-- gegenereerde types hoeven niet opnieuw.
create or replace view public.active_bounties
with (security_invoker = true) as
with gekwalificeerd as (
  select r.player_id, r.rating, p.created_at
  from public.player_ratings r
  join public.profiles p on p.id = r.player_id
  where not p.is_guest and r.games >= 3
),
dragers as (
  select g.player_id, null::uuid as group_id, 'dictator' as reden
  from gekwalificeerd g
  where g.rating >= 1600
  union all
  select * from (
    select distinct on (gm.group_id)
           gm.player_id, gm.group_id, 'bigdaddy' as reden
    from public.group_members gm
    join gekwalificeerd g on g.player_id = gm.player_id
    order by gm.group_id, g.rating desc, g.created_at asc, g.player_id asc
  ) bd
)
select
  d.player_id,
  d.group_id,
  d.reden,
  s.streak,
  public.bounty_value(s.streak) as pool
from dragers d
cross join lateral (select public.bounty_streak(d.player_id) as streak) s
where public.bounty_value(s.streak) > 0;

-- 3. Push-webhooks even stil zetten ------------------------------------------
--
-- De replay hieronder verschuift ratings, en daarmee mogelijk rangen en de pias
-- van de huidige week. Twee webhook-triggers zouden daarop afgaan en de hele
-- club een melding sturen over een administratieve herberekening:
-- push_on_rank_change op player_rank_state en push_on_pias_insert/update op
-- pias_of_week. Ze staan alleen op het gehoste project (zie
-- supabase/snippets/push_webhooks.sql), niet in de migraties — vandaar de check
-- op pg_trigger; lokaal is dit blok een no-op.
--
-- De hele migratie draait in één transactie, dus als er hieronder iets misgaat
-- rolt ook het uitzetten terug: de triggers kunnen niet per ongeluk uit blijven
-- staan.
do $$
declare
  t record;
begin
  for t in
    select c.relname as tabel, tg.tgname as naam
    from pg_trigger tg
    join pg_class c on c.oid = tg.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and not tg.tgisinternal
      and tg.tgname in ('push_on_rank_change', 'push_on_pias_insert',
                        'push_on_pias_update')
  loop
    execute format('alter table public.%I disable trigger %I', t.tabel, t.naam);
  end loop;
end;
$$;

-- 4. De historie opnieuw rekenen ---------------------------------------------
--
-- recompute_ratings() gooit rating_history en player_ratings weg en speelt alle
-- afgeronde matches chronologisch opnieuw af. Met pool 0 levert _bounty_deltas
-- nog hooguit 0-rijen voor de dragers op en valt de uitkering aan de winnaars
-- weg, dus bounty_delta wordt overal 0.
--
-- De afgeleide replays moeten hier expliciet bij: recompute_ratings() raakt
-- public.matches niet en vuurt de statement-triggers op die tabel dus niet af.
-- De volgorde spiegelt de (bewust alfabetische) triggernamen daar, zodat pias,
-- rangen, troontermijnen en Zwarte Piet dezelfde ratings zien als bij een
-- gewone matchwijziging. Zonder deze vier regels blijven ze achter op ratings
-- die niet meer bestaan.
select public.recompute_ratings();
select public.recompute_pias();
select public.recompute_rank_state();
select public.recompute_dictator_termijnen();
select public.recompute_zwarte_piet();

-- 5. Webhooks weer aan -------------------------------------------------------
do $$
declare
  t record;
begin
  for t in
    select c.relname as tabel, tg.tgname as naam
    from pg_trigger tg
    join pg_class c on c.oid = tg.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and not tg.tgisinternal
      and tg.tgname in ('push_on_rank_change', 'push_on_pias_insert',
                        'push_on_pias_update')
  loop
    execute format('alter table public.%I enable trigger %I', t.tabel, t.naam);
  end loop;
end;
$$;
