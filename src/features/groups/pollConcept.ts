import type { NewPollOption } from "@/features/groups/pollsApi";

/**
 * Het concept van een poll-wizard (#1271).
 *
 * De wizard heeft een knop "Verken alle vrije banen →" die pal naast de slots
 * staat die je net aantikte. Die navigeert de app uit de agenda weg, het sheet
 * unmount, en je hele selectie was daarmee weg. De prop `storageKey` bestond
 * al om dat op te vangen, maar geen enkele caller zette hem — de hele tak was
 * dode code, en zelfs mét die sleutel kwam het sheet na de omweg niet terug.
 *
 * Vandaar dit bestand: één plek die zegt wat er bewaard wordt en onder welke
 * sleutel. De sleutelnaam draagt de context (groep + dag), zodat de agenda bij
 * terugkomst weet wélke wizard hij moet heropenen zonder dat er een tweede
 * schrijver op dezelfde opslag komt.
 *
 * sessionStorage en niet localStorage: dit hoort bij dit tabblad en deze
 * omweg, niet bij het apparaat. Sluit je het tabblad, dan is het concept weg —
 * precies zoals een halfafgemaakt formulier hoort te vervallen.
 */

export const CONCEPT_PREFIX = "vamos:poll-concept:";

/** De stand van de wizard, zoals hij tussen twee pagina's bewaard wordt. */
export type PollConcept = {
  /** De aangetikte momenten, op `optKey`. */
  picked: Record<string, NewPollOption>;
  /** De dag die in de navigator openstaat. */
  selectedDay: string;
  /** Gekozen duur in minuten. */
  duration: number;
  /** Toont het raster de hele dag in plaats van alleen de avond? */
  wholeDay: boolean;
  /** Staat het handmatige paneel open, en wat staat erin? */
  manualOpen: boolean;
  manualDate: string;
  manualTime: string;
};

/** De context die in de sleutelnaam zit: voor welke groep en welke dag. */
export type ConceptContext = { groupId: string; initialDay: string | null };

/** `vamos:poll-concept:<groupId>:<dag>` — dag leeg als de wizard zonder dag opende. */
export function conceptSleutel(
  groupId: string,
  initialDay?: string | null,
): string {
  return `${CONCEPT_PREFIX}${groupId}:${initialDay ?? ""}`;
}

/** De context terug uit een sleutelnaam, of null als hij niet klopt. */
export function contextVanSleutel(sleutel: string): ConceptContext | null {
  if (!sleutel.startsWith(CONCEPT_PREFIX)) return null;
  const rest = sleutel.slice(CONCEPT_PREFIX.length);
  const scheiding = rest.indexOf(":");
  if (scheiding <= 0) return null;
  const dag = rest.slice(scheiding + 1);
  return { groupId: rest.slice(0, scheiding), initialDay: dag || null };
}

export function leesConcept(sleutel: string): PollConcept | null {
  try {
    const raw = sessionStorage.getItem(sleutel);
    if (!raw) return null;
    const c = JSON.parse(raw) as PollConcept;
    // Alleen een concept mét selectie is er een: zonder aangetikte momenten
    // valt er niets te herstellen, en zou de agenda een leeg sheet heropenen.
    return c && typeof c === "object" && c.picked && Object.keys(c.picked).length > 0
      ? c
      : null;
  } catch {
    /* ongeldige of onbeschikbare opslag → verse start */
    return null;
  }
}

export function bewaarConcept(sleutel: string, concept: PollConcept): void {
  try {
    sessionStorage.setItem(sleutel, JSON.stringify(concept));
  } catch {
    /* opslag niet beschikbaar — geen probleem */
  }
}

export function wisConcept(sleutel: string): void {
  try {
    sessionStorage.removeItem(sleutel);
  } catch {
    /* idem */
  }
}

/**
 * Het openstaande concept van dit tabblad, als er een is.
 *
 * De agenda gebruikt dit bij het opbouwen van de pagina: staat er nog een
 * wizard met een selectie in, dan hoort die weer open te gaan — je kwam net
 * terug van de banenpagina en je keuzes horen er nog te staan.
 */
export function openstaandConcept(): ConceptContext | null {
  try {
    for (let i = 0; i < sessionStorage.length; i++) {
      const sleutel = sessionStorage.key(i);
      if (sleutel == null) continue;
      const context = contextVanSleutel(sleutel);
      if (context && leesConcept(sleutel)) return context;
    }
  } catch {
    /* opslag niet beschikbaar */
  }
  return null;
}
