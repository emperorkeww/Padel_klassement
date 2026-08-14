// Clubs zoeken op naam zonder zoek-API (#391).
//
// Sinds de migratie naar playtomic.com (#385) bestaat er geen JSON-zoekendpoint
// meer: het oude `api.playtomic.io/v1/tenants?tenant_name=…&country_code=BE`
// geeft 403 en playtomic.com/api kent geen zoekroute (404 op /api/tenants,
// /api/search, /api/clubs/search).
//
// Wat wél bestaat is de publieke zoekpagina playtomic.com/search?q=… — een
// Next-app. Met de header `RSC: 1` geeft diezelfde URL de flight-payload
// (text/x-component, ~80 kB) in plaats van ~224 kB HTML, en dáárin staat de
// serverdata onversleuteld en onge-escaped:
//
//   "component":"club_search_results", … "__blokData":{"clubs":[
//     {"id":"91d8…","name":"LAGO CLUB Padel Beveren","slug":"lago-club-padel-beveren",
//      "country_code":"BE","address":{"street":"…","postal_code":"9120"},"images":[…]}
//   ]}
//
// Dat is geen contract — het is de interne payload van hun website. Deze parser
// gaat er dus vanuit dat hij ooit breekt en faalt dan leeg (geen treffers) in
// plaats van luid: een kapotte zoekfunctie mag de rest van de clubkiezer
// (thuisclub, recente clubs, handmatige locatie) niet meeslepen.
//
// Bewust Deno-vrij en zonder netwerkcode: de edge function (club-search), de
// Vite-dev-middleware én vitest delen deze module.

/** Eén club uit de zoekresultaten. Alles wat de payload biedt, niets meer. */
export type PlaytomicClub = {
  /** Tenant-id — hetzelfde id als in het availability-endpoint. */
  id: string;
  name: string;
  /** Canonieke slug voor de clubpagina-URL. */
  slug: string;
  /** ISO-landcode, bv. "BE". */
  countryCode: string;
  /** Straat + nummer; leeg als de payload het niet meegeeft. */
  street: string;
  /** Postcode; leeg als de payload het niet meegeeft. */
  postalCode: string;
};

const ZOEK_HOST = "https://playtomic.com/search";

/**
 * Headers die de zoekpagina de RSC-payload laten teruggeven in plaats van HTML.
 * Zonder `RSC: 1` krijg je de volledige pagina; met de header antwoordt Next
 * met een 307 naar `…&_rsc` en daarna text/x-component (fetch volgt die zelf).
 */
export const ZOEK_HEADERS = {
  RSC: "1",
  "Accept-Language": "nl-BE,nl;q=0.9,en;q=0.8",
};

/** Maximale lengte van een zoekterm; langer is geen zoekopdracht meer. */
export const ZOEK_MAX_LENGTE = 60;
/** Onder de twee tekens is de trefferlijst zinloos groot. */
export const ZOEK_MIN_LENGTE = 2;

const LAND_HINT = "belgium";
// Geen sluitende \b: "belgië" eindigt op een letter die JS niet als woordteken
// ziet, waardoor de grens nooit matcht.
const LAND_AL_GENOEMD = /\bbelg(i[eë]|ium|ian|ique)/i;

/**
 * Zoekterm zoals hij naar Playtomic gaat.
 *
 * De landparameter van het oude endpoint (`country_code=BE`) bestaat niet meer,
 * en dat is geen detail: de zoekpagina geeft maximaal 30 treffers terug, op
 * naamrelevantie en wereldwijd. Op "hangar" zat er precies één Belgische club
 * tussen twaalf Italiaanse, Spaanse en Emiratische naamgenoten — een
 * client-side BE-filter houdt daar bijna niets van over.
 *
 * Het land als woord aan de zoekterm plakken werkt wél als filter: "hangar
 * belgium" gaf 20 Belgische clubs, bovenaan. Dat is een eigenschap van hun
 * zoekindex (adres telt mee), geen gedocumenteerde parameter — vandaar dat het
 * BE-filter in `belgischeClubs` als vangnet blijft staan.
 */
