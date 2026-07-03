-- Gebruikers beheren alleen hun eigen push-abonnementen; de Edge Function
-- send-push leest álle rijen via de service-role key (buiten RLS om).
create policy "push_select_own" on public.push_subscriptions
  for select
  using (user_id = (select auth.uid()));

create policy "push_insert_own" on public.push_subscriptions
  for insert
  with check (user_id = (select auth.uid()));

create policy "push_update_own" on public.push_subscriptions
  for update
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "push_delete_own" on public.push_subscriptions
  for delete
  using (user_id = (select auth.uid()));
