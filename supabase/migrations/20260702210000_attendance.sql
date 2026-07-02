-- Aanwezigheid per speelavond: wie speelt er mee op een gegeven datum?
-- Eén rij per (groep, datum, speler); iedereen beheert alleen zijn eigen rij.

create table public.attendance (
  group_id uuid not null references public.groups (id) on delete cascade,
  player_id uuid not null references public.profiles (id) on delete cascade,
  date date not null,
  status text not null check (status in ('yes', 'no', 'maybe')),
  updated_at timestamptz not null default now(),
  primary key (group_id, date, player_id)
);

alter table public.attendance enable row level security;

-- Leden zien de aanwezigheid van hun eigen groepen.
create policy "attendance_select_member" on public.attendance
  for select
  using (public.is_group_member(group_id, (select auth.uid())));

-- Je zet alleen je eigen status, en alleen in groepen waar je lid van bent.
create policy "attendance_insert_own" on public.attendance
  for insert
  with check (
    player_id = (select auth.uid())
    and public.is_group_member(group_id, (select auth.uid()))
  );

create policy "attendance_update_own" on public.attendance
  for update
  using (player_id = (select auth.uid()))
  with check (player_id = (select auth.uid()));

create policy "attendance_delete_own" on public.attendance
  for delete
  using (player_id = (select auth.uid()));

-- Live bijwerken in de groepsweergave (RLS geldt ook op de realtime-stroom).
alter publication supabase_realtime add table public.attendance;
