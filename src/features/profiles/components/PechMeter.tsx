import {
  PECHMETER_DOEL,
  PECHVOGEL_EMOJI,
  NIPT_MARGE,
  TROOST_MAX,
  type PechMeter as Meter,
} from "@/features/rating/pechvogel";

/**
 * De Pechvogel-meter (#1005) op het profiel: drie vakjes die vollopen bij elke
 * nipte nederlaag op rij. Bij een lege meter rendert dit niets — een leeg
 * bakje pech is geen informatie, en het profiel van wie gewoon wint hoort er
 * niet mee volgehangen te worden.
 *
 * De stand komt uit pechMeter() en niet uit de databank: dezelfde telling,
 * maar zonder extra query. Wat de databank straks uitkeert (de demper) staat
 * los in de feed.
 */
export function PechMeter({ meter }: { meter: Meter }) {
  if (meter.stand === 0) return null;

  const label = meter.vol
    ? `Meter vol: ${PECHMETER_DOEL} nipte nederlagen op rij. Goed voor ${TROOST_MAX} punten troost.`
    : `${meter.stand} van de ${PECHMETER_DOEL} — verloren met hooguit ${NIPT_MARGE} punten verschil.`;

  return (
    <section
      className={`pechmeter${meter.vol ? " pechmeter--vol" : ""}`}
      aria-label="Pechvogel-meter"
    >
      <span className="pechmeter__emoji" aria-hidden="true">
        {PECHVOGEL_EMOJI}
      </span>
      <div className="pechmeter__body">
        <div
          className="pechmeter__vakjes"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={PECHMETER_DOEL}
          aria-valuenow={meter.stand}
          aria-valuetext={`${meter.stand} van de ${PECHMETER_DOEL}`}
        >
          {Array.from({ length: PECHMETER_DOEL }, (_, i) => (
            <span
              key={i}
              className={`pechmeter__vakje${i < meter.stand ? " pechmeter__vakje--aan" : ""}`}
            />
          ))}
        </div>
        <p className="pechmeter__tekst">{label}</p>
      </div>
    </section>
  );
}
