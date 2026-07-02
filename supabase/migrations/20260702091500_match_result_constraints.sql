-- Integriteit van uitslagen afdwingen op databankniveau.
--
-- Tot nu toe kon de maker van een match elke combinatie van winnaar en score
-- opslaan (bv. winnaar A met 0-99, of negatieve scores die het scoresaldo in
-- het klassement verpesten). Deze constraints leggen vast:
--   1. scores zijn nooit negatief;
--   2. een rondenummer is minstens 1;
--   3. als beide scores zijn ingevuld, moet de winnaar bij de score passen
--      (hoogste score wint; gelijke score = gelijkspel zonder winnaar).
--
-- Een afgeronde match zónder scores blijft toegestaan (alleen winnaar geregistreerd).
-- Let op: als bestaande rijen deze regels schenden faalt de migratie bewust —
-- corrigeer die rijen dan eerst.

alter table public.matches
  add constraint matches_scores_nonneg check (
    (score_a is null or score_a >= 0)
    and (score_b is null or score_b >= 0)
  ),
  add constraint matches_round_positive check (
    round_number is null or round_number >= 1
  ),
  add constraint matches_result_consistent check (
    score_a is null
    or score_b is null
    or (winner_team_id = team_a_id and score_a > score_b)
    or (winner_team_id = team_b_id and score_b > score_a)
    or (winner_team_id is null and score_a = score_b)
  );
