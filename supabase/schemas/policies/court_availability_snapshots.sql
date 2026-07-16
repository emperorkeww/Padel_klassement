-- Iedereen mag de beschikbaarheids-snapshots lezen: het is publieke
-- Playtomic-data. Er zijn bewust géén write-policies — alleen de
-- service-role (cron-edgefunctie snapshot-availability) schrijft.
create policy "Beschikbaarheids-snapshots zijn publiek leesbaar"
  on public.court_availability_snapshots
  for select
  using (true);
