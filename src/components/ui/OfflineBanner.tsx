import { useOnlineStatus } from "@/lib/hooks/useOnlineStatus";

/**
 * Smalle strook onder de topbalk wanneer er geen netwerkverbinding is (#462).
 * Verbergt zichzelf zodra de verbinding terug is. De boodschap is bewust
 * geruststellend: een lopend match-concept blijft lokaal bewaard (zie
 * matchDraft), dus de gebruiker raakt niets kwijt.
 */
export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div className="offline-banner" role="status" aria-live="polite">
      <span className="offline-banner__dot" aria-hidden="true" />
      <span>Geen verbinding — je invoer blijft bewaard tot je weer online bent.</span>
    </div>
  );
}

export default OfflineBanner;
