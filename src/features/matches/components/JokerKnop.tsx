import { Link } from "react-router-dom";
import { useAsync } from "@/lib/hooks/useAsync";
import { useCacheRevision } from "@/lib/hooks/useCacheRevision";
import { MIN_GAMES } from "@/features/matches/stakes";
import { maandLabel } from "@/features/matches/jokers";
import { getMyJokerInMonth } from "@/features/matches/jokersApi";
import { getPlayerRatings } from "@/features/standings/ratingsApi";
import "./JokerKnop.css";

/** De maand waar het tegoed van vandaag in valt (YYYY-MM-01). Bewust de
 *  huidige maand en niet die van een match: deze knop gaat over je voorraad,
 *  niet over één wedstrijd. */
function dezeMaand(now = new Date()): string {
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${now.getFullYear()}-${m}-01`;
}

/**
 * Jokerstatus in de app-shell (#1003): ligt je kaart van deze maand er nog?
 *
 * Vast in de topbalk naast de ?-knop, en op desktop in de zijbalkvoet — één
 * plek, altijd zichtbaar. Zonder deze knop moest je een wedstrijdkaart openen
 * om te weten of je nog iets te vergeven had, en dat is precies de informatie
 * waarop je een speeldag plant.
 *
 * De status staat niet alleen in de kleur maar ook voluit in het aria-label:
 * gevuld/omlijnd is voor wie kijkt, de tekst voor wie luistert of geen kleur
 * ziet. Faalt de query (offline), dan valt de knop stil in plaats van de hele
 * shell in een foutstatus te trekken.
 */
export function JokerKnop({
  /** Ingelogde speler; zonder gebruiker valt er niets te tonen. */
  myId,
  className = "",
}: {
  myId: string | null;
  className?: string;
}) {
  const maand = dezeMaand();
  const rev = useCacheRevision("match-jokers");
  const eigen = useAsync(
    () =>
      myId
        ? getMyJokerInMonth(myId, maand).catch(() => null)
        : Promise.resolve(null),
    [myId, maand, rev],
  );
  // Gedeelde, gecachte ratings — dezelfde query die het klassement en de
  // matchkaarten al doen, dus in de praktijk één verzoek per sessie. Faalt hij,
  // dan tonen we géén slotje: liever een kaart beloven die de tegel alsnog
  // weigert dan een drempel suggereren die er misschien niet is.
  const ratings = useAsync(() => getPlayerRatings().catch(() => null), []);

  // Uitgelogd of nog aan het laden: niets renderen. Een placeholder zou bij
  // elke navigatie een lege plek laten verspringen.
  if (!myId || eigen.data == null) return null;

  const gespeeld = eigen.data.length > 0;
  const games = ratings.data ? (ratings.data[myId]?.games ?? 0) : MIN_GAMES;
  // Onder de drempel kun je alleen van kant wisselen; dat is geen "kaart klaar"
  // in de zin waarin de rest van de app het woord gebruikt, dus een eigen
  // toestand in plaats van een groene vlag die te veel belooft.
  const vroeg = !gespeeld && games < MIN_GAMES;
  const label = gespeeld
    ? `Joker van ${maandLabel(maand)} is gespeeld`
    : vroeg
      ? `Joker van ${maandLabel(maand)}: alleen van kant wisselen — schild en dubbel of niets vanaf ${MIN_GAMES} matches`
      : `Joker van ${maandLabel(maand)} ligt klaar`;

  return (
    <Link
      to="/profiel#jokers"
      className={`joker-knop ${
        gespeeld
          ? "joker-knop--op"
          : vroeg
            ? "joker-knop--vroeg"
            : "joker-knop--klaar"
      } ${className}`.trim()}
      aria-label={label}
      title={label}
    >
      <span aria-hidden="true">{vroeg ? "🔒" : "🃏"}</span>
    </Link>
  );
}

export default JokerKnop;
