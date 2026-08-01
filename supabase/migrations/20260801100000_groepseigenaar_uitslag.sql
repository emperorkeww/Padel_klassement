-- De eigenaar van een groep kon de uitslag van een groepsmatch niet invullen:
-- de enige UPDATE-policies op matches zijn "aanmaker" (#413's voorganger) en
-- "deelnemer" (#413). De organisator van een speeldag staat lang niet altijd
-- zelf op de baan, en gegenereerde rondes krijgen created_by = degene die op
-- "ronde maken" drukte — dus bleef de score-invoer voor hem dicht.
--
-- Derde permissive policy met dezelfde begrenzing als de deelnemer-policy:
-- alleen de overgang naar 'completed', en alleen zolang de match nog niet
-- afgerond is. Corrigeren achteraf en het tijdstip verplaatsen blijven bij de
-- aanmaker. Sluit aan bij delete_match, waar de groepseigenaar al mag.
--
-- De kolom-grant uit #432 blijft ongewijzigd: de kolommen die setMatchResult
-- schrijft (status, winner_team_id, score_a, score_b, set_scores, played_at)
-- staan er al in, en group_id blijft buiten bereik — een groepseigenaar kan
-- een match dus niet naar zijn eigen groep trekken om er rechten op te krijgen.

set check_function_bodies = off;

create policy "Groepseigenaar kan uitslag invullen"
  on "public"."matches"
  as permissive
  for update
  to authenticated
using (((status <> 'completed'::public.match_status) AND (group_id IS NOT NULL) AND public.is_group_owner(group_id, ( SELECT auth.uid() AS uid))))
with check (((status = 'completed'::public.match_status) AND (group_id IS NOT NULL) AND public.is_group_owner(group_id, ( SELECT auth.uid() AS uid))));
