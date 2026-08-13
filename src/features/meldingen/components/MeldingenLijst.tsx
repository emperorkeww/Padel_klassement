import { useNavigate } from "react-router-dom";
import { formatRelatieveTijd } from "@/lib/utils/format";
import { markeerGelezen, type Melding } from "../api";
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
 * regel lijken klopte niet: de linkerrand liep rafelig door de emoji uit de
 * servertitels, en vier ongelezen rijen tussen tien gelezen vielen weg.
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
      // Stil: je bent al onderweg naar het scherm. De stip blijft staan, en dat
      // is eerlijker dan een foutmelding op een scherm dat je net verliet.
    }
  }

  return (
    <ul className="meldingen__lijst">
      {meldingen.map((m) => {
        const { icoon: Icoon, familie, label } = soortInfo(m.soort);
        const titel = zonderEmoji(m.title);
        // "VAR: VAR: er wordt een punt betwist" — sommige titels noemen hun
        // soort zelf al. Dan zegt het icoon genoeg en hoeft de voorleesregel
        // het niet te herhalen.
        const noemtZichzelf = titel.toLowerCase().startsWith(label.toLowerCase());
        return (
        <li key={m.id}>
          <button
            type="button"
            className={`melding${m.read_at ? "" : " melding--ongelezen"}`}
            onClick={() => void openMelding(m)}
          >
            {/* Het icoon is versiering voor wie kijkt; voor wie luistert staat
                de soort in de tekst hieronder, net als "ongelezen". De vaste
                kolom houdt de linkerrand recht, wat de servertitel ook doet. */}
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
              <span className="melding__body">{m.body}</span>
              <span className="melding__tijd">
                {formatRelatieveTijd(m.created_at)}
                {!m.read_at && <span className="sr-only"> · ongelezen</span>}
              </span>
            </span>
          </button>
        </li>
        );
      })}
    </ul>
  );
}

export default MeldingenLijst;
