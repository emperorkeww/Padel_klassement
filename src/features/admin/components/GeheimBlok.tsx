import { useId, useState } from "react";

// Toont een eenmalig geheim — een herstel-link of een tijdelijk wachtwoord —
// met een kopieerknop (#1036).
//
// Bewust géén state die dit langer bewaart dan het paneel openstaat, en bewust
// geen plek in de querycache: de waarde bestaat alleen in deze component en
// verdwijnt zodra de sheet dichtgaat. Wie hem opnieuw nodig heeft, deelt een
// nieuwe uit — dat is goedkoop en veiliger dan hem laten rondslingeren.
//
// De readonly input is de fallback voor het geval `navigator.clipboard` niet
// beschikbaar is (geen https, oudere webview): selecteren en zelf kopiëren
// werkt dan nog. Zelfde patroon als de groepsuitnodiging in GroupLedenTab.

export function GeheimBlok({
  label,
  waarde,
  waarschuwing,
}: {
  label: string;
  waarde: string;
  /** Wat de beheerder moet weten vóór hij dit doorgeeft. */
  waarschuwing: string;
}) {
  const [gekopieerd, setGekopieerd] = useState(false);

  async function kopieer() {
    try {
      await navigator.clipboard.writeText(waarde);
      setGekopieerd(true);
      setTimeout(() => setGekopieerd(false), 2000);
    } catch {
      // Geen toast: het veld hiernaast staat er nog, en "selecteer en kopieer"
      // is dan de weg. Een foutmelding zou hier alleen maar afleiden.
    }
  }

  // Eén echte <label> in plaats van een span plus twee aria-labels: dat laatste
  // gaf het veld twee toegankelijke namen en maakt het bovendien onvindbaar met
  // getByLabelText, omdat er dan twee elementen op die naam matchen.
  const veldId = useId();
  const hintId = `${veldId}-hint`;

  return (
    <div className="admin-geheim">
      <label className="admin-geheim__label" htmlFor={veldId}>
        {label}
      </label>
      <div className="admin-geheim__rij">
        <input
          id={veldId}
          className="input admin-geheim__waarde"
          readOnly
          value={waarde}
          onFocus={(e) => e.currentTarget.select()}
          aria-describedby={hintId}
        />
        <button type="button" className="btn btn--sm" onClick={kopieer}>
          {gekopieerd ? "Gekopieerd" : "Kopieer"}
        </button>
      </div>
      <p id={hintId} className="field-hint">
        {waarschuwing}
      </p>
    </div>
  );
}
