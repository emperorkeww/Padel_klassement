-- #432: de table-wide UPDATE-grant op public.matches liet een deelnemer bij het
-- invullen van de uitslag élke kolom meeschrijven (created_by-escalatie,
-- group_id/team_*/played_at-manipulatie). De RLS-policies (#413) werken op
-- rij-niveau, niet op kolom-niveau.
--
-- Beperk de UPDATE-grant voor 'authenticated' tot de unie van wat de aanmaker-
-- en de deelnemer-policy nodig hebben. Zo blijven created_by, group_id,
-- team_a_id/team_b_id, round_number, format en id buiten bereik.
--
-- Met de hand geschreven: `supabase db diff` genereert geen kolom-grants
-- (zie CLAUDE.md). anon en service_role blijven ongemoeid.
revoke update on table public.matches from authenticated;
grant update (status, winner_team_id, score_a, score_b, set_scores, played_at)
  on table public.matches to authenticated;
