-- Periodieke momentopnames van de Playtomic-baanbeschikbaarheid (#405).
-- De cron-edgefunctie snapshot-availability schrijft hier per (club, dag) de
-- rauwe availability-respons; de client leest primair hieruit zodat het
-- bezoekersverkeer losgekoppeld is van Playtomic en /banen korte uitval
-- overleeft. Schrijven kan alleen met de service-role (RLS zonder
-- write-policies); lezen is publiek (zie policies/court_availability_snapshots.sql).
create table public.court_availability_snapshots (
  tenant_id uuid not null,
  date date not null,
  -- Rauwe RawAvailability[] zoals Playtomic ze levert; de client hergebruikt
  -- dezelfde transformatie als voor een live respons.
  payload jsonb not null,
  fetched_at timestamptz not null default now(),
  primary key (tenant_id, date)
);

alter table public.court_availability_snapshots enable row level security;
