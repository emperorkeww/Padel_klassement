-- Row Level Security voor public.group_invites. Alleen de eigenaar beheert de
-- uitnodigingen van zijn groep; het inwisselen loopt via de SECURITY DEFINER
-- functie redeem_group_invite en heeft dus geen extra select-policy nodig.
alter table public.group_invites enable row level security;

create policy "Eigenaar ziet uitnodigingen"
  on public.group_invites for select
  to authenticated
  using (public.is_group_owner(group_id, (select auth.uid())));

create policy "Eigenaar maakt uitnodiging"
  on public.group_invites for insert
  to authenticated
  with check (public.is_group_owner(group_id, (select auth.uid())));

create policy "Eigenaar verwijdert uitnodiging"
  on public.group_invites for delete
  to authenticated
  using (public.is_group_owner(group_id, (select auth.uid())));
