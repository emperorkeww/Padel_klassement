-- #978: de groepseigenaar beheert alle matches in zijn groep.
--
-- #905 gaf hem de uitslag-invoer, maar met dezelfde begrenzing als een
-- deelnemer: alleen de overgang naar 'completed' op een nog niet afgeronde
-- match. Corrigeren achteraf, verplaatsen en annuleren bleven bij de aanmaker.
-- In de praktijk is dat te krap — de organisator doet de administratie, staat
-- vaak zelf niet op de baan, en gegenereerde rondes krijgen created_by =
-- degene die op "ronde maken" drukte. Stond er één cijfer verkeerd, dan kon
-- juist hij het niet rechtzetten, terwijl delete_match hem de match wél al
-- liet verwijderen.
--
-- Vervangen door dezelfde onbegrensde vorm als "Aanmaker kan match bijwerken",
-- ingeperkt tot matches in een groep die hij bezit.
--
-- De kolom-grant uit #432 blijft ongewijzigd en is hier de echte begrenzing:
-- created_by en group_id staan er niet in, dus een groepseigenaar kan geen
-- vreemde match naar zijn groep trekken om er rechten op te krijgen en zich
-- niet tot aanmaker promoveren. Alle kolommen die de client schrijft
-- (status, winner_team_id, score_a, score_b, set_scores, played_at) stonden er
-- al in, dus er hoeft niets aan de grant te veranderen.
--
-- Downstream is een correctie achteraf al ingeregeld: matches_ratings_trigger
-- draait een volledige recompute_ratings() zodra de winnaar van een afgeronde
-- match wijzigt, en grade_match_predictions herbeoordeelt de tips. Dat pad
-- bestond al voor de aanmaker; deze policy zet er alleen meer mensen op.

set check_function_bodies = off;

drop policy if exists "Groepseigenaar kan uitslag invullen" on "public"."matches";

create policy "Groepseigenaar kan groepsmatch bijwerken"
  on "public"."matches"
  as permissive
  for update
  to authenticated
using (((group_id IS NOT NULL) AND public.is_group_owner(group_id, ( SELECT auth.uid() AS uid))))
with check (((group_id IS NOT NULL) AND public.is_group_owner(group_id, ( SELECT auth.uid() AS uid))));
