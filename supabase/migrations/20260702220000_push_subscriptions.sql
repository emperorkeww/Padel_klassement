-- Web-push-abonnementen: één rij per browser/apparaat. De Edge Function
-- send-push leest deze met de service-role key; gebruikers beheren alleen
-- hun eigen abonnementen.

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

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
