// Crashes zichtbaar maken (#733).
//
// Tot nu toe was een crash volledig geruisloos: geen Sentry, geen listeners,
// twee console-aanroepen in de hele frontend. Gebeurde er iets, dan hoorde
// niemand het en dacht de gebruiker gewoon dat de app stuk was.
//
// Dit is bewust geen error-tracking-platform: één POST naar de eigen Cloudflare
// Worker, die er een logregel van maakt. Geen migratie, geen anon-insert-RLS
// als spamdoelwit, en de Worker rolt sowieso mee met elke deploy.
//
// Een ErrorBoundary vangt alleen fouten tijdens render. Wat hier bijkomt zijn
// juist de andere twee: fouten in event-handlers (window "error") en afgewezen
// promises (unhandledrejection).

import { isChunkLoadError } from "@/lib/utils/chunkError";

const ENDPOINT = "/api/client-error";

/** Ruim genoeg om een echte crash te vangen, klein genoeg om nooit een
 *  probleem op zich te worden. De Worker kapt hier ook op af. */
const MAX_STACK = 1500;

/** Eén kapotte render kan in een lus terechtkomen; dan wil je niet honderden
 *  verzoeken. Vijf meldingen per sessie zegt genoeg. */
const MAX_PER_SESSIE = 5;

const SESSIE_SLEUTEL = "vamos:sessie";

let verstuurd = 0;
const gezien = new Set<string>();

/** Een willekeurige, niet-herleidbare id om meldingen uit dezelfde sessie aan
 *  elkaar te knopen. Bewust géén user-id of e-mail: voor debuggen is "dezelfde
 *  tab" genoeg, en dan hoeft er geen persoonsgegeven de deur uit. */
function sessieId(): string {
  try {
    const bestaand = sessionStorage.getItem(SESSIE_SLEUTEL);
    if (bestaand) return bestaand;
    const nieuw = Math.random().toString(36).slice(2, 10);
    sessionStorage.setItem(SESSIE_SLEUTEL, nieuw);
    return nieuw;
  } catch {
    return "onbekend";
  }
}

export interface FoutMelding {
  /** Waar de fout vandaan kwam. */
  bron: "render" | "window" | "promise";
  bericht: string;
  stack?: string;
  /** Alleen bij "render": de componentboom uit componentDidCatch. */
  componentStack?: string;
  /** Alleen bij "render": welke foutgrens hem ving. */
  scope?: string;
}

function stuur(body: string): void {
  try {
    const blob = new Blob([body], { type: "application/json" });
    if (navigator.sendBeacon?.(ENDPOINT, blob)) return;
  } catch {
    /* geen sendBeacon (of geblokkeerd): via fetch proberen */
  }
  void fetch(ENDPOINT, {
    method: "POST",
    body,
    // keepalive: de melding moet ook aankomen als de pagina meteen daarna
    // herladen of gesloten wordt.
    keepalive: true,
    headers: { "content-type": "application/json" },
  }).catch(() => {
    /* rapporteren mag nooit zelf een fout opleveren */
  });
}

/** Meld één fout. Dedupliceert op bron + bericht (dat vangt meteen de dubbele
 *  render van StrictMode af) en stopt na MAX_PER_SESSIE. */
export function meldFout(melding: FoutMelding): void {
  const sleutel = `${melding.bron}|${melding.bericht}`;
  if (gezien.has(sleutel) || verstuurd >= MAX_PER_SESSIE) return;
  gezien.add(sleutel);
  verstuurd++;

  const payload = {
    bron: melding.bron,
    bericht: melding.bericht.slice(0, 500),
    stack: melding.stack?.slice(0, MAX_STACK),
    componentStack: melding.componentStack?.slice(0, MAX_STACK),
    scope: melding.scope,
    // Een verdwenen chunk is verwacht gedrag na een deploy, geen bug. Apart
    // labelen zodat het de echte crashes in het log niet ondersneeuwt.
    chunk: isChunkLoadError(melding.bericht),
    pad: location.pathname,
    build: __BUILD__,
    sessie: sessieId(),
    ua: navigator.userAgent.slice(0, 200),
  };

  if (!import.meta.env.PROD) {
    console.error("[fout]", payload);
    return;
  }
  stuur(JSON.stringify(payload));
}

/** Koppelt de globale listeners. Geeft een opruimfunctie terug. */
export function initFoutrapportage(): () => void {
  const opFout = (e: ErrorEvent) => {
    // Een mislukte <img>/<script> vuurt hetzelfde event, maar met het element
    // als target. Dat is geen crash. Op het element testen en niet op
    // `target !== window`: die vergelijking is niet betrouwbaar zodra window
    // via een proxy loopt (o.a. in jsdom).
    if (e.target instanceof Element) return;
    if (!e.message && !e.error) return;
    meldFout({
      bron: "window",
      bericht: e.message || String(e.error),
      stack: e.error instanceof Error ? e.error.stack : undefined,
    });
  };
  const opRejectie = (e: PromiseRejectionEvent) => {
    const reden: unknown = e.reason;
    meldFout({
      bron: "promise",
      bericht: reden instanceof Error ? reden.message : String(reden),
      stack: reden instanceof Error ? reden.stack : undefined,
    });
  };

  window.addEventListener("error", opFout);
  window.addEventListener("unhandledrejection", opRejectie);
  return () => {
    window.removeEventListener("error", opFout);
    window.removeEventListener("unhandledrejection", opRejectie);
  };
}
