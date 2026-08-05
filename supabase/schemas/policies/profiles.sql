-- Row Level Security voor public.profiles
alter table public.profiles enable row level security;

-- Iedereen mag profielen lezen
create policy "Profielen zijn publiek leesbaar"
  on public.profiles
  for select
  using (true);

-- gebruiker mag enkel eigen profiel bijwerken
create policy "Gebruiker kan eigen profiel bijwerken"
  on public.profiles
  for update
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- #465: de policy hierboven werkt op rij-niveau, maar de UPDATE-grant op profiles
-- is table-wide (Supabase-default). Daardoor mag een gebruiker bij de ene
-- toegestane UPDATE (eigen profiel) élke kolom meeschrijven — o.a. is_guest/
-- owner_id op zichzelf zetten en zijn account tot "gast" van een slachtoffer
-- ombouwen (vriendschap omzeilen, uit player_standings verdwijnen, owner_id-
-- cascade). RLS controleert alleen de rij, niet welke kolommen worden geraakt.
-- Zelfde patroon en fix als #432 op matches.
--
-- Beperk de UPDATE-grant tot precies de kolommen die de client legitiem schrijft
-- (updateProfile / updateFeaturedBadges / updatePrivacy / updateNotificationPrefs).
-- Zo blijven id, is_guest, owner_id, created_at en de guard-beschermde
-- dictator_avatar_url/-bron buiten bereik. Komt er een nieuwe client-schrijfbare
-- kolom bij, voeg die hier én in de migratie toe. anon (geen UPDATE-policy) en
-- service_role: ongemoeid. De portret-opt-outs (dictator_portret #554,
-- pias_portret #682) staan er wél in — de gegenereerde *_avatar_url/-bron niet.
--
-- moet_wachtwoord_wijzigen (#1036) hoort hier bewust NIET bij, en dat is geen
-- vergetelheid: wie zijn eigen vlag kan uitzetten, kan met een door een
-- beheerder uitgedeeld tijdelijk wachtwoord blijven rondlopen. De vlag gaat
-- alleen uit via de trigger on_auth_password_changed, dus pas als er écht een
-- nieuw wachtwoord staat. Zie supabase/tests/verplichte_wachtwoordwissel_test.sql.
revoke update on table public.profiles from authenticated;
grant update (username, full_name, avatar_url, discoverable, allow_friend_requests,
              featured_badges, roast_schild, roast_intensiteit,
              toon_waarnemend_dictator, dictator_portret, pias_portret,
              notify_new_round, notify_result, notify_friend_request,
              notify_match_reminder, notify_rank_change)
  on table public.profiles to authenticated;