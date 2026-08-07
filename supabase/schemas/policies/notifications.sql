-- Meldingen (#1090) zijn strikt persoonlijk: je leest je eigen rijen en je mag
-- er precies één ding aan veranderen — of je ze gezien hebt. Schrijven doet
-- alleen de service-role, via public.meldingen_schrijven (functions/38).

create policy "notifications_select_own" on public.notifications
  for select
  using (user_id = (select auth.uid()));

-- "Gelezen" en "alles gelezen" zijn dezelfde update. De WITH CHECK houdt de rij
-- bij dezelfde eigenaar; welke kolommen mogen wijzigen regelt de kolomgrant
-- hieronder, want RLS kan dat niet.
create policy "notifications_update_own" on public.notifications
  for update
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Bewust geen insert- of delete-policy: een melding schrijf je niet zelf, en
-- wegveegbaar hoeft ze niet te zijn — prune_notifications ruimt op na 90 dagen.
revoke insert, update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;
