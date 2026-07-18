import { useOnlineStatus } from "@/lib/hooks/useOnlineStatus";
import { useOutboxCount } from "@/features/matches/useOutbox";

/**
 * Smalle strook onder de topbalk (#462). Toont "geen verbinding" wanneer offline
 * en, zolang er nog bewaarde schrijfacties in de wachtrij staan, hoeveel er nog
 * verstuurd moeten worden. Verbergt zich als er verbinding is én de wachtrij
 * leeg is. De toon is geruststellend: een lopend concept blijft lokaal bewaard.
 */
export function OfflineBanner() {
  const online = useOnlineStatus();
  const pending = useOutboxCount();
  if (online && pending === 0) return null;

  const wachtrij =
    pending > 0
      ? ` ${pending} ${pending === 1 ? "wijziging wacht" : "wijzigingen wachten"} op verzending.`
      : "";

  return (
    <div className="offline-banner" role="status" aria-live="polite">
      <span className="offline-banner__dot" aria-hidden="true" />
      <span>
        {online
          ? `Weer verbinding — bewaarde wijzigingen worden verstuurd.${wachtrij}`
          : `Geen verbinding — je invoer blijft bewaard tot je weer online bent.${wachtrij}`}
      </span>
    </div>
  );
}

export default OfflineBanner;
