import type { Profile } from "@/types";
import {
  maandLabel,
  metHoofdletter,
  perMaand,
  type DagItem,
} from "../agendaLogic";
import { SpeeldagKaart } from "./SpeeldagKaart";
import "../Agenda.css";

/* ------------------------------------------------------------------ */
/* De lijstweergave (#1182).                                           */
/*                                                                     */
/* Het maandraster beantwoordt "wat staat er in augustus". De vraag     */
/* waarmee je de agenda meestal opent is een andere — "wat komt eraan"  */
/* — en die hield tot nu toe op bij de maandgrens: alleen onder een     */
/* lége dag stonden drie "Hierna"-rijen, en zodra je een dag met een    */
/* speeldag koos verdween ook dat.                                     */
/*                                                                     */
/* Dezelfde kaart als in het dagpaneel, met de dag erbij, en dezelfde   */
/* weg naar het dag-sheet. Geen tweede manier om iets te doen: alleen   */
/* een tweede manier om te kijken.                                     */
/* ------------------------------------------------------------------ */

export function AgendaLijst({
  items,
  laadt,
  ledenPerGroep,
  profielen,
  onOpenDag,
}: {
  /** De komende speeldagen, op volgorde; groepering per maand gebeurt hier. */
  items: DagItem[];
  laadt: boolean;
  ledenPerGroep: Record<string, number>;
  profielen: Record<string, Profile>;
  /** Een aangetikte speeldag opent het dag-sheet van díe dag. */
  onOpenDag: (date: string) => void;
}) {
  if (laadt) {
    return (
      <p className="agenda-lijst__laadt" aria-live="polite">
        Speeldagen ophalen…
      </p>
    );
  }

  if (items.length === 0) {
    return (
      <div className="dagpaneel__leeg">
        <p className="dagpaneel__leeg-titel">Nog niets gepland</p>
        <p className="dagpaneel__leeg-tekst">
          Er staat de komende maanden niets op de agenda. Kies een dag in het
          maandoverzicht om er een speeldag op te zetten.
        </p>
      </div>
    );
  }

  return (
    <div className="agenda-lijst">
      {perMaand(items).map((groep) => (
        <section key={`${groep.maand.jaar}-${groep.maand.maand}`}>
          <h2 className="agenda-lijst__maand">
            {metHoofdletter(maandLabel(groep.maand))}
          </h2>
          <ul className="dagpaneel__lijst">
            {groep.items.map((item) => (
              <li key={`${item.eerste.date}|${item.eerste.pollId}`}>
                <SpeeldagKaart
                  item={item}
                  leden={ledenPerGroep[item.eerste.groupId] ?? 0}
                  profielen={profielen}
                  metDag
                  onOpen={() => onOpenDag(item.eerste.date)}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export default AgendaLijst;
