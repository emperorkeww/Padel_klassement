/** Of de gebruiker om minder beweging vraagt. Defensief: omgevingen zonder
 *  matchMedia (oude browsers, jsdom in tests) tellen als "geen voorkeur". */
export function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}
