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