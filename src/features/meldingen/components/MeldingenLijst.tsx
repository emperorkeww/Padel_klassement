import { useNavigate } from "react-router-dom";
import { formatRelatieveTijd } from "@/lib/utils/format";
import { markeerGelezen, type Melding } from "../api";
import "./MeldingenLijst.css";

/**
 * De lijst zelf (#1090), gedeeld door het paneel in de shell en de route
 * /meldingen. Eén component omdat "tikken markeert alléén dit item gelezen en
 * navigeert naar dezelfde url als de push" op beide plekken hetzelfde hoort te
 * werken — en dat is precies het soort regel dat in twee kopieën uit elkaar
 * groeit.
 *
 * Bewust geen soort-labels: de titel zegt al wat er gebeurd is, en een tweede
 * etiket met "poll" of "uitslag" ernaast voegt niets toe aan een regel van drie
 * woorden.
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
      {meldingen.map((m) => (
        <li key={m.id}>
          <button
            type="button"
            className={`melding${m.read_at ? "" : " melding--ongelezen"}`}
            onClick={() => void openMelding(m)}
          >
            {/* De stip is versiering voor wie kijkt; voor wie luistert staat
                "ongelezen" in de tekst hieronder. */}
            <span className="melding__stip" aria-hidden="true" />
            <span className="melding__tekst">
              <span className="melding__titel">{m.title}</span>
              <span className="melding__body">{m.body}</span>
              <span className="melding__tijd">
                {formatRelatieveTijd(m.created_at)}
                {!m.read_at && <span className="sr-only"> · ongelezen</span>}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export default MeldingenLijst;
