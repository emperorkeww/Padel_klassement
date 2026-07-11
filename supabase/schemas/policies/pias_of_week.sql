-- Row Level Security voor pias_of_week.
-- Leesbaar voor groepsleden (zelfde is_group_member-patroon als de toto,
-- policies/match_predictions.sql); schrijven kan enkel via de SECURITY DEFINER
-- recompute-functie, dus er zijn geen write-policies.
alter table public.pias_of_week enable row level security;

create policy "pias_of_week_select_member" on public.pias_of_week
  for select
  using (public.is_group_member(group_id, (select auth.uid())));
