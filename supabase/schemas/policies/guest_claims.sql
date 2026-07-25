-- Koppelverzoeken (#681): alleen de twee betrokkenen zien het verzoek — de
-- aanvrager (de eigenaar van de gast) en het echte account dat moet bevestigen.
-- Schrijven kan uitsluitend via de RPC's (request_guest_claim,
-- claim_guest_player, cancel_guest_claim), want die bewaken de autorisatie en
-- de conflictcheck; vandaar geen insert/update/delete-policy én ingetrokken
-- schrijfrechten.
create policy "guest_claims_select_betrokkenen" on public.guest_claims
  for select
  using ((select auth.uid()) in (requested_by, player_id));

revoke insert, update, delete on public.guest_claims from authenticated;
grant select on public.guest_claims to authenticated;
