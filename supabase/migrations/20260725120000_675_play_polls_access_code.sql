-- #675: optionele toegangscode van de velden op een speeldag-poll. Spiegel van
-- supabase/schemas/tables/13_play_polls.sql; zie dat bestand voor de motivatie.
--
-- Vrije tekst i.p.v. cijfers: clubs gebruiken ook letters, of een code per baan
-- ("b3: 1234 · b4: 5678"). Eén veld houdt het model simpel; de lengtelimiet
-- houdt het een code en geen mededeling.
--
-- Geen policy- of grant-wijziging nodig: play_polls heeft table-wide grants (in
-- tegenstelling tot profiles/matches, #465/#432), dus de kolom erft select en
-- update. play_polls_select_member beperkt het lezen tot groepsleden — een
-- clubcode hoort niet op een publieke pagina — en play_polls_update_manager
-- heeft geen statusfilter, dus de maker/eigenaar kan de code ook ná het boeken
-- nog zetten (hij komt vaak pas met de bevestigingsmail).
--
-- Met de hand geschreven: `supabase db diff` kan hier niet draaien zolang het
-- declaratieve schema achterloopt op de migraties (player_rank_state en
-- profiles.notify_rank_change uit 20260719120000 staan niet in schemas/).
alter table public.play_polls
  add column if not exists access_code text;

alter table public.play_polls
  drop constraint if exists play_polls_access_code_check;
alter table public.play_polls
  add constraint play_polls_access_code_check
  check (access_code is null or length(access_code) <= 60);
