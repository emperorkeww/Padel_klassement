-- Speelvoorstellen: een groepslid stelt een concreet moment voor ("donderdag
-- 20:00, 1 baan") en de rest reageert met yes/maybe/no. Initiatief-gedreven
-- tegenhanger van slot_availability (het per-slot stemraster van "Plan samen").
create table public.play_proposals (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete cascade,
  date date not null,
  start_time text not null, -- "HH:MM" in clubtijd, zoals slot_availability
  courts smallint not null default 1 check (courts between 1 and 8),
  club_name text, -- momentopname van de gekozen club bij het voorstellen
  created_at timestamptz not null default now()
);

alter table public.play_proposals enable row level security;

create table public.play_proposal_votes (
  proposal_id uuid not null references public.play_proposals (id) on delete cascade,
  group_id uuid not null references public.groups (id) on delete cascade,
  player_id uuid not null references public.profiles (id) on delete cascade,
  status text not null check (status in ('yes', 'no', 'maybe')),
  updated_at timestamptz not null default now(),
  primary key (proposal_id, player_id)
);

alter table public.play_proposal_votes enable row level security;

-- Leden zien de speelvoorstellen van hun eigen groepen.
create policy "play_proposals_select_member" on public.play_proposals
  for select
  using (public.is_group_member(group_id, (select auth.uid())));

-- Een lid doet voorstellen op eigen naam, alleen in eigen groepen.
create policy "play_proposals_insert_member" on public.play_proposals
  for insert
  with check (
    created_by = (select auth.uid())
    and public.is_group_member(group_id, (select auth.uid()))
  );

-- De indiener of de groepseigenaar trekt een voorstel in.
create policy "play_proposals_delete_own" on public.play_proposals
  for delete
  using (
    created_by = (select auth.uid())
    or public.is_group_owner(group_id, (select auth.uid()))
  );

-- Reacties: zichtbaar voor leden; je zet alleen je eigen reactie, en alleen
-- in groepen waar je lid van bent (zelfde patroon als slot_availability).
create policy "play_proposal_votes_select_member" on public.play_proposal_votes
  for select
  using (public.is_group_member(group_id, (select auth.uid())));

create policy "play_proposal_votes_insert_own" on public.play_proposal_votes
  for insert
  with check (
    player_id = (select auth.uid())
    and public.is_group_member(group_id, (select auth.uid()))
    -- group_id is gedenormaliseerd: borg dat hij echt bij het voorstel hoort.
    and exists (
      select 1 from public.play_proposals p
      where p.id = proposal_id
        and p.group_id = play_proposal_votes.group_id
    )
  );

create policy "play_proposal_votes_update_own" on public.play_proposal_votes
  for update
  using (player_id = (select auth.uid()))
  with check (player_id = (select auth.uid()));

create policy "play_proposal_votes_delete_own" on public.play_proposal_votes
  for delete
  using (player_id = (select auth.uid()));

-- Realtime: reacties en voorstellen live in de groepsweergave.
alter publication supabase_realtime add table public.play_proposals;
alter publication supabase_realtime add table public.play_proposal_votes;
