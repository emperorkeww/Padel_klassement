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
  meer = 0,
  laadt,
  ledenPerGroep,
  profielen,
  onOpenDag,
}: {
  /** De komende speeldagen, op volgorde; groepering per maand gebeurt hier. */
  items: DagItem[];
  /** Hoeveel speeldagen er niet meer pasten (#1270). De lijst kapte stil af op
   *  40 items, en dat ziet er precies zo uit als een agenda die leeg raakt. */
  meer?: number;
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
        {/* Verwees tot #1270 terug naar het maandoverzicht: in deze weergave
            kón je helemaal niet plannen. De knop staat nu boven de lijst en
            werkt in beide weergaven, dus hier hoeft alleen de stand van zaken
            nog te staan. */}
        <p className="dagpaneel__leeg-tekst">
          Er staat de komende maanden niets op de agenda.
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

      {/* De twee grenzen die deze lijst heeft, uitgesproken (#1270). Beide zijn
          redelijk — verder plant niemand — maar erover zwijgen is dat niet. */}
      <p className="agenda-lijst__grens">
        {meer > 0
          ? `Nog ${meer} ${meer === 1 ? "speeldag" : "speeldagen"} verderop; die staan in het maandoverzicht.`
          : "Dit is alles wat er de komende drie maanden gepland staat."}
      </p>
    </div>
  );
}

export default AgendaLijst;
