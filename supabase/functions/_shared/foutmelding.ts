// Een crashmelding uit de browser omzetten naar een databankrij (#1049).
//
// Zelfde opzet als cronAuth.ts en cronGezondheid.ts: pure functies zonder
// Deno-globals of clients, zodat de randgevallen met Vitest vast te zetten zijn.
// En randgevallen zíjn er, want dit endpoint is publiek en ongeauthenticeerd —
// wat hier binnenkomt is nooit te vertrouwen.
//
// Wat er tot nu toe gebeurde (#733): `console.error("client-error", melding)`
// in de Worker, en verder niets. Zichtbaar in een live `wrangler tail`, weg voor
// wie een uur later kijkt. We hadden foutrapportage gebouwd en de rapporten
// weggegooid.

/** De vorm die src/lib/utils/errorReport.ts verstuurt. */
export interface BinnenkomendeFout {
  bron?: unknown;
  bericht?: unknown;
  stack?: unknown;
  componentStack?: unknown;
  scope?: unknown;
  chunk?: unknown;
  pad?: unknown;
  build?: unknown;
  sessie?: unknown;
  ua?: unknown;
}

/** Eén rij in public.client_errors. */
export interface FoutRij {
  bron: string;
  bericht: string;
  stack: string | null;
  component_stack: string | null;
  scope: string | null;
  chunk: boolean;
  pad: string | null;
  build: string | null;
  sessie: string | null;
  user_agent: string | null;
}

/**
 * Bovengrenzen per kolom. De client kapt zelf al af (MAX_STACK = 1500) en de
 * Worker kapt de hele body af op 8 kB, maar geen van beide is een garantie:
 * dit endpoint is publiek, dus wie het rechtstreeks aanroept stuurt wat hij wil.
 * Afkappen hier is de enige plek die telt.
 */
const GRENZEN = {
  bron: 20,
  bericht: 500,
  stack: 4000,
  component_stack: 4000,
  scope: 100,
  pad: 300,
  build: 100,
  sessie: 50,
  user_agent: 300,
} as const;

/** Alleen de drie bronnen die errorReport.ts kent; al het andere is "onbekend". */
const BRONNEN = ["render", "window", "promise"];

/** Korte velden: witruimte eromheen weg. Op `bericht` wordt gegroepeerd, dus
 *  "kapot" en " kapot" mogen niet als twee verschillende fouten eindigen. */
function tekst(waarde: unknown, grens: number): string | null {
  if (typeof waarde !== "string") return null;
  const schoon = waarde.trim();
  if (schoon === "") return null;
  return schoon.slice(0, grens);
}

/** Stacktraces: alleen op leegte toetsen, nooit trimmen. React's
 *  componentStack begint met een newline en leunt op zijn inspringing; die
 *  eraf halen maakt hem een stuk minder leesbaar in het paneel. */
function blok(waarde: unknown, grens: number): string | null {
  if (typeof waarde !== "string") return null;
  if (waarde.trim() === "") return null;
  return waarde.slice(0, grens);
}

/**
 * Zet een binnengekomen JSON-body om in een rij, of geeft `null` als er geen
 * bruikbare melding in zit.
 *
 * Een melding zonder `bericht` is waardeloos: daarop wordt gegroepeerd, dus
 * zonder dat veld levert het alleen een rij op die het logboek vervuilt. Dat is
 * de enige harde eis.
 */
export function naarFoutRij(body: unknown): FoutRij | null {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return null;
  }
  const b = body as BinnenkomendeFout;

  const bericht = tekst(b.bericht, GRENZEN.bericht);
  if (bericht === null) return null;

  const bron = tekst(b.bron, GRENZEN.bron);

  return {
    bron: bron !== null && BRONNEN.includes(bron) ? bron : "onbekend",
    bericht,
    stack: blok(b.stack, GRENZEN.stack),
    component_stack: blok(b.componentStack, GRENZEN.component_stack),
    scope: tekst(b.scope, GRENZEN.scope),
    // Een verdwenen chunk is verwacht gedrag na een deploy, geen bug (#733).
    // Apart gemarkeerd zodat het de echte crashes niet ondersneeuwt.
    chunk: b.chunk === true,
    pad: tekst(b.pad, GRENZEN.pad),
    build: tekst(b.build, GRENZEN.build),
    sessie: tekst(b.sessie, GRENZEN.sessie),
    user_agent: tekst(b.ua, GRENZEN.user_agent),
  };
}
