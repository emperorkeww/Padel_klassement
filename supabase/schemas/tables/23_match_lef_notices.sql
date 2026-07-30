-- Dedup-tabel voor de lef-onthulling bij de aftrap (#804). De cron-edgefunctie
-- match-reminders schrijft hier per match één rij zodra de partners van de
-- inzetters hun melding kregen. Ook matches zonder inzet krijgen een rij: dan
-- valt er niets te melden en hoeft een volgende crontik er niet meer naar te
-- kijken. Zelfde patroon (en dezelfde reden) als public.match_reminders.
--
-- Alleen de service-role gebruikt deze tabel; RLS staat aan zonder policies.
create table public.match_lef_notices (
  match_id uuid primary key references public.matches (id) on delete cascade,
  sent_at timestamptz not null default now()
);

alter table public.match_lef_notices enable row level security;
