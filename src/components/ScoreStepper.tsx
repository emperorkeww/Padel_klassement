import "./ScoreStepper.css";

/** Score-invoer met grote ±-knoppen voor gebruik op de baan: met één duim te
 *  bedienen, zonder toetsenbord. Het veld zelf blijft gewoon typbaar en
 *  draagt het (team)label voor screenreaders en tests. */
export function ScoreStepper({
  value,
  onChange,
  label,
  autoFocus = false,
}: {
  /** Huidige waarde als string; "" = nog niet ingevuld. */
  value: string;
  onChange: (value: string) => void;
  /** aria-label van het invoerveld, bv. "Score Alice & Bob". */
  label: string;
  autoFocus?: boolean;
}) {
  const num = value === "" ? null : Number(value);

  const step = (delta: number) => {
    onChange(String(Math.max(0, (num ?? 0) + delta)));
  };

  return (
    <span className="stepper">
      <button
        type="button"
        className="stepper__btn"
        aria-label={`${label}: één minder`}
        disabled={num == null || num <= 0}
        onClick={() => step(-1)}
      >
        −
      </button>
      <input
        className="input input--score"
        type="number"
        min="0"
        inputMode="numeric"
        placeholder="0"
        aria-label={label}
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        className="stepper__btn"
        aria-label={`${label}: één meer`}
        onClick={() => step(1)}
      >
        +
      </button>
    </span>
  );
}

export default ScoreStepper;
