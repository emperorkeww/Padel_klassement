import { useEffect, useState, type ReactNode } from "react";
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
import {
  clearScoreDraft,
  readScoreDraft,
  writeScoreDraft,
} from "@/features/matches/matchDraft";
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
  // Een half ingetikte score overleeft het sluiten (#1271). Elk sheet sluit
  // sinds #1180 met een veeg omlaag, en dat gebeurt op de baan sneller dan je
  // denkt: kleine veeg, invoer weg. Het concept staat in sessionStorage — deze
  // avond, dit tabblad.
  const concept = useState(() => readScoreDraft(match.id))[0];
  const [scoreA, setScoreA] = useState(
    concept?.scoreA ?? (match.score_a != null ? String(match.score_a) : ""),
  );
  const [scoreB, setScoreB] = useState(
    concept?.scoreB ?? (match.score_b != null ? String(match.score_b) : ""),
  );
  const [sets, setSets] = useState<SetPair[]>(() => {
    if (concept) return concept.sets;
    const bestaand = readSetScores(match);
    return bestaand && bestaand.length > 0
      ? bestaand.map(([a, b]) => ({ a: String(a), b: String(b) }))
      : [emptySet()];
  });
  // Sets openen zichzelf als er al een stand ligt: die wil je zien, niet zoeken.
  const [setsOpen, setSetsOpen] = useState(
    () => concept?.setsOpen ?? (readSetScores(match)?.length ?? 0) > 0,
  );
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  // Live wegschrijven zolang de sheet openstaat; leeg = geen concept.
  useEffect(() => {
    if (!open) return;
    writeScoreDraft(match.id, { scoreA, scoreB, sets, setsOpen });
  }, [open, match.id, scoreA, scoreB, sets, setsOpen]);

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
      // De uitslag staat er (of staat in de wachtrij): het concept is klaar.
      clearScoreDraft(match.id);
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
    // De focus op het eerste scoreveld regelt het sheet zelf (#1271). Met
    // `autoFocus` op het veld gebeurde er niets: React zet die in de
    // commit-fase, waarna het focus-effect van Sheet hem stil terugpakte naar
    // de dialoog. Gevolg: geen toetsenbord op de baan, en altijd een extra tik.
    <Sheet
      open
      onClose={onClose}
      title={titel}
      compact
      initialFocus=".input--score"
    >
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
      >
        {ratingPreview}
      </ScoreForm>
      <footer className="sheet__foot">
        {/* Annuleren is een besluit: het concept mag weg. Alleen wegvegen of
            wegnavigeren laat je invoer staan (#1271). */}
        <button
          className="btn"
          onClick={() => {
            clearScoreDraft(match.id);
            onClose();
          }}
          disabled={busy}
        >
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
