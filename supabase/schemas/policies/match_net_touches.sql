-- Netrollers (#809): zichtbaar voor iedereen die de match zelf mag zien —
-- zelfde voorwaarde als de select-policy op matches, zodat een netroller nooit
-- meer verklapt dan de match waar hij bij hoort. Schrijven doe je alleen voor
-- jezelf, en alleen als je in die match stond; dat laatste borgt de
-- guard-trigger (match_net_touches_guard), samen met de afgerond-eis.

create policy "match_net_touches_select_zichtbaar" on public.match_net_touches
  for select
  using (
    exists (
      select 1
      from public.matches m
      where m.id = match_id
        and (
          m.group_id is null
          or public.is_group_member(m.group_id, (select auth.uid()))
          or public.is_team_member(m.team_a_id, (select auth.uid()))
          or public.is_team_member(m.team_b_id, (select auth.uid()))
          or m.created_by = (select auth.uid())
        )
    )
  );

create policy "match_net_touches_insert_own" on public.match_net_touches
  for insert
  to authenticated
  with check (player_id = (select auth.uid()));

create policy "match_net_touches_update_own" on public.match_net_touches
  for update
  to authenticated
  using (player_id = (select auth.uid()))
  with check (player_id = (select auth.uid()));

create policy "match_net_touches_delete_own" on public.match_net_touches
  for delete
  to authenticated
  using (player_id = (select auth.uid()));

-- Kolomprivileges: created_at/updated_at zijn serverside (de guard zet
-- updated_at). RLS beschermt geen kolommen, dus de grants doen dat.
revoke insert, update on table public.match_net_touches from authenticated;
grant insert (match_id, player_id, aantal) on table public.match_net_touches to authenticated;
grant update (aantal) on table public.match_net_touches to authenticated;
