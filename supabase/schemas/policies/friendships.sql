-- Row Level Security voor public.friendships
alter table public.friendships enable row level security;

create policy "Eigen vriendschappen zijn leesbaar"
  on public.friendships for select
  to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));

-- Alleen een 'pending'-verzoek dat je zelf als verzoeker stuurt.
create policy "Verzoek sturen als verzoeker"
  on public.friendships for insert
  to authenticated
  with check (
    (select auth.uid()) = requester_id
    and status = 'pending'
  );

-- De ontvanger mag enkel accepteren/weigeren (de deelnemers blijven vast).
create policy "Ontvanger kan verzoek beantwoorden"
  on public.friendships for update
  to authenticated
  using ((select auth.uid()) = addressee_id)
  with check (
    (select auth.uid()) = addressee_id
    and status in ('accepted', 'declined')
  );

create policy "Betrokkene kan vriendschap verwijderen"
  on public.friendships for delete
  to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));
-- Feed (#138): geaccepteerde vriendschappen ook leesbaar voor groepsgenoten —
-- alleen wanneer beide betrokkenen samen met de kijker in één groep zitten.
-- Verzoeken (pending/declined) blijven strikt privé.
create policy "friendships_select_groupmates" on public.friendships
  for select
  to authenticated
  using (
    status = 'accepted'
    and exists (
      select 1
      from public.group_members me
      join public.group_members a
        on a.group_id = me.group_id and a.player_id = friendships.requester_id
      join public.group_members b
        on b.group_id = me.group_id and b.player_id = friendships.addressee_id
      where me.player_id = (select auth.uid())
    )
  );
