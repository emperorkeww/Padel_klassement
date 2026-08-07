import { useState } from "react";
import { ScoreStepper } from "@/ui/ScoreStepper";
import { useToast } from "@/ui/ToastProvider";
import { errorMessage } from "@/lib/utils/errors";
import { tap } from "@/lib/utils/haptics";
import {
  emptySet,
  readSetScores,
  toSetScores,
  updateMatchScore,
  type SetPair,
} from "@/features/matches/api";
import { SetScoresInput } from "@/features/matches/components/SetScoresInput";
import type { Match } from "@/types";

/**
 * Inline correctie van de eindscore van een reeds afgeronde match; de winnaar
 * volgt automatisch uit de score (check-constraint matches_result_consistent).
 *
 * Uitgesneden uit MatchDetail in #1144. Dit is de blokkerende variant van de
 * score-invoer — anders dan de optimistische invoer op de geplande kaart en de
 * outbox-variant in de wizard. Die drie worden in de volgende stap van #1144
 * samengevoegd tot één gedeeld formulier; tot dan blijft dit gedrag exact
 * zoals het was.
 */
export function ScoreEditor({
  match,
  labelA,
  labelB,
  onClose,
  onSaved,
}: {
  match: Match;
  labelA: string;
  labelB: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [sa, setSa] = useState(
    match.score_a != null ? String(match.score_a) : "",
  );
  const [sb, setSb] = useState(
    match.score_b != null ? String(match.score_b) : "",
  );
  // Sets zijn hier óók te corrigeren — zelfde invoer als bij het loggen
  // (#106: één uitslag-patroon), voorgevuld met de bestaande set-stand.
  const [sets, setSets] = useState<SetPair[]>(() => {
    const existing = readSetScores(match);
    return existing && existing.length > 0
      ? existing.map(([a, b]) => ({ a: String(a), b: String(b) }))
      : [emptySet()];
  });
  const [busy, setBusy] = useState(false);

  const saNum = sa === "" ? null : Number(sa);
  const sbNum = sb === "" ? null : Number(sb);
  const valid = saNum !== null && sbNum !== null && saNum >= 0 && sbNum >= 0;
  const preview = valid
    ? saNum === sbNum
      ? "Gelijkspel — beide teams krijgen 1 punt."
      : `${saNum > sbNum ? labelA : labelB} wint.`
    : null;

  async function save() {
    if (!valid) return toast.error("Vul beide scores in (0 of hoger).");
    setBusy(true);
    try {
      const setScores = toSetScores(sets);
      await updateMatchScore({
        matchId: match.id,
        winnerTeamId:
          saNum === sbNum
            ? null
            : saNum! > sbNum!
              ? match.team_a_id
              : match.team_b_id,
        scoreA: saNum!,
        scoreB: sbNum!,
        // Alle set-rijen leeg = sets bewust wissen; anders de nieuwe stand.
        setScores: setScores.length > 0 ? setScores : null,
      });
      tap();
      toast.success("Score bijgewerkt.");
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="md-editor">
      <div className="md-editor__inputs">
        {/* Geen <label>-wrapper: die zou kliks naar de eerste stepper-knop
            sturen; het aria-label op het veld dekt de toegankelijkheid. */}
        <div className="md-editor__field">
          <span>{labelA}</span>
          <ScoreStepper value={sa} onChange={setSa} label={`Score ${labelA}`} />
        </div>
        <span className="md-editor__dash">–</span>
        <div className="md-editor__field">
          <span>{labelB}</span>
          <ScoreStepper value={sb} onChange={setSb} label={`Score ${labelB}`} />
        </div>
      </div>
      {preview && <p className="md-editor__preview">{preview}</p>}
      <SetScoresInput
        sets={sets}
        onChange={setSets}
        labelA={labelA}
        labelB={labelB}
      />
      <div className="md-editor__buttons">
        <button className="btn btn--sm" onClick={onClose} disabled={busy}>
          Annuleren
        </button>
        <button
          className="btn btn--primary btn--sm"
          onClick={save}
          disabled={busy || !valid}
        >
          {busy ? "Opslaan…" : "Opslaan"}
        </button>
      </div>
    </div>
  );
}

export default ScoreEditor;
