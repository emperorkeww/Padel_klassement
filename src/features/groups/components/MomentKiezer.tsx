import { Sheet } from "@/ui/Sheet";
import type { PollOption, PollVote } from "@/features/groups/pollsApi";
import { optionState, tallyOption, vastlegbaar } from "@/features/groups/pollLogic";
import { shortDay } from "../planPollHelpers";
import { MomentMeta, MomentMeter } from "./MomentMeta";
/* De kaart die deze sheet opent woont op /speeldag, maar een component brengt
   zijn eigen stijlen mee: anders staat hij ongestyled zodra hij elders belandt. */
import "@/features/groups/Proposals.css";

/* ------------------------------------------------------------------ */
/* Welk moment leggen we vast? (#1181)                                 */
/* ------------------------------------------------------------------ */

/*
 * De voet van de poll-kaart stelt één moment voor: dat met de meeste ja's onder
 * de haalbare. Dat was ook meteen het énige moment dat je kon vastleggen, en
 * dat is te strak — iemand moet nog stemmen, je belde de club voor een baan die
 * Playtomic als bezet ziet, of de groep spreekt gewoon iets anders af.
 *
 * Hier staat de hele lijst, mét de cijfers waarop je beslist. Ook de onhaalbare
 * momenten: die zijn niet verboden, ze vragen een bevestiging bij de aanroeper.
 * Alleen een dag die voorbij is valt af — daar valt niets meer te spelen.
 */

export function MomentKiezer({
  open,
  onClose,
  options,
  votes,
  today,
  vrijOp,
  prijsOp,
  aanbevolenId,
  huidigId,
  onKies,
}: {
  open: boolean;
  onClose: () => void;
  /** Alle momenten van de poll, gesorteerd op datum + tijd. */
  options: PollOption[];
  votes: PollVote[];
  today: string;
  /** Vrije banen van een moment (live indien bekend, anders de momentopname). */
  vrijOp: (option: PollOption) => number | null;
  /** ± prijs per persoon, of null buiten het Playtomic-venster. */
  prijsOp: (option: PollOption) => string | null;
  /** Het moment dat de kaart voorstelt; krijgt een badge. */
  aanbevolenId: string | null;
  /** Het al vastgelegde moment (bij verzetten); krijgt een badge. */
  huidigId: string | null;
  onKies: (option: PollOption) => void;
}) {
  // Voorbije momenten stonden gewoon tussen de rest, disabled met de badge
  // "voorbij" — ruis in een lijst waar je iets moet kiezen (#1271). Ze blijven
  // opvraagbaar: soms wil je zien wat er ooit voorgesteld was.
  const kiesbaar = options.filter((o) => vastlegbaar(o, today));
  const voorbij = options.filter((o) => !vastlegbaar(o, today));

  function rij(o: PollOption) {
    const t = tallyOption(o, votes);
    const vrij = vrijOp(o);
    const state = optionState(t.yes.length, vrij);
    const prijs = prijsOp(o);
    const kan = vastlegbaar(o, today);
    return (
      <li key={o.id}>
        <button
          type="button"
          className={`moment-kiezer__optie poll-option--${state}`}
          disabled={!kan || o.id === huidigId}
          onClick={() => onKies(o)}
        >
          <span className="moment-kiezer__kop">
            <span className="moment-kiezer__when">
              {shortDay(o.date)} · {o.start_time}
            </span>
            <MomentMeter state={state} className="moment-kiezer__meter" />
          </span>
          {/* Sinds #1308 dezelfde regel als in het agenda-dag-sheet. */}
          <MomentMeta
            className="moment-kiezer__meta"
            ja={t.yes.length}
            misschien={t.maybe.length}
            tekort={t.tekort}
            vrij={vrij}
            banenNodig={t.needed}
            prijs={prijs}
          />
          {(o.id === huidigId || o.id === aanbevolenId || !kan) && (
            <span className="moment-kiezer__badges">
              {o.id === huidigId && (
                <span className="moment-kiezer__badge">nu gekozen</span>
              )}
              {o.id === aanbevolenId && o.id !== huidigId && (
                <span className="moment-kiezer__badge is-aanbevolen">
                  aanbevolen
                </span>
              )}
              {!kan && <span className="moment-kiezer__badge">voorbij</span>}
            </span>
          )}
        </button>
      </li>
    );
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={huidigId ? "Welk moment wordt het?" : "Welk moment leggen we vast?"}
      compact
    >
      <p className="moment-kiezer__uitleg">
        De stemmen zijn een advies — jij beslist. Ook een moment met minder
        ja&apos;s of te weinig vrije banen mag je vastleggen.
      </p>
      {kiesbaar.length === 0 ? (
        <p className="empty">
          {voorbij.length > 0
            ? "Alle voorgestelde momenten zijn voorbij. Pas de dagen aan om er een toe te voegen."
            : "Deze speeldag heeft geen momenten om uit te kiezen."}
        </p>
      ) : (
        <ul className="moment-kiezer">{kiesbaar.map(rij)}</ul>
      )}
      {voorbij.length > 0 && (
        <details className="moment-kiezer__voorbij">
          <summary>
            {voorbij.length === 1
              ? "1 voorbij moment"
              : `${voorbij.length} voorbije momenten`}
          </summary>
          <ul className="moment-kiezer">{voorbij.map(rij)}</ul>
        </details>
      )}
    </Sheet>
  );
}
