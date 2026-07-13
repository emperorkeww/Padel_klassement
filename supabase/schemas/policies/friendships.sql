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
-- Feed (#326, verruimt #138): een geaccepteerde vriendschap is leesbaar zodra
-- minstens één van de twee partijen in het netwerk van de kijker zit — een
-- groepsgenoot óf een geaccepteerde vriend. Zo verschijnen "X en Y zijn nu
-- vrienden"-momenten ook als je maar met één van beiden een band hebt, i.p.v.
-- de oude eis dat je met beide een groep deelt. Verzoeken (pending/declined)
-- blijven strikt privé (enkel via "Eigen vriendschappen zijn leesbaar").
-- De checks lopen via SECURITY DEFINER-helpers, zodat de policy geen recursie
-- op friendships veroorzaakt.
create policy "friendships_select_network" on public.friendships
  for select
  to authenticated
  using (
    status = 'accepted'
    and (
      public.shares_group((select auth.uid()), requester_id)
      or public.shares_group((select auth.uid()), addressee_id)
      or public.is_accepted_friend((select auth.uid()), requester_id)
      or public.is_accepted_friend((select auth.uid()), addressee_id)
    )
  );
