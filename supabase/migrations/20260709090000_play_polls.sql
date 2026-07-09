-- Speeldag-polls vervangen de losse speelvoorstellen (die haalden productie
-- nooit): een doodle met 1-5 kandidaat-momenten, stemmen per optie en banen
-- als harde dependency. Zie schemas/tables/13_play_polls.sql voor de bron.

-- De voorstel-tabellen zijn nergens in productie uitgerold; opruimen kan hard.
drop table if exists public.play_proposal_votes;
drop table if exists public.play_proposals;

create table public.play_polls (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'open'
    check (status in ('open', 'locked', 'booked', 'cancelled')),
  locked_option_id uuid,
  created_at timestamptz not null default now()
);

create unique index play_polls_one_open
  on public.play_polls (group_id)
  where status = 'open';

alter table public.play_polls enable row level security;

create table public.play_poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.play_polls (id) on delete cascade,
  group_id uuid not null references public.groups (id) on delete cascade,
  date date not null,
  start_time text not null,
  duration smallint not null default 90 check (duration in (60, 90, 120)),
  courts_free smallint,
  created_at timestamptz not null default now(),
  unique (poll_id, date, start_time)
);

alter table public.play_poll_options enable row level security;

alter table public.play_polls
  add constraint play_polls_locked_option_fk
  foreign key (locked_option_id) references public.play_poll_options (id)
  on delete set null;

create table public.play_poll_votes (
  option_id uuid not null references public.play_poll_options (id) on delete cascade,
  group_id uuid not null references public.groups (id) on delete cascade,
  player_id uuid not null references public.profiles (id) on delete cascade,
  status text not null check (status in ('yes', 'no', 'maybe')),
  updated_at timestamptz not null default now(),
  primary key (option_id, player_id)
);

alter table public.play_poll_votes enable row level security;

-- RLS-policies (zie schemas/policies/play_polls.sql).
create policy "play_polls_select_member" on public.play_polls
  for select
  using (public.is_group_member(group_id, (select auth.uid())));

create policy "play_polls_insert_member" on public.play_polls
  for insert
  with check (
    created_by = (select auth.uid())
    and public.is_group_member(group_id, (select auth.uid()))
  );

create policy "play_polls_update_manager" on public.play_polls
  for update
  using (
    created_by = (select auth.uid())
    or public.is_group_owner(group_id, (select auth.uid()))
  )
  with check (
    created_by = (select auth.uid())
    or public.is_group_owner(group_id, (select auth.uid()))
  );

create policy "play_polls_delete_manager" on public.play_polls
  for delete
  using (
    created_by = (select auth.uid())
    or public.is_group_owner(group_id, (select auth.uid()))
  );

create policy "play_poll_options_select_member" on public.play_poll_options
  for select
  using (public.is_group_member(group_id, (select auth.uid())));

create policy "play_poll_options_insert_manager" on public.play_poll_options
  for insert
  with check (
    public.is_group_member(group_id, (select auth.uid()))
    and exists (
      select 1 from public.play_polls p
      where p.id = poll_id
        and p.group_id = play_poll_options.group_id
        and (
          p.created_by = (select auth.uid())
          or public.is_group_owner(p.group_id, (select auth.uid()))
        )
    )
  );

create policy "play_poll_options_delete_manager" on public.play_poll_options
  for delete
  using (
    exists (
      select 1 from public.play_polls p
      where p.id = poll_id
        and (
          p.created_by = (select auth.uid())
          or public.is_group_owner(p.group_id, (select auth.uid()))
        )
    )
  );

create policy "play_poll_votes_select_member" on public.play_poll_votes
  for select
  using (public.is_group_member(group_id, (select auth.uid())));

create policy "play_poll_votes_insert_own" on public.play_poll_votes
  for insert
  with check (
    player_id = (select auth.uid())
    and public.is_group_member(group_id, (select auth.uid()))
    and exists (
      select 1 from public.play_poll_options o
      where o.id = option_id
        and o.group_id = play_poll_votes.group_id
    )
  );

create policy "play_poll_votes_update_own" on public.play_poll_votes
  for update
  using (player_id = (select auth.uid()))
  with check (player_id = (select auth.uid()));

create policy "play_poll_votes_delete_own" on public.play_poll_votes
  for delete
  using (player_id = (select auth.uid()));

-- Realtime: polls, opties en stemmen live in de groepsweergave.
alter publication supabase_realtime add table public.play_polls;
alter publication supabase_realtime add table public.play_poll_options;
alter publication supabase_realtime add table public.play_poll_votes;
