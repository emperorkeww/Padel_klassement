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
  -- Dedup voor de cron-meldingen (edge function poll-deadline):
  -- laatste-kans-push bij een naderende deadline, en de speeldag-herinnering.
  deadline_notified_at timestamptz,
  dayof_notified_at timestamptz,
  -- Momenten van vastleggen/boeken (feed v2, #143); reopen wist ze weer.
  locked_at timestamptz,
  booked_at timestamptz,
  -- Locatie-snapshot (#322): de club/baan wordt bij aanmaak vastgelegd op de
  -- poll zelf, niet afgeleid uit de globale clubkeuze (localStorage), zodat een
  -- latere clubwissel bestaande polls niet meer "verhuist". Gedenormaliseerd:
  -- clubs zijn Playtomic-tenants, geen eigen tabel. Wijzigbaar zolang de poll
  -- niet geboekt is; club_timezone voedt ook de clubtijd-berekeningen.
  -- Defaults = thuisclub, zodat een insert zónder locatie (oudere client vóór de
  -- frontend-deploy) niet breekt op de NOT NULL; de nieuwe client zet 'm expliciet.
  club_id text not null default '91d8d419-3736-498e-90be-362de786d588',
  club_name text not null default 'LAGO CLUB Padel Beveren',
  club_city text default 'Beveren',
  club_timezone text not null default 'Europe/Brussels',
  -- Toegangscode van de velden (#675): optioneel, want niet elke club heeft er
  -- een. Vrije tekst i.p.v. cijfers — clubs gebruiken ook letters, of een code
  -- per baan ("b3: 1234 · b4: 5678"); één veld houdt het model simpel. Mag ook
  -- ná het boeken nog gezet worden (de code komt vaak pas met de
  -- bevestigingsmail); play_polls_update_manager heeft geen statusfilter, dus
  -- dat kan zonder policy-wijziging. Alleen groepsleden zien 'm
  -- (play_polls_select_member) — een clubcode hoort niet op een publieke pagina.
  access_code text check (access_code is null or length(access_code) <= 60),
  -- Welke baan/banen geboekt zijn (#802): tot nu toe stond alleen "geboekt ✓"
  -- in de app en moest je in de groepschat zoeken op welk veld je moest zijn.
  -- Vrije tekst zoals access_code — een boeking is soms één baan ("Baan 3"),
  -- soms een reeks ("3 & 4") of een naam ("Center Court"), en de club bepaalt
  -- de notatie. Mag ook ná het boeken nog gezet worden, en volgt dezelfde
  -- policies: alleen groepsleden lezen 'm, maker/eigenaar schrijft.
  courts text check (courts is null or length(courts) <= 60),
  created_at timestamptz not null default now()
);

-- Meerdere open polls per groep mogen naast elkaar bestaan (#267): een groep
-- kan in dezelfde week meerdere speeldagen tegelijk plannen. Wel een index op
-- group_id voor de per-groep queries en de realtime-filter.
create index play_polls_group on public.play_polls (group_id);

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

-- "Alle stemmen van deze speler" kan niet op de PK (option_id staat vooraan),
-- terwijl claim_guest() precies dat doet bij het omhangen van een gast (#756).
create index play_poll_votes_player_idx on public.play_poll_votes (player_id);

alter table public.play_poll_votes enable row level security;
