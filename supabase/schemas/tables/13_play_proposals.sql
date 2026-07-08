-- Speelvoorstellen: een groepslid stelt een concreet moment voor ("donderdag
-- 20:00, 1 baan") en de rest reageert. Initiatief-gedreven tegenhanger van
-- public.slot_availability (het per-slot stemraster van "Plan samen").
create table public.play_proposals (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete cascade,
  date date not null,
  start_time text not null, -- "HH:MM" in clubtijd, zoals slot_availability
  courts smallint not null default 1 check (courts between 1 and 8),
  club_name text, -- momentopname van de gekozen club bij het voorstellen
  created_at timestamptz not null default now()
);

alter table public.play_proposals enable row level security;

-- Reacties op een voorstel; group_id gedenormaliseerd zodat RLS en de
-- realtime-filter hetzelfde eenvoudige patroon volgen als slot_availability.
create table public.play_proposal_votes (
  proposal_id uuid not null references public.play_proposals (id) on delete cascade,
  group_id uuid not null references public.groups (id) on delete cascade,
  player_id uuid not null references public.profiles (id) on delete cascade,
  status text not null check (status in ('yes', 'no', 'maybe')),
  updated_at timestamptz not null default now(),
  primary key (proposal_id, player_id)
);

alter table public.play_proposal_votes enable row level security;
