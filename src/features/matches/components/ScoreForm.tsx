import type { ReactNode } from "react";
import { ScoreStepper } from "@/ui/ScoreStepper";
import { toSetScores, type SetPair } from "@/features/matches/api";
import { scoreGeldig, setsWaarschuwing } from "@/features/matches/setsCheck";
import { SetScoresInput } from "@/features/matches/components/SetScoresInput";
import "./ScoreForm.css";

/**
 * De uitslag invoeren — het ene formulier (#1144).
 *
 * Dit stond drie keer los: inline op de geplande kaart, als ScoreEditor op het
 * matchdetail en als stap 2 van de invoerwizard. Drie layouts, drie
 * valideringen, drie previewteksten. Hier staat het één keer.
 *
 * **Controlled, en met opzet.** De wizard bewaart zijn concept in localStorage
 * (matchDraft, #462); zou dit formulier zijn eigen state houden, dan overleeft
 * een half ingevulde uitslag geen refresh meer.
 *
 * **Zonder opslagknop, en ook met opzet.** De drie aanroepers slaan verschillend
 * op — optimistisch met confetti en rivaliteitstoast, blokkerend met een reload,
 * of via de offline-outbox met Coach Rudy erachteraan. Dat verschil is echt en
 * hoort niet in een gedeeld formulier verstopt te raken; de knop staat dus bij
 * de aanroeper (of bij ScoreSheet, die hem voor twee van de drie verzorgt).
 */
export function ScoreForm({
  labelA,
  labelB,
  scoreA,
  scoreB,
  onScoreA,
  onScoreB,
  sets,
  onSets,
  setsOpen,
  onSetsOpen,
  autoFocus = false,
  aboveA,
  aboveB,
  children,
}: {
  labelA: string;
  labelB: string;
  /** Score als string; "" = nog niet ingevuld (zoals ScoreStepper werkt). */
  scoreA: string;
  scoreB: string;
  onScoreA: (v: string) => void;
  onScoreB: (v: string) => void;
  sets: SetPair[];
  onSets: (sets: SetPair[]) => void;
  /** Staat de optionele set-invoer open? Sets zijn bijzaak, dus standaard niet. */
  setsOpen: boolean;
  onSetsOpen: (open: boolean) => void;
  autoFocus?: boolean;
  /** Optioneel boven de stepper, bv. de avatars in de invoerwizard. */
  aboveA?: ReactNode;
  aboveB?: ReactNode;
  /** Extra onder de sets — in de praktijk de ratingpreview. */
  children?: ReactNode;
}) {
  const a = scoreA === "" ? null : Number(scoreA);
  const b = scoreB === "" ? null : Number(scoreB);
  const geldig = scoreGeldig(scoreA, scoreB);
  const gelijk = geldig && a === b;
  const winnaarLabel = !geldig || gelijk ? null : a! > b! ? labelA : labelB;

  // De sets en de eindstand kunnen een andere winnaar aanwijzen; dat is een
  // invoerfout, geen smaakverschil. Waarschuwen, niet blokkeren — zie
  // setsCheck.ts voor waarom er niet méér gecontroleerd wordt.
  const waarschuwing = setsWaarschuwing({
    sets: toSetScores(sets),
    scoreA: a,
    scoreB: b,
    labelA,
    labelB,
  });

  return (
    <div className="scoreform">
      {/* Twee kolommen naast elkaar in plaats van twee gestapelde rijen: de
          eindstand is één feit met twee kanten, en zo past hij op 375px binnen
          één schermhoogte samen met de sets en de ratingpreview. */}
      <div className="scoreform__teams">
        <div
          className={`scoreform__team${
            geldig && !gelijk && a! > b! ? " is-leading" : ""
          }`}
        >
          {aboveA}
          <span className="scoreform__label">{labelA}</span>
          <ScoreStepper
            value={scoreA}
            onChange={onScoreA}
            label={`Score ${labelA}`}
            autoFocus={autoFocus}
          />
        </div>
        <span className="scoreform__dash" aria-hidden="true">
          –
        </span>
        <div
          className={`scoreform__team${
            geldig && !gelijk && b! > a! ? " is-leading" : ""
          }`}
        >
          {aboveB}
          <span className="scoreform__label">{labelB}</span>
          <ScoreStepper
            value={scoreB}
            onChange={onScoreB}
            label={`Score ${labelB}`}
          />
        </div>
      </div>

      {geldig ? (
        <p
          className={`scoreform__preview ${
            gelijk ? "scoreform__preview--draw" : "scoreform__preview--win"
          }`}
        >
          <span aria-hidden="true">{gelijk ? "🤝" : "🏆"}</span>{" "}
          {gelijk
            ? "Gelijkspel — beide teams krijgen 1 punt."
            : `${winnaarLabel} winnen — 3 punten.`}
        </p>
      ) : (
        <p className="scoreform__hint">
          De hoogste score wint. Een gelijke score telt als gelijkspel.
        </p>
      )}

      {/* Sets zijn optioneel en decoratief (score_a/score_b blijven de
          autoritaire aggregaat), dus ze krijgen niet dezelfde visuele
          prioriteit als de eindstand: dicht tenzij je ze nodig hebt. */}
      <div className="scoreform__sets">
        <button
          type="button"
          className="scoreform__sets-toggle"
          aria-expanded={setsOpen}
          onClick={() => onSetsOpen(!setsOpen)}
        >
          {setsOpen
            ? "− Sets verbergen"
            : "+ Sets per set invoeren (optioneel)"}
        </button>
        {setsOpen && (
          <SetScoresInput
            sets={sets}
            onChange={onSets}
            labelA={labelA}
            labelB={labelB}
          />
        )}
      </div>

      {waarschuwing && (
        <p className="scoreform__waarschuwing" role="status">
          <span aria-hidden="true">⚠</span> {waarschuwing}
        </p>
      )}

      {children}
    </div>
  );
}

export default ScoreForm;
