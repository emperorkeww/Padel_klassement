-- Slot-beschikbaarheid: wie van de groep kan op welk tijdslot (datum + uur in
-- clubtijd)? Fijnere tegenhanger van public.attendance (dat per dag werkt), voor
-- het "Plan samen"-raster dat de stemmen combineert met de vrije banen.
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

-- Leden zien de beschikbaarheid van hun eigen groepen.
create policy "slot_availability_select_member" on public.slot_availability
  for select
  using (public.is_group_member(group_id, (select auth.uid())));

-- Je zet alleen je eigen status, en alleen in groepen waar je lid van bent.
create policy "slot_availability_insert_own" on public.slot_availability
  for insert
  with check (
    player_id = (select auth.uid())
    and public.is_group_member(group_id, (select auth.uid()))
  );

create policy "slot_availability_update_own" on public.slot_availability
  for update
  using (player_id = (select auth.uid()))
  with check (player_id = (select auth.uid()));

create policy "slot_availability_delete_own" on public.slot_availability
  for delete
  using (player_id = (select auth.uid()));

-- Live bijwerken in het planningsraster (RLS geldt ook op de realtime-stroom).
alter publication supabase_realtime add table public.slot_availability;
