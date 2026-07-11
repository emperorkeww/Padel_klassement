-- Row Level Security voor zwarte_piet.
-- Leesbaar voor groepsleden (zelfde is_group_member-patroon als pias_of_week);
-- schrijven kan enkel via de SECURITY DEFINER recompute-functie, dus er zijn
-- geen write-policies.
create policy "zwarte_piet_select_member" on public.zwarte_piet
  for select
  using (public.is_group_member(group_id, (select auth.uid())));
