-- Vendetta's (#169): een verklaarde aartsrivaliteit tussen twee groepsgenoten.
-- De rij is alleen het contract (wie daagt wie uit, in welke groep, tot welk
-- doel, sinds wanneer); de tussenstand wordt client-side afgeleid uit de
-- onderlinge matches sinds started_at (src/features/groups/vendetta.ts), zodat
-- scorecorrecties automatisch blijven kloppen — zelfde filosofie als rivalry.ts.
create table public.vendettas (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  challenger_id uuid not null references public.profiles (id) on delete cascade,
  rival_id uuid not null references public.profiles (id) on delete cascade,
  -- Seizoensdoel: wie het eerst zoveel onderlinge overwinningen pakt, wint.
  target_wins smallint not null default 5 check (target_wins in (3, 5, 7)),
  status text not null default 'active' check (status in ('active', 'ended')),
  started_at timestamptz not null default now(),
  -- Wordt uitsluitend door de guard-trigger gezet (vendettas_guard).
  ended_at timestamptz,
  check (challenger_id <> rival_id),
  check ((status = 'active') = (ended_at is null))
);

-- Eén actieve vendetta per spelerpaar per groep, ongeacht wie de uitdager is.
create unique index vendettas_active_pair_uidx
  on public.vendettas (group_id, least(challenger_id, rival_id), greatest(challenger_id, rival_id))
  where status = 'active';

create index vendettas_group_idx on public.vendettas (group_id);

alter table public.vendettas enable row level security;
