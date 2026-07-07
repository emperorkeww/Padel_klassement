-- Dedup-tabel voor de "match begint bijna"-herinneringen. De cron-edgefunctie
-- (match-reminders) schrijft hier per match één rij weg zodra de push verstuurd
-- is, zodat spelers niet elke cron-tik opnieuw een melding krijgen.
--
-- Alleen de service-role (waarmee de Edge Function draait) leest/schrijft deze
-- tabel; RLS staat aan zonder policies, dus gewone gebruikers zien 'm niet.
create table public.match_reminders (
  match_id uuid primary key references public.matches (id) on delete cascade,
  sent_at timestamptz not null default now()
);

alter table public.match_reminders enable row level security;
