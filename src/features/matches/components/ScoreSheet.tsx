import { useState, type ReactNode } from "react";
import { Sheet } from "@/ui/Sheet";
import { useToast } from "@/ui/ToastProvider";
import { errorMessage } from "@/lib/utils/errors";
import {
  emptySet,
  readSetScores,
  toSetScores,
  type SetPair,
  type SetScore,
} from "@/features/matches/api";
import { ScoreForm } from "@/features/matches/components/ScoreForm";
import { scoreGeldig } from "@/features/matches/setsCheck";
import type { Match } from "@/types";

/** Wat er uit het formulier komt; de aanroeper bepaalt hoe het wordt bewaard. */
export type ScoreInvoer = {
  scoreA: number;
  scoreB: number;
  /** null = geen (of bewust gewiste) set-stand. */
  setScores: SetScore[] | null;
};

/**
 * De uitslag-invoer als sheet (#1144).
 *
 * Waarom een sheet en niet een uitklappende kaart: `<Sheet>` regelt focus trap,
 * Escape, scroll-lock en de safe-area al, hij is mobiel een bottom-sheet en op
 * desktop een dialoog, en — het belangrijkste — de lijst eronder verspringt
 * niet. De geplande kaart klapte tot nu toe open tot ~800px en duwde alles
 * eronder weg; dat was precies de klacht uit #941 die met een extra knop was
 * afgedekt in plaats van opgelost.
 *
 * Opslaan gaat via `onSave`: dit component kent de invoer, de aanroeper kent
 * de opslag én zijn neveneffecten (confetti, rivaliteitstoast, reload,
 * offline-outbox). Gooit `onSave`, dan blijft de sheet open met de invoer erin,
 * zodat een geweigerde opslag niet je hele uitslag opeet.
 */
export function ScoreSheet({
  open,
  match,
  labelA,
  labelB,
  titel = "Uitslag",
  opslaanLabel = "Uitslag opslaan",
  ratingPreview,
  onClose,
  onSave,
}: {
  open: boolean;
  /** Voedt de beginwaarden: een correctie start met de bestaande stand. */
  match: Match;
  labelA: string;
  labelB: string;
  titel?: string;
  opslaanLabel?: string;
  /** Meestal een <RatingPreview />; blijft weg voor wie niet meespeelt. */
  ratingPreview?: ReactNode;
  onClose: () => void;
  onSave: (invoer: ScoreInvoer) => Promise<void>;
}) {
  const [scoreA, setScoreA] = useState(
    match.score_a != null ? String(match.score_a) : "",
  );
  const [scoreB, setScoreB] = useState(
    match.score_b != null ? String(match.score_b) : "",
  );
  const [sets, setSets] = useState<SetPair[]>(() => {
    const bestaand = readSetScores(match);
    return bestaand && bestaand.length > 0
      ? bestaand.map(([a, b]) => ({ a: String(a), b: String(b) }))
      : [emptySet()];
  });
  // Sets openen zichzelf als er al een stand ligt: die wil je zien, niet zoeken.
  const [setsOpen, setSetsOpen] = useState(
    () => (readSetScores(match)?.length ?? 0) > 0,
  );
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  if (!open) return null;

  const geldig = scoreGeldig(scoreA, scoreB);

  async function opslaan() {
    if (!geldig || busy) return;
    setBusy(true);
    try {
      const setScores = toSetScores(sets);
      await onSave({
        scoreA: Number(scoreA),
        scoreB: Number(scoreB),
        // Alle rijen leeg = sets bewust wissen; anders de nieuwe stand.
        setScores: setScores.length > 0 ? setScores : null,
      });
      onClose();
    } catch (err) {
      // Melden gebeurt hier, één keer, in plaats van in elke aanroeper. Een
      // aanroeper die zelf moet terugdraaien (de optimistische kaart) vangt de
      // fout af en gooit hem door — dan komt hij alsnog hier langs.
      toast.error(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Sheet open onClose={onClose} title={titel} compact>
      <ScoreForm
        labelA={labelA}
        labelB={labelB}
        scoreA={scoreA}
        scoreB={scoreB}
        onScoreA={setScoreA}
        onScoreB={setScoreB}
        sets={sets}
        onSets={setSets}
        setsOpen={setsOpen}
        onSetsOpen={setSetsOpen}
        autoFocus
      >
        {ratingPreview}
      </ScoreForm>
      <footer className="sheet__foot">
        <button className="btn" onClick={onClose} disabled={busy}>
          Annuleren
        </button>
        <button
          className="btn btn--primary"
          disabled={busy || !geldig}
          onClick={() => void opslaan()}
        >
          {busy ? "Opslaan…" : opslaanLabel}
        </button>
      </footer>
    </Sheet>
  );
}

export default ScoreSheet;
