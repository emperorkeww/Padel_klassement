// De route-logica van de agenda-feed (#1099), los van Deno en van de
// supabase-client. Gebruikt enkel web-standaard `URL`/`Response`, zodat ze
// unit-testbaar is — zelfde reden als bij cronAuth.ts (#460).

import { banenLabel, icsFeed, type FeedEvent } from "./ics.ts";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Naam van het abonnement zoals de agenda-app hem toont. */
export const KALENDER_NAAM = "Padel — jouw speeldagen";

/** Wat calendar_feed_events per speeldag teruggeeft. */
export type FeedRij = {
  poll_id: string;
  group_name: string;
  club_name: string;
  club_city: string | null;
  courts: string | null;
  duration: number;
  starts_at: string;
  changed_at: string;
};

/**
 * Het token uit /functions/v1/calendar-feed/<token>.ics — de extensie is
 * optioneel. Strikte UUID-validatie vóór er iets met de database gebeurt: het
 * token is de hele afscherming, dus alles wat er niet als één uitziet gaat er
 * hier al uit.
 */
export function tokenUitPad(url: string): string | null {
  const laatste = new URL(url).pathname.split("/").filter(Boolean).pop() ?? "";
  const token = laatste.replace(/\.ics$/i, "");
  return UUID_RE.test(token) ? token : null;
}

/** SEQUENCE uit de laatste wijziging: hele minuten sinds epoch. Spiegel van
 *  minuutStempel in src/lib/utils/ics.ts. */
export function minuutStempel(moment: string): number {
  return Math.max(0, Math.floor(new Date(moment).getTime() / 60_000));
}

export function naarEvent(rij: FeedRij): FeedEvent {
  const details = [rij.group_name, rij.courts ? banenLabel(rij.courts) : null]
    .filter(Boolean)
    .join(" · ");
  return {
    // Dezelfde UID als de losse download uit de app: staan ze ooit in dezelfde
    // agenda, dan vallen ze samen in plaats van te verdubbelen.
    uid: `speeldag-${rij.poll_id}@vamos-padel`,
    title: `Padel: ${rij.group_name}`,
    description: details,
    location: [rij.club_name, rij.club_city].filter(Boolean).join(", "),
    startsAt: rij.starts_at,
    durationMin: rij.duration,
    sequence: minuutStempel(rij.changed_at),
  };
}

/**
 * Eén antwoord voor alles wat geen geldige, lopende feed is: een verminkt
 * token, een onbekend token en een ingetrokken token zijn van buitenaf niet uit
 * elkaar te houden.
 */
export function nietGevonden(): Response {
  return new Response("Not Found", {
    status: 404,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

/**
 * De kalender als HTTP-antwoord. `rijen` null betekent onbekend of ingetrokken
 * token; een lege lijst is een geldige, lege kalender — dat is het verschil
 * tussen "deze link bestaat niet" en "er staat even niets gepland".
 */
export function feedRespons(
  rijen: FeedRij[] | null,
  opties: { head?: boolean; now?: Date } = {},
): Response {
  if (rijen == null) return nietGevonden();

  const ics = icsFeed(KALENDER_NAAM, rijen.map(naarEvent), opties.now);
  return new Response(opties.head ? null : ics, {
    status: 200,
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": 'inline; filename="padel.ics"',
      // Privé: dit is één persoon zijn agenda, geen pagina voor een CDN. Een
      // half uur voorkomt dat een app die agressief polst elke keer de hele
      // query trekt.
      "cache-control": "private, max-age=1800",
    },
  });
}
