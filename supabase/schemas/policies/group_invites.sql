-- Row Level Security voor public.group_invites. Elk lid mag een uitnodiging
-- zien en aanmaken (#776); alleen de eigenaar trekt er een in. Het inwisselen
-- loopt via de SECURITY DEFINER functie redeem_group_invite en heeft dus geen
-- eigen select-policy nodig.
alter table public.group_invites enable row level security;

create policy "Lid ziet uitnodigingen"
  on public.group_invites for select
  to authenticated
  using (public.is_group_member(group_id, (select auth.uid())));

create policy "Lid maakt uitnodiging"
  on public.group_invites for insert
  to authenticated
  with check (public.is_group_member(group_id, (select auth.uid())));

-- Bewust owner-only: de eigenaar houdt de noodrem op een gedeelde link.
create policy "Eigenaar verwijdert uitnodiging"
  on public.group_invites for delete
  to authenticated
  using (public.is_group_owner(group_id, (select auth.uid())));
