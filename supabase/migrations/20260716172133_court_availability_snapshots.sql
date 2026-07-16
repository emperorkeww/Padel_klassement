-- Periodieke momentopnames van de Playtomic-baanbeschikbaarheid (#405).
-- De cron-edgefunctie snapshot-availability schrijft hier per (club, dag) de
-- rauwe availability-respons; de client leest primair hieruit zodat het
-- bezoekersverkeer losgekoppeld is van Playtomic en /banen korte uitval
-- overleeft.
--
-- Handmatig teruggesnoeid uit `db diff`: de view-recreates en de drops van
-- storage-policies waren diff-ruis. Grants komen uit de default privileges
-- (zelfde aanpak als match_reminders); RLS zonder write-policies houdt
-- schrijven exclusief bij de service-role.
create table public.court_availability_snapshots (
  tenant_id uuid not null,
  date date not null,
  payload jsonb not null,
  fetched_at timestamptz not null default now(),
  primary key (tenant_id, date)
);

alter table public.court_availability_snapshots enable row level security;

create policy "Beschikbaarheids-snapshots zijn publiek leesbaar"
  on public.court_availability_snapshots
  for select
  using (true);
