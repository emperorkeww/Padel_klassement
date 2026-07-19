-- Promotie/degradatie in Coach Rudy's stem (#302). Er bestond nog geen server-
-- side rank-detectie: rangverschuivingen worden nu client-side gereconstrueerd
-- (rankShift.ts). Voor een push hebben we een deterministische, server-side bron
-- nodig die na elke afgeronde match de rang/tier per groepslid bijhoudt en enkel
-- bij een échte tier-overgang de push-webhook laat afgaan.
--
-- Rangbasis = globale Elo-rating onder de groepsleden, exact zoals het
-- groepsklassement dat de gebruiker ziet (#52: rating leidend, niet punten).
-- De tier-grenzen spiegelen positieTier() uit src/features/coach/klassementFeiten.ts
-- (troon = #1, jager = top-3, kelder = onderste kwart/laatste, nieuw < 3 matches).
--
-- Afgeleide, read-only data: enkel de SECURITY DEFINER-trigger schrijft. De
-- push-webhook zelf (trigger op deze tabel → send-push) staat in
-- ../snippets/push_webhooks.sql, net als de pias-/poll-webhooks: notify_send_push
-- bestaat alleen op het gehoste project, niet in de migraties.

-- Notificatie-voorkeur (#57): promotie én degradatie samen aan/uit. Standaard
-- 'true', zodat bestaande gebruikers de meldingen krijgen.
alter table public.profiles
  add column if not exists notify_rank_change boolean not null default true;

create table if not exists public.player_rank_state (
  group_id uuid not null references public.groups (id) on delete cascade,
  player_id uuid not null references public.profiles (id) on delete cascade,
  rank smallint not null,
  tier text not null check (tier in ('troon', 'jager', 'middenmoot', 'kelder', 'nieuw')),
  updated_at timestamptz not null default now(),
  primary key (group_id, player_id)
);

alter table public.player_rank_state enable row level security;

-- Intern-only: clients lezen deze tabel niet (de push-webhook krijgt record +
-- old_record mee, en send-push draait als service_role). RLS aan zonder select-
-- policy = expliciet dicht voor anon/authenticated.
revoke all on table public.player_rank_state from anon, authenticated;

set check_function_bodies = off;

-- Herberekent rang/tier per groepslid en schrijft alleen de rijen weg die écht
-- wijzigen (rang óf tier). Zo vuurt de row-webhook-trigger enkel bij een echte
-- verandering; de WHEN-clause daar filtert vervolgens op een betekenisvolle
-- tier-overgang. Eerste run na deploy vult de baseline via INSERTs (geen
-- webhook, die staat op UPDATE) — dus geen meldingsstorm.
create or replace function public.recompute_rank_state()
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  insert into public.player_rank_state as prs (group_id, player_id, rank, tier)
  with member_rating as (
    select gm.group_id,
           gm.player_id,
           pr.rating,
           coalesce(pr.games, 0) as games,
           p.username
    from public.group_members gm
    join public.player_ratings pr on pr.player_id = gm.player_id
    join public.profiles p on p.id = gm.player_id
    -- Gasten tellen nergens mee (#468); leden zonder rating staan nog niet op
    -- de ladder en krijgen dus geen rang.
    where not p.is_guest and pr.rating is not null
  ),
  ranked as (
    select group_id,
           player_id,
           games,
           row_number() over (
             partition by group_id
             -- Zelfde volgorde als het groepsklassement (#52): rating aflopend,
             -- dan meer matches eerst, dan naam.
             order by rating desc, games desc, username asc
           ) as rank,
           count(*) over (partition by group_id) as totaal
    from member_rating
  )
  select group_id,
         player_id,
         rank::smallint,
         case
           when games < 3 then 'nieuw'
           when rank = 1 then 'troon'
           when rank = totaal or (totaal >= 4 and rank > ceil(0.75 * totaal))
             then 'kelder'
           when rank <= 3 then 'jager'
           else 'middenmoot'
         end as tier
  from ranked
  on conflict (group_id, player_id) do update
    set rank = excluded.rank,
        tier = excluded.tier,
        updated_at = now()
    where prs.rank is distinct from excluded.rank
       or prs.tier is distinct from excluded.tier;
end;
$function$
;

revoke execute on function public.recompute_rank_state() from public;

create or replace function public.trigger_recompute_rank_state()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  perform public.recompute_rank_state();
  return null;
end;
$function$
;

revoke execute on function public.trigger_recompute_rank_state() from public;

-- Statement-trigger op matches, ná de Elo-berekening: de naam sorteert na
-- 'matches_ratings_*' (a < e), zodat player_ratings al bijgewerkt is wanneer we
-- de rangen herberekenen.
drop trigger if exists matches_refresh_rank_state on public.matches;
create trigger matches_refresh_rank_state
  after insert or delete or update on public.matches
  for each statement execute function public.trigger_recompute_rank_state();
