// Wildheid van het tekenen (#263): tekensnelheid → pen-intensiteit 0..1, met
// exponentiële smoothing zodat het geluid niet klappert op elk pointer-event.
// Puur, zodat de mapping unit-testbaar is.

/** Smoothing-factor: hoger = reageert sneller, klappert meer. */
export const WILD_ALPHA = 0.3;

/** Tekensnelheid (px/ms) waarop de pen op vol volume zit. */
export const WILD_VOL_BIJ = 2;

/**
 * Volgende gesmoothde intensiteit op basis van het laatste tekensegment.
 * `vorige` is de vorige uitkomst (0 aan het begin van een stroke).
 */
export function wildheid(
  afstandPx: number,
  dtMs: number,
  vorige: number,
  alpha: number = WILD_ALPHA,
): number {
  const snelheid = dtMs > 0 ? afstandPx / dtMs : 0;
  const doel = Math.min(1, snelheid / WILD_VOL_BIJ);
  return vorige + alpha * (doel - vorige);
}
