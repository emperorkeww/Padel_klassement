/**
 * Voorkeurschakelaar (#921).
 *
 * De instellingen gebruikten kale `<input type="checkbox">`-rijen, waardoor de
 * pagina als formulier las in plaats van als voorkeuren. Dit is dezelfde rij,
 * maar met `role="switch"`: een screenreader zegt dan "aan"/"uit" in plaats van
 * "aangevinkt" — en dat is wat deze rijen betekenen. Een checkbox hoort bij
 * "selecteer wat je wilt indienen"; hier gaat elke tik meteen in.
 */
export function Toggle({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: React.ReactNode;
  /** Korte uitleg onder het label; laat weg als het label zichzelf uitlegt. */
  hint?: React.ReactNode;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="toggle-row">
      <span className="toggle-row__text">
        <span className="toggle-row__label">{label}</span>
        {hint && <span className="toggle-row__hint">{hint}</span>}
      </span>
      <input
        type="checkbox"
        role="switch"
        className="toggle-row__switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

export default Toggle;
