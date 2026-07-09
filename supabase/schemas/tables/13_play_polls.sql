-- Speeldag-polls (doodle met banen als dependency): een lid stelt 1-5
-- kandidaat-momenten voor, de groep stemt per optie, de maker/eigenaar legt
-- het winnende moment vast (locked) en markeert na het reserveren op
-- Playtomic "geboekt". Banen-behoefte = ceil(ja-stemmers / 4); de client
-- bewaakt live of er nog genoeg banen vrij zijn.
create table public.play_polls (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'open'
    check (status in ('open', 'locked', 'booked', 'cancelled')),
  -- Gezet zodra de maker/eigenaar een optie kiest (fk volgt na de options-tabel).
  locked_option_id uuid,
  created_at timestamptz not null default now()
);

-- Eén open poll per groep: focus houden, stemmen niet versnipperen.
create unique index play_polls_one_open
  on public.play_polls (group_id)
  where status = 'open';

alter table public.play_polls enable row level security;

-- Kandidaat-momenten van een poll; group_id gedenormaliseerd zodat RLS en de
-- realtime-filter hetzelfde eenvoudige patroon volgen als slot_availability.
create table public.play_poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.play_polls (id) on delete cascade,
  group_id uuid not null references public.groups (id) on delete cascade,
  date date not null,
  start_time text not null, -- "HH:MM" in clubtijd, zoals de baanbeschikbaarheid
  duration smallint not null default 90 check (duration in (60, 90, 120)),
  -- Vrije banen op het moment van aanmaken; null = beschikbaarheid onbekend
  -- (club zonder data of buiten het 7-daagse venster).
  courts_free smallint,
  created_at timestamptz not null default now(),
  unique (poll_id, date, start_time)
);

alter table public.play_poll_options enable row level security;

alter table public.play_polls
  add constraint play_polls_locked_option_fk
  foreign key (locked_option_id) references public.play_poll_options (id)
  on delete set null;

-- Stemmen per optie (doodle-stijl).
create table public.play_poll_votes (
  option_id uuid not null references public.play_poll_options (id) on delete cascade,
  group_id uuid not null references public.groups (id) on delete cascade,
  player_id uuid not null references public.profiles (id) on delete cascade,
  status text not null check (status in ('yes', 'no', 'maybe')),
  updated_at timestamptz not null default now(),
  primary key (option_id, player_id)
);

alter table public.play_poll_votes enable row level security;
