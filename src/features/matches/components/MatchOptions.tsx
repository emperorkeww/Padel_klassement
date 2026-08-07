import { useState, type ReactNode } from "react";
import { Sheet } from "@/ui/Sheet";
import "./MatchOptions.css";

/** Eén optie: wat het is, wat de stand van zaken is, en wat erachter zit. */
export interface MatchOptie {
  sleutel: string;
  /** Decoratief; de naam ernaast draagt de betekenis. */
  icoon: string;
  naam: string;
  /** De stand van zaken in één korte zin ("2 voorspellingen", "Geen"). */
  waarde: string;
  /** Wat er in de sheet komt — in de praktijk het bestaande blok. */
  inhoud: ReactNode;
}

/**
 * "Matchopties" als compacte rijen (#1144).
 *
 * Toto, speciale kaart, inzet en rating stonden elk als eigen tegel met een
 * eigen gekleurd vlak op de kaart — samen goed voor een paar honderd pixels aan
 * features die je meestal niet nodig hebt. Nu vier rijen die zeggen hoe het
 * ervoor staat, en pas openen wat je aantikt.
 *
 * De blokken zelf zijn ongewijzigd; alleen hun verpakking verandert. Zo blijven
 * alle regels rond zichtbaarheid, tegoeden en deadlines waar ze horen — in
 * JokerBlock, LefTipBlock, TraktatieBlock en de toto-tegel — en hoeft deze
 * component er niets van te weten.
 */
export function MatchOptions({
  opties,
  titel = "Matchopties",
}: {
  opties: MatchOptie[];
  titel?: string;
}) {
  const [open, setOpen] = useState<string | null>(null);
  if (opties.length === 0) return null;

  const geopend = opties.find((o) => o.sleutel === open) ?? null;

  return (
    <section className="matchopties" aria-label={titel}>
      <h3 className="matchopties__titel">{titel}</h3>
      <ul className="matchopties__lijst">
        {opties.map((o) => (
          <li key={o.sleutel}>
            <button
              type="button"
              className="matchopties__rij"
              aria-haspopup="dialog"
              onClick={() => setOpen(o.sleutel)}
            >
              <span className="matchopties__icoon" aria-hidden="true">
                {o.icoon}
              </span>
              <span className="matchopties__naam">{o.naam}</span>
              <span className="matchopties__waarde">{o.waarde}</span>
              <span className="matchopties__pijl" aria-hidden="true">
                ›
              </span>
            </button>
          </li>
        ))}
      </ul>
      {geopend && (
        <Sheet
          open
          onClose={() => setOpen(null)}
          title={`${geopend.icoon} ${geopend.naam}`}
          compact
        >
          {geopend.inhoud}
        </Sheet>
      )}
    </section>
  );
}

export default MatchOptions;
