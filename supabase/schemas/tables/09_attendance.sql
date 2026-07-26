-- Aanwezigheid per speelavond: wie speelt er mee op een gegeven datum?
create table public.attendance (
  group_id uuid not null references public.groups (id) on delete cascade,
  player_id uuid not null references public.profiles (id) on delete cascade,
  date date not null,
  status text not null check (status in ('yes', 'no', 'maybe')),
  updated_at timestamptz not null default now(),
  primary key (group_id, date, player_id)
);

-- player_id staat achteraan in de PK, dus een lookup op alleen die kolom kan er
-- niet op (#756). claim_guest() hangt aanwezigheid per speler om, en de
-- FK-cascade vanaf profiles loopt langs hetzelfde pad.
create index attendance_player_idx on public.attendance (player_id);

alter table public.attendance enable row level security;
