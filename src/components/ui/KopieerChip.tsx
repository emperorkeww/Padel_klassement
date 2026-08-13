import { useToast } from "@/ui/ToastProvider";
import { errorMessage } from "@/lib/utils/errors";

/**
 * Een korte waarde die je overtikt als hij niet kopieerbaar is (#1308).
 *
 * De toegangscode van een speeldag stond op twee plekken: op de speeldagpagina
 * als knop die kopieert (#675), en in het agenda-dag-sheet als dode tekst —
 * terwijl je aan de deur van de club juist dát sheet openhebt. Dit is die ene
 * knop, gedeeld.
 *
 * Broertje van [[KopieerVeld]] en bewust niet hetzelfde: dat is een veld met
 * label en knop voor een lange waarde (een uitnodigingslink) die je wil kunnen
 * selecteren. Dit is een pil ter grootte van zijn inhoud, voor iets wat je van
 * je scherm afleest.
 */
export function KopieerChip({
  waarde,
  naam,
  icoon,
  melding,
  className,
}: {
  /** Wat er gekopieerd wordt én zichtbaar staat. */
  waarde: string;
  /** Waar het om gaat, voor de knopnaam: "Toegangscode". */
  naam: string;
  /** Emoji vóór de waarde; puur decoratief. */
  icoon?: string;
  /** Bevestiging na het kopiëren; standaard "<naam> gekopieerd." */
  melding?: string;
  className?: string;
}) {
  const toast = useToast();

  async function kopieer() {
    try {
      await navigator.clipboard.writeText(waarde);
      toast.success(melding ?? `${naam} gekopieerd.`);
    } catch (err) {
      // Klembord geweigerd (http, oude browser): dan blijft de waarde gewoon
      // leesbaar staan — daar was hij toch al voor.
      toast.error(errorMessage(err));
    }
  }

  return (
    <button
      type="button"
      className={`kopieer-chip${className ? ` ${className}` : ""}`}
      onClick={kopieer}
      title="Tik om te kopiëren"
      // Dát een tik kopieert stond ooit alleen in de tooltip (#924); een
      // schermlezer en een vinger hebben allebei niets aan een title.
      aria-label={`${naam} ${waarde} kopiëren`}
    >
      {icoon && <span aria-hidden="true">{icoon}</span>}{" "}
      <strong>{waarde}</strong>
    </button>
  );
}

export default KopieerChip;
