/** Of de gebruiker om minder beweging vraagt. Defensief: omgevingen zonder
 *  matchMedia (oude browsers, jsdom in tests) tellen als "geen voorkeur". */
export function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => unknown;
};

/** Voert `update` uit binnen een view-transition zodat een DOM-wijziging
 *  vloeiend morpht (bv. profielfoto klein ↔ groot, #572). Degradeert veilig:
 *  zonder browser-ondersteuning of bij `prefers-reduced-motion` draait `update`
 *  gewoon direct — ook in jsdom-tests waar de API ontbreekt. */
export function withViewTransition(update: () => void): void {
  const doc = document as ViewTransitionDocument;
  if (prefersReducedMotion() || typeof doc.startViewTransition !== "function") {
    update();
    return;
  }
  doc.startViewTransition(update);
}
