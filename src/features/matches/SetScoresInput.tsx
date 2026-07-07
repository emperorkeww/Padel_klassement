import { ScoreStepper } from "../../components/ScoreStepper";
import { emptySet } from "./api";
import type { SetPair } from "./api";
import "./SetScoresInput.css";

/** Optionele per-set score-invoer: een rij steppers per set, met knoppen om een
 *  set toe te voegen of te verwijderen. Volledig additief — laat je alle rijen
 *  leeg, dan verandert er niets aan de bestaande (aggregaat)score. */
export function SetScoresInput({
  sets,
  onChange,
  labelA,
  labelB,
  max = 3,
}: {
  sets: SetPair[];
  onChange: (sets: SetPair[]) => void;
  labelA: string;
  labelB: string;
  max?: number;
}) {
  const setAt = (i: number, side: "a" | "b", v: string) =>
    onChange(sets.map((s, j) => (j === i ? { ...s, [side]: v } : s)));
  const addSet = () => onChange([...sets, emptySet()]);
  const removeSet = (i: number) =>
    onChange(sets.length > 1 ? sets.filter((_, j) => j !== i) : [emptySet()]);

  return (
    <div className="setscores">
      {sets.map((s, i) => (
        <div className="setscores__row" key={i}>
          <span className="setscores__idx">Set {i + 1}</span>
          <ScoreStepper
            value={s.a}
            onChange={(v) => setAt(i, "a", v)}
            label={`Set ${i + 1} — games ${labelA}`}
          />
          <span className="setscores__dash">–</span>
          <ScoreStepper
            value={s.b}
            onChange={(v) => setAt(i, "b", v)}
            label={`Set ${i + 1} — games ${labelB}`}
          />
          <button
            type="button"
            className="setscores__rm"
            onClick={() => removeSet(i)}
            aria-label={`Set ${i + 1} verwijderen`}
            title="Set verwijderen"
          >
            ✕
          </button>
        </div>
      ))}
      {sets.length < max && (
        <button
          type="button"
          className="btn btn--sm setscores__add"
          onClick={addSet}
        >
          + Set toevoegen
        </button>
      )}
    </div>
  );
}

export default SetScoresInput;
