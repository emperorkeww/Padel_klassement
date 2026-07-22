-- #465: de table-wide UPDATE-grant op public.profiles liet een gebruiker bij het
-- bijwerken van zijn eigen profiel élke kolom meeschrijven. De RLS-policy
-- ("Gebruiker kan eigen profiel bijwerken") werkt op rij-niveau (id = auth.uid()),
-- niet op kolom-niveau. Daardoor kon een gebruiker is_guest/owner_id op zijn eigen
-- rij zetten en zijn echte account ombouwen tot "gast" van een slachtoffer:
-- vriendschap omzeilen via is_own_guest, uit player_standings verdwijnen en met de
-- owner_id-cascade meeverdwijnen. Zelfde klasse fout als #432 op matches.
--
-- Beperk de UPDATE-grant voor 'authenticated' tot precies de kolommen die de
-- client legitiem schrijft (updateProfile / updateFeaturedBadges / updatePrivacy /
-- updateNotificationPrefs). Zo blijven id, is_guest, owner_id, created_at en de
-- guard-beschermde dictator_avatar_url/-bron buiten bereik van een directe
-- client-UPDATE.
--
-- LET OP: komt er later een nieuwe client-schrijfbare profielkolom bij, voeg die
-- dan hier én in schemas/policies/profiles.sql toe — anders faalt die write met
-- 42501. Met de hand geschreven: `supabase db diff` genereert geen kolom-grants
-- (zie CLAUDE.md). anon (geen UPDATE-policy) en service_role blijven ongemoeid.
revoke update on table public.profiles from authenticated;
grant update (username, full_name, avatar_url, discoverable, allow_friend_requests,
              featured_badges, roast_schild, roast_intensiteit,
              toon_waarnemend_dictator, dictator_portret,
              notify_new_round, notify_result, notify_friend_request,
              notify_match_reminder, notify_rank_change)
  on table public.profiles to authenticated;
