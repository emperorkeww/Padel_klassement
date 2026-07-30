-- #804 Lef-tip, deel 3: de partner van een inzetter krijgt bij de aftrap een
-- push dat er naast hem dubbel of niets gespeeld wordt. Vóór de starttijd
-- blijft de inzet verborgen — anders kun je op andermans lef meeliften — maar
-- daarna verandert het wel degelijk hoe je de match ingaat.
--
-- Deze tabel is de dedup-sleutel voor de cron-edgefunctie match-reminders:
-- één rij per match zodra die is nagekeken, ook als er niets te melden viel.
-- Spiegel van supabase/schemas/tables/23_match_lef_notices.sql, zelfde patroon
-- als public.match_reminders.
create table public.match_lef_notices (
  match_id uuid primary key references public.matches (id) on delete cascade,
  sent_at timestamptz not null default now()
);

-- Alleen de service-role gebruikt deze tabel: RLS aan, bewust zonder policies.
alter table public.match_lef_notices enable row level security;
