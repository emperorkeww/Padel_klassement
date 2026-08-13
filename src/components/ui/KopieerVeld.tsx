import { useId, useState } from "react";

// Een waarde om door te geven — een uitnodigingslink, een herstel-link, een
// tijdelijk wachtwoord — als readonly veld met een kopieerknop ernaast (#1298).
//
// Stond twee keer los in de app: als `GeheimBlok` in het adminpaneel (#1036,
// met de comment "zelfde patroon als de groepsuitnodiging") en als een kaal
// readonly veld bij de groepsuitnodiging, waar de kopieerknop juist ontbrak —
// daar kopieerde de app één keer automatisch, en faalde dat, dan zei de melding
// "kopieer 'm hieronder" bij een veld zonder knop.
//
// De readonly input is de vangnet-route voor als `navigator.clipboard` niet
// beschikbaar is (geen https, oudere webview): selecteren en zelf kopiëren werkt
// dan nog. Focus selecteert de hele waarde, zodat dat één handeling is.

export function KopieerVeld({
  label,
  waarde,
  hint,
  className = "",
}: {
  label: string;
  waarde: string;
  /** Regel onder het veld: wat de lezer moet weten vóór hij dit deelt. */
  hint?: string;
  className?: string;
}) {
  const [gekopieerd, setGekopieerd] = useState(false);

  async function kopieer() {
    try {
      await navigator.clipboard.writeText(waarde);
      setGekopieerd(true);
      setTimeout(() => setGekopieerd(false), 2000);
    } catch {
      // Geen toast: het veld ernaast staat er nog, en "selecteer en kopieer" is
      // dan de weg. Een foutmelding zou hier alleen maar afleiden.
    }
  }

  // Eén echte <label> in plaats van een span plus aria-label: dat laatste geeft
  // het veld twee toegankelijke namen en maakt het onvindbaar met
  // getByLabelText, omdat er dan twee elementen op die naam matchen.
  const veldId = useId();
  const hintId = `${veldId}-hint`;

  return (
    <div className={`kopieerveld ${className}`.trim()}>
      <label className="kopieerveld__label" htmlFor={veldId}>
        {label}
      </label>
      <div className="kopieerveld__rij">
        <input
          id={veldId}
          className="input kopieerveld__waarde"
          readOnly
          value={waarde}
          onFocus={(e) => e.currentTarget.select()}
          {...(hint ? { "aria-describedby": hintId } : {})}
        />
        <button type="button" className="btn btn--sm" onClick={kopieer}>
          {gekopieerd ? "Gekopieerd" : "Kopieer"}
        </button>
      </div>
      {hint && (
        <p id={hintId} className="field-hint">
          {hint}
        </p>
      )}
    </div>
  );
}

export default KopieerVeld;