export function zoekterm(vraag: string): string {
  const schoon = vraag.trim().replace(/\s+/g, " ");
  // Wie zelf al "België" typt, krijgt het er niet nog eens bij.
  return LAND_AL_GENOEMD.test(schoon) ? schoon : `${schoon} ${LAND_HINT}`;
}

/** Volledige zoek-URL voor een (rauwe) vraag van de gebruiker. */
export function zoekUrl(vraag: string): string {
  return `${ZOEK_HOST}?q=${encodeURIComponent(zoekterm(vraag))}`;
}

/**
 * Index van het teken dat het haakje op `start` sluit, of -1.
 * String-bewust, want clubnamen mogen haakjes bevatten ("Padel (Oost)").
 */
function sluitHaakje(tekst: string, start: number): number {
  const open = tekst[start];
  const dicht = open === "[" ? "]" : "}";
  let diepte = 0;
  let inString = false;
  for (let i = start; i < tekst.length; i++) {
    const teken = tekst[i];
    if (inString) {
      if (teken === "\\") i++;
      else if (teken === '"') inString = false;
      continue;
    }
    if (teken === '"') inString = true;
    else if (teken === open) diepte++;
    else if (teken === dicht && --diepte === 0) return i;
  }
  return -1;
}

/** Rauw object uit de payload → PlaytomicClub, of null als het geen club is. */
function alsClub(rij: unknown): PlaytomicClub | null {
  if (!rij || typeof rij !== "object") return null;
  const o = rij as Record<string, unknown>;
  const adres = (o.address ?? {}) as Record<string, unknown>;
  if (
    typeof o.id !== "string" ||
    typeof o.name !== "string" ||
    typeof o.slug !== "string" ||
    !o.id ||
    !o.name
  ) {
    return null;
  }
  return {
    id: o.id,
    name: o.name.trim(),
    slug: o.slug,
    countryCode:
      typeof o.country_code === "string" ? o.country_code.toUpperCase() : "",
    street: typeof adres.street === "string" ? adres.street : "",
    postalCode: typeof adres.postal_code === "string" ? adres.postal_code : "",
  };
}

/**
 * Haalt de clubs uit een zoek-payload. Leeg bij een payload die we niet
 * herkennen — de aanroeper vertaalt dat naar "geen treffers", niet naar een
 * storing die de hele kiezer blokkeert.
 *
 * Werkt zowel op de RSC-payload (onge-escaped) als op de HTML-variant, waar
 * dezelfde JSON in een `self.__next_f.push(…)`-script staat met ge-escapete
 * aanhalingstekens.
 */
export function parseClubs(payload: string): PlaytomicClub[] {
  const clubs = uitBlokData(payload);
  if (clubs.length > 0) return clubs;
  // HTML-variant: dezelfde JSON, maar als string-literal in een script.
  if (payload.includes('\\"clubs\\":')) {
    return uitBlokData(payload.replace(/\\"/g, '"'));
  }
  return [];
}

function uitBlokData(payload: string): PlaytomicClub[] {
  const gevonden: PlaytomicClub[] = [];
  const gezien = new Set<string>();
  const merk = '"clubs":';
  for (let i = payload.indexOf(merk); i !== -1; i = payload.indexOf(merk, i + 1)) {
    const start = payload.indexOf("[", i + merk.length);
    // Alleen als het haakje direct volgt hoort het bij deze sleutel.
    if (start === -1 || payload.slice(i + merk.length, start).trim() !== "") {
      continue;
    }
    const eind = sluitHaakje(payload, start);
    if (eind === -1) continue;
    let rijen: unknown;
    try {
      rijen = JSON.parse(payload.slice(start, eind + 1));
    } catch {
      continue;
    }
    if (!Array.isArray(rijen)) continue;
    for (const rij of rijen) {
      const club = alsClub(rij);
      if (club && !gezien.has(club.id)) {
        gezien.add(club.id);
        gevonden.push(club);
      }
    }
  }
  return gevonden;
}

/**
 * Vangnet op de landhint uit `zoekterm`: alleen Belgische clubs, in de volgorde
 * waarin Playtomic ze relevant vond, afgekapt op `limiet`.
 */
export function belgischeClubs(
  clubs: PlaytomicClub[],
  limiet = 10,
): PlaytomicClub[] {
  return clubs.filter((c) => c.countryCode === "BE").slice(0, limiet);
}
