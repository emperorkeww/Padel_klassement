import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sheet } from "@/ui/Sheet";
import { EmptyState } from "@/ui/EmptyState";
import { Skeleton } from "@/ui/Skeleton";
import { formatRelatieveTijd } from "@/lib/utils/format";
import { markeerAllesGelezen, markeerGelezen, type Melding } from "../api";
import "./MeldingenPaneel.css";

/**
 * Het meldingenpaneel (#1090). Eén component, twee ingangen: de bel in de
 * mobiele topbalk en de zijbalkregel op desktop. Sheet is vanaf 640px al een
 * gecentreerd paneel in plaats van een bottom-sheet, dus er is geen tweede
 * vorm nodig — en hij draagt het glasmateriaal (#1062/#1083) al.
 *
 * Twee dingen die het paneel bewust NIET doet:
 *  - openen markeert niets als gelezen. Anders is één keer kijken genoeg om
 *    alles kwijt te zijn, en juist de melding die je wilde onthouden verdwijnt.
 *  - het toont geen soort-labels. De titel zegt al wat er gebeurd is; een
 *    tweede etiket met "poll" of "uitslag" ernaast voegt niets toe aan een
 *    regel van drie woorden.
 */
export function MeldingenPaneel({
  open,
  onClose,
  meldingen,
  laadt,
  limiet,
  onVeranderd,
}: {
  open: boolean;
  onClose: () => void;
  meldingen: Melding[];
  laadt: boolean;
  /** Hoeveel er hoogstens in dit paneel passen; bepaalt of de voet naar de
   *  volledige lijst wijst. */
  limiet: number;
  /** Na een leesmarkering: de teller in de balk moet meteen meebewegen. */
  onVeranderd: () => void;
}) {
  const navigate = useNavigate();
  const [bezig, setBezig] = useState(false);
  const ongelezen = meldingen.filter((m) => !m.read_at).length;

  async function openMelding(melding: Melding) {
    // Navigeren gaat vóór het markeren: de melding openen is wat je wilde, en
    // een falende update mag dat niet tegenhouden.
    onClose();
    navigate(melding.url);
    if (melding.read_at) return;
    try {
      await markeerGelezen(melding.id);
      onVeranderd();
    } catch {
      // Stil: je bent al onderweg naar het scherm. De stip blijft staan, en dat
      // is eerlijker dan een foutmelding op een scherm dat je net verliet.
    }
  }

  async function allesGelezen() {
    setBezig(true);
    try {
      await markeerAllesGelezen();
      onVeranderd();
    } finally {
      setBezig(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Meldingen" className="meldingen-sheet">
      {ongelezen > 0 && (
        <div className="meldingen__acties">
          <button
            type="button"
            className="btn btn--sm"
            onClick={allesGelezen}
            disabled={bezig}
          >
            {bezig ? "Bezig…" : "Alles gelezen"}
          </button>
        </div>
      )}

      {laadt && meldingen.length === 0 ? (
        <Skeleton rows={4} />
      ) : meldingen.length === 0 ? (
        <EmptyState icon="🔔" title="Nog niets te melden">
          Zodra er een ronde klaarstaat, een uitslag binnenkomt of iemand je een
          verzoek stuurt, staat het hier.
        </EmptyState>
      ) : (
        <ul className="meldingen__lijst">
          {meldingen.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                className={`melding${m.read_at ? "" : " melding--ongelezen"}`}
                onClick={() => void openMelding(m)}
              >
                {/* De stip is versiering voor wie kijkt; voor wie luistert
                    staat "ongelezen" in de tekst hieronder. */}
                <span className="melding__stip" aria-hidden="true" />
                <span className="melding__tekst">
                  <span className="melding__titel">{m.title}</span>
                  <span className="melding__body">{m.body}</span>
                  <span className="melding__tijd">
                    {formatRelatieveTijd(m.created_at)}
                    {!m.read_at && (
                      <span className="sr-only"> · ongelezen</span>
                    )}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* "Alles bekijken →" naar /meldingen volgt met die route zelf (PR 3);
          een knop naar een pad dat nog niet bestaat is een knop naar de
          404-pagina. Tot dan zegt de voet alleen dát er meer is. */}
      {meldingen.length >= limiet && (
        <p className="meldingen__voet">
          Alleen de laatste {limiet} meldingen staan hier.
        </p>
      )}
    </Sheet>
  );
}

export default MeldingenPaneel;
