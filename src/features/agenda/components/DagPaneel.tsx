import { Link } from "react-router-dom";
import { longDay, shortDay } from "@/features/groups/planPollHelpers";
import type { Profile } from "@/types";
import { statusLabel, tijdenLabel, type DagItem } from "../agendaLogic";
import { StatusGlyph } from "@/ui/StatusGlyph";
import { SpeeldagKaart } from "./SpeeldagKaart";
import "../Agenda.css";

/* ------------------------------------------------------------------ */
/* Het paneel onder het raster (#1112, omgebouwd in #1270).            */
/*                                                                     */
/* Dit ging over de dag die je had aangetikt. Op 390×800 begon het bij  */
/* y=744 terwijl er 730px zichtbaar is, en aantikken scrollde niet: het */
/* enige zichtbare gevolg van een tik was een gevulde cel. Het antwoord */
/* op je tik stond dus buiten beeld, en de dubbele betekenis van die    */
/* tik (eerst kiezen, dan openen) was daardoor niet te ontdekken.       */
/*                                                                     */
/* Sinds #1270 opent een tik meteen het dag-sheet — dat ligt per        */
/* definitie in beeld — en beantwoordt dit paneel de vraag die je       */
/* zónder tikken hebt: wat staat er vandaag, en wat komt daarna. Het    */
/* hangt daarmee aan vandaag en niet meer aan het raster: blader je     */
/* naar december, dan blijft dit je anker op nu.                        */
/* ------------------------------------------------------------------ */

export function DagPaneel({
  vandaag,
  vandaagItems,
  volgende,
  wedstrijdenPerPoll = {},
  ledenPerGroep,
  profielen,
  onOpenDag,
}: {
  vandaag: string;
  /** Speeldagen die vandaag beginnen. */
  vandaagItems: DagItem[];
  /** De eerstvolgende speeldagen daarna — de wegwijzer vooruit. */
  volgende: DagItem[];
  /** Aantal gespeelde wedstrijden per poll (#1221) — de teller op de kaart. */
  wedstrijdenPerPoll?: Record<string, number>;
  /** Aantal leden per groep — de noemer van "2 van 4 kunnen". */
  ledenPerGroep: Record<string, number>;
  profielen: Record<string, Profile>;
  /** Een aangetikte speeldag of wegwijzer: het dag-sheet van díe dag opent. */
  onOpenDag: (date: string) => void;
}) {
  return (
    <section className="dagpaneel" aria-label="Vandaag en hierna">
      <header className="dagpaneel__kop">
        <h2 className="dagpaneel__datum">
          {/* "Vandaag · vrijdag 7 augustus" — de dag zelf blijft erbij staan,
              want dit blok schuift niet mee met de maand die je bekijkt. */}
          <span className="dagpaneel__vandaag">Vandaag ·</span> {longDay(vandaag)}
        </h2>
        <div className="dagpaneel__kop-rechts">
          {/* "Is er vandaag eigenlijk een baan vrij?" was tot #1213 een vraag
              die je elders opnieuw moest intikken. Zonder ?club=: dit paneel
              gaat over meerdere groepen, dus je eigen clubkeuze is hier de
              juiste. */}
          <Link className="dagpaneel__banen" to={`/banen?datum=${vandaag}`}>
            Vrije banen vandaag →
          </Link>
        </div>
      </header>

      {vandaagItems.length === 0 ? (
        <div className="dagpaneel__leeg">
          <p className="dagpaneel__leeg-titel">Vandaag staat er niets</p>
          <p className="dagpaneel__leeg-tekst">
            {volgende.length > 0
              ? "Hieronder staat wat er wél aankomt."
              : "Tik een dag in het raster aan om er een speeldag op te zetten."}
          </p>
        </div>
      ) : (
        <ul className="dagpaneel__lijst">
          {vandaagItems.map((item) => (
            <li key={item.eerste.pollId}>
              <SpeeldagKaart
                item={item}
                leden={ledenPerGroep[item.eerste.groupId] ?? 0}
                profielen={profielen}
                wedstrijden={wedstrijdenPerPoll[item.eerste.pollId] ?? 0}
                onOpen={() => onOpenDag(item.eerste.date)}
              />
            </li>
          ))}
        </ul>
      )}

      {/* Het antwoord op "en wanneer dán wel?", in plaats van maand voor maand
          te moeten bladeren. Stond hier alleen onder een lége dag; nu altijd,
          want dit paneel gáát over vooruitkijken. */}
      {volgende.length > 0 && <Hierna dagen={volgende} onOpenDag={onOpenDag} />}
    </section>
  );
}

/**
 * "Hierna": de eerstvolgende speeldagen, als rijen om naartoe te springen.
 *
 * Compacter dan een speeldagkaart en met opzet: dit is een wegwijzer. Aantikken
 * opent die speeldag meteen (#1270) — het koos vroeger alleen de dag, en wat
 * dat opleverde stond dan weer buiten beeld.
 *
 * Eén rij per speeldag (#1270). Dit liep op losse momenten, dus een poll die
 * twee tijden op dezelfde zaterdag voorstelde nam twee van de drie rijen —
 * driemaal "15 aug" onder elkaar, waarvan twee dezelfde vraag.
 */
function Hierna({
  dagen,
  onOpenDag,
}: {
  dagen: DagItem[];
  onOpenDag: (date: string) => void;
}) {
  return (
    <>
      <h3 className="dagpaneel__kicker">Hierna</h3>
      <ul className="hierna">
        {dagen.map(({ eerste: m, momenten }) => (
          <li key={m.pollId}>
            <button
              type="button"
              className="hierna__rij"
              onClick={() => onOpenDag(m.date)}
              // De rij opent een speeldag, en dat moet je kunnen horen: de
              // losse stukjes tekst zeggen los van elkaar te weinig.
              aria-label={`${shortDay(m.date)}, ${tijdenLabel(momenten)}, ${m.groupName}, ${statusLabel(m.status, m.past)}`}
            >
              <StatusGlyph status={m.status} past={m.past} />
              <span className="hierna__dag" aria-hidden="true">
                {shortDay(m.date)}
              </span>
              <span className="hierna__wat" aria-hidden="true">
                {tijdenLabel(momenten)} · {m.groupName}
              </span>
              <IconChevron />
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

function IconChevron() {
  return (
    <svg
      className="hierna__chevron"
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}

export default DagPaneel;
