-- Aanwezigheid per speelavond: wie speelt er mee op een gegeven datum?
create table public.attendance (
  group_id uuid not null references public.groups (id) on delete cascade,
  player_id uuid not null references public.profiles (id) on delete cascade,
  date date not null,
  status text not null check (status in ('yes', 'no', 'maybe')),
  updated_at timestamptz not null default now(),
  primary key (group_id, date, player_id)
);

alter table public.attendance enable row level security;
