-- Uitnodigingslinks voor groepen: één (of enkele) tokens per groep waarmee
-- nieuwe leden zichzelf kunnen toevoegen. Inwisselen loopt via de definer-
-- functie redeem_group_invite (zie functions/14_group_invites.sql).
create table public.group_invites (
  token uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create index group_invites_group_idx on public.group_invites (group_id);
