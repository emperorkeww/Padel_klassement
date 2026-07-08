-- Slot-beschikbaarheid: wie van de groep kan op welk tijdslot (datum + uur in
-- clubtijd)? Fijnere tegenhanger van public.attendance, voor het "Plan samen"-
-- raster dat de stemmen combineert met de vrije banen.
create table public.slot_availability (
  group_id uuid not null references public.groups (id) on delete cascade,
  player_id uuid not null references public.profiles (id) on delete cascade,
  date date not null,
  start_time text not null, -- "HH:MM" in clubtijd, zoals de baanbeschikbaarheid
  status text not null check (status in ('yes', 'no', 'maybe')),
  updated_at timestamptz not null default now(),
  primary key (group_id, player_id, date, start_time)
);

alter table public.slot_availability enable row level security;
