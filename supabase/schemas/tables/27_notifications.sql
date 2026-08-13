-- Meldingen-inbox (#1090): elke melding die de app verstuurt, blijft hier ook
-- in de app staan. Tot nu toe bestond een melding alleen als web-push: wie geen
-- abonnement had (push nooit aangezet, iOS zonder de app op het beginscherm, of
-- ooit "weigeren" getikt) zag haar nooit, en wie ze wegveegde was ze kwijt.
--
-- Een rij is exact wat de Edge Functions al opbouwden: titel, body, deep-link
-- en tag. Ze wordt geschreven vóór de bezorging en vóór de notify_*-voorkeuren:
-- die schakelaars sturen alleen of het toestel piept, niet of de gebeurtenis
-- bestaat. Zie supabase/functions/_shared/meldingen.ts.
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- De gebeurtenis, niet het kanaal. Breder dan de vier notify_*-kolommen op
  -- profiles: polls, VAR, pias en de lef-onthulling hebben geen voorkeur maar
  -- horen wél in de inbox. De koppeling soort → voorkeurkolom staat in
  -- _shared/meldingen.ts (PUSH_VOORKEUR).
  soort text not null check (
    soort in (
      'nieuwe_ronde', 'uitslag', 'vriendschapsverzoek', 'rangwissel',
      'pias', 'poll', 'var', 'speeldag_herinnering', 'lef'
    )
  ),
  title text not null,
  body text not null,
  -- Dezelfde deep-link als de push meekrijgt, zodat "via de melding" en "via de
  -- bel" op hetzelfde scherm uitkomen (public/sw.js opent notification.data.url).
  url text not null,
  -- Gebeurtenis-id, niet soort-id (#189): vier in één klap gegenereerde rondes
  -- delen één tag en worden dus één melding, twee losse matches niet.
  tag text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  -- Weggeveegd door de ontvanger (#1273). Zacht, want "ongedaan maken" moet een
  -- gewone update zijn: terugzetten na een echte delete zou een insert-recht
  -- vragen dat er bewust niet is. prune_notifications ruimt na 90 dagen op.
  dismissed_at timestamptz
);

-- De lijst in het paneel en op /meldingen.
create index notifications_user_idx
  on public.notifications (user_id, created_at desc);

-- De teller in de balk vraagt bij elke paginaload om een count van ongelezen.
create index notifications_ongelezen_idx
  on public.notifications (user_id) where read_at is null;

-- Dezelfde tag vouwt samen zolang je de melding niet gelezen hebt — precies wat
-- renotify op het toestel doet: een tweede poll-herinnering vervangt de eerste
-- in plaats van te stapelen. Heb je haar wél gelezen, dan is een nieuwe
-- gebeurtenis met dezelfde tag een nieuwe rij, en blijft de historie staan.
-- Partieel, dus meldingen_schrijven moet het predicaat in ON CONFLICT herhalen.
create unique index notifications_open_tag_uidx
  on public.notifications (user_id, tag) where read_at is null;

alter table public.notifications enable row level security;
