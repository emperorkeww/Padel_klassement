-- Dedup-tabel voor "match begint bijna"-herinneringen. De cron-edgefunctie
-- match-reminders schrijft hier per match één rij zodra de push verstuurd is.
-- Alleen de service-role gebruikt deze tabel; RLS staat aan zonder policies.
create table public.match_reminders (
  match_id uuid primary key references public.matches (id) on delete cascade,
  sent_at timestamptz not null default now()
);
