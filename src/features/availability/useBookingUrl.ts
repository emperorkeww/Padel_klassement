import { useEffect, useState } from "react";
import { bookingUrl } from "./api";
import type { Club } from "./club";

// Directe (synchrone) terugval-link: de juiste clubpagina na de
// playtomic.io-redirect, alleen zonder dag-voorvulling. Zo heeft een <a href>
// meteen een geldige waarde terwijl de slug wordt opgehaald.
function fallbackUrl(club: Club): string {
  return `https://playtomic.io/clubs/${club.id}`;
}

/**
 * Reserveerlink voor de knop/anchor: begint bij de terugval-URL en wisselt
 * naar de volledige slug-URL (met ?sport=&date=) zodra die geresolvd is.
 */
export function useBookingUrl(club: Club, date: string): string {
  const [url, setUrl] = useState(() => fallbackUrl(club));
  useEffect(() => {
    let active = true;
    setUrl(fallbackUrl(club));
    bookingUrl(club, date).then((resolved) => {
      if (active) setUrl(resolved);
    });
    return () => {
      active = false;
    };
  }, [club, date]);
  return url;
}
