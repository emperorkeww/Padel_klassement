import type { Club } from "../club";
import { useBookingUrl } from "../useBookingUrl";
import "@/features/availability/Availability.css";

/**
 * Degradatiekaart (#405): Playtomic is niet bereikbaar en er ligt geen
 * snapshot als vangnet. In plaats van een kaal foutbericht een eerlijke lege
 * staat mét de werkende reserveerlink — de clubpagina zelf gaat niet door de
 * WAF en doet het dus ook tijdens een blokkade.
 */
export function AvailabilityUnavailable({
  club,
  date,
  message,
}: {
  club: Club;
  date: string;
  message: string;
}) {
  const bookHref = useBookingUrl(club, date);
  return (
    <div className="avail-unavailable" role="alert">
      <p className="avail-unavailable__title">
        Beschikbaarheid nu niet op te halen
      </p>
      <p className="avail-unavailable__msg">{message}</p>
      <a href={bookHref} target="_blank" rel="noopener noreferrer">
        Bekijk beschikbaarheid op Playtomic →
      </a>
    </div>
  );
}
