import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { formatRelatieveTijd } from "@/lib/utils/format";
import { useRijVeeg } from "@/lib/hooks/useRijVeeg";
import { useToast } from "@/ui/ToastProvider";
import {
  markeerGelezen,
  markeerOngelezen,
  veegWeg,
  zetTerug,
  type Melding,
} from "../api";
import { groepeer } from "../groepering";
import { soortInfo, zonderEmoji } from "../soorten";
import "./MeldingenLijst.css";

/**
 * De lijst zelf (#1090), gedeeld door het paneel in de shell en de route
 * /meldingen. Eén component omdat "tikken markeert alléén dit item gelezen en
 * navigeert naar dezelfde url als de push" op beide plekken hetzelfde hoort te
 * werken — en dat is precies het soort regel dat in twee kopieën uit elkaar
 * groeit.
 *
 * Sinds #1273 draagt elke rij haar soort (zie ../soorten.ts): een icoon in een
 * eigen kolom, in de accentfamilie van die gebeurtenis. Een tekstlabel ernaast
 * blijft overbodig — dát deel van #1090 klopte — maar negen soorten die op één
 * regel lijken klopte niet.
 *
 * En elke rij heeft nu iets te kiezen. Openen was de enige actie die er was: dat
 * markeert gelezen én navigeert je weg, dus wie alleen van de teller af wilde
 * had maar één knop — "Alles gelezen", alles-of-niets, zonder undo.
 */
export function MeldingenLijst({
  meldingen,
  onGeopend,
  onVeranderd,
}: {
  meldingen: Melding[];
  /** Extra afhandeling vóór het navigeren — het paneel sluit zichzelf. */
  onGeopend?: () => void;
  /** Na een leesmarkering: de teller in de balk moet meteen meebewegen. */
  onVeranderd: () => void;
}) {
  const navigate = useNavigate();
  const toast = useToast();

  async function openMelding(melding: Melding) {
    // Navigeren gaat vóór het markeren: de melding openen is wat je wilde, en
    // een falende update mag dat niet tegenhouden.
    onGeopend?.();
    navigate(melding.url);
    if (melding.read_at) return;
    try {
      await markeerGelezen(melding.id);
      onVeranderd();
    } catch {
      // Stil: je bent al onderweg naar het scherm. Het vlak blijft staan, en dat
      // is eerlijker dan een foutmelding op een scherm dat je net verliet.
    }
  }

  async function wissel(melding: Melding) {
    try {
      if (melding.read_at) await markeerOngelezen(melding.id);
      else await markeerGelezen(melding.id);
      onVeranderd();
    } catch (e) {
      // De partiële unieke index houdt één óngelezen rij per tag vast: staat er
      // inmiddels een nieuwe melding over dezelfde gebeurtenis, dan kan deze er
      // niet naast. Dat is geen fout van jou, dus geen foutmelding.
      const code = (e as { code?: string }).code;
      toast.info(
        code === "23505"
          ? "Er staat al een ongelezen melding over deze gebeurtenis."
          : "Dat lukte niet. Probeer het zo nog eens.",
      );
    }
  }

  async function wegleggen(melding: Melding) {
    try {
      await veegWeg(melding);
      onVeranderd();
      toast.success("Weggelegd — tik om terug te zetten", {
        onClick: () => {
          void zetTerug(melding.id).then(onVeranderd);
        },
      });
    } catch {
      toast.error("Wegleggen lukte niet. Probeer het zo nog eens.");
    }
  }

  // Koppen alleen als er iets te scheiden valt (#1273): één tijdvak met een
  // kop erboven is een etiket op de hele lijst, en dat zegt niets.
  const groepen = groepeer(meldingen);
  const rijen = (lijst: Melding[]) => (
    <ul className="meldingen__lijst">
      {lijst.map((m) => (
        <MeldingRij
          key={m.id}
          melding={m}
          onOpen={() => void openMelding(m)}
          onWissel={() => void wissel(m)}
          onWeg={() => void wegleggen(m)}
        />
      ))}
    </ul>
  );

  if (groepen.length > 1) {
    return (
      <div className="meldingen__groepen">
        {groepen.map((groep) => (
          <section className="meldingen__groep" key={groep.kop}>
            <h3 className="meldingen__kop">{groep.kop}</h3>
            {rijen(groep.meldingen)}
          </section>
        ))}
      </div>
    );
  }
  return rijen(meldingen);
}

function MeldingRij({
  melding,
  onOpen,
  onWissel,
  onWeg,
}: {
  melding: Melding;
  onOpen: () => void;
  onWissel: () => void;
  onWeg: () => void;
}) {
  const rij = useRef<HTMLLIElement>(null);
  // Naar links vegen legt hem weg — hetzelfde gebaar als op het toestel, en het
  // sheet eromheen laat horizontale gebaren expliciet los (#1180).
  useRijVeeg(rij, onWeg);

  const { icoon: Icoon, familie, label } = soortInfo(melding.soort);
  const titel = zonderEmoji(melding.title);
  // "VAR: VAR: er wordt een punt betwist" — sommige titels noemen hun soort
  // zelf al. Dan zegt het icoon genoeg en hoeft de voorleesregel het niet te
  // herhalen.
  const noemtZichzelf = titel.toLowerCase().startsWith(label.toLowerCase());
  const gelezen = !!melding.read_at;

  return (
    <li
      ref={rij}
      className={`melding-rij${gelezen ? "" : " melding-rij--ongelezen"}`}
    >
      <button type="button" className="melding" onClick={onOpen}>
        {/* Het icoon is versiering voor wie kijkt; voor wie luistert staat de
            soort in de tekst hieronder, net als "ongelezen". De vaste kolom
            houdt de linkerrand recht, wat de servertitel ook doet. */}
        <span
          className={`melding__icoon melding__icoon--${familie}`}
          aria-hidden="true"
        >
          <Icoon />
        </span>
        <span className="melding__tekst">
          <span className="melding__titel">
            {!noemtZichzelf && <span className="sr-only">{label}: </span>}
            {titel}
          </span>
          <span className="melding__body">{melding.body}</span>
          <span className="melding__tijd">
            {formatRelatieveTijd(melding.created_at)}
            {!gelezen && <span className="sr-only"> · ongelezen</span>}
          </span>
        </span>
      </button>

      {/* Altijd zichtbaar en niet pas bij hover: op een telefoon bestaat hover
          niet, en dan zou de veeg het enige spoor van deze acties zijn. */}
      <span className="melding__knoppen">
        <button
          type="button"
          className="melding__knop"
          onClick={onWissel}
          aria-label={
            gelezen
              ? `Markeer "${titel}" als ongelezen`
              : `Markeer "${titel}" als gelezen`
          }
        >
          <span className="melding__knop-stip" data-gelezen={gelezen} />
        </button>
        <button
          type="button"
          className="melding__knop"
          onClick={onWeg}
          aria-label={`Leg "${titel}" weg`}
        >
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </span>
    </li>
  );
}

export default MeldingenLijst;
