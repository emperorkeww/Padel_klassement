-- Vendetta's (#169): zichtbaar voor de hele groep; alleen de uitdager start er
-- één, en alleen de twee betrokkenen beëindigen hem. Geen delete-policy: een
-- beëindigde vendetta blijft historie voor de feed. Dat de rivaal zelf ook
-- groepslid is borgt de guard-trigger (vendettas_guard).
create policy "vendettas_select_member" on public.vendettas
  for select
  using (public.is_group_member(group_id, (select auth.uid())));

create policy "vendettas_insert_challenger" on public.vendettas
  for insert
  with check (
    challenger_id = (select auth.uid())
    and public.is_group_member(group_id, (select auth.uid()))
  );

create policy "vendettas_update_involved" on public.vendettas
  for update
  using ((select auth.uid()) in (challenger_id, rival_id))
  with check ((select auth.uid()) in (challenger_id, rival_id));

-- Kolomprivileges: ended_at zet de guard-trigger, nooit de client; de client
-- mag alleen de startpayload inserten en enkel status bijwerken.
revoke insert, update on public.vendettas from authenticated;
grant insert (group_id, challenger_id, rival_id, target_wins),
      update (status)
  on public.vendettas to authenticated;
