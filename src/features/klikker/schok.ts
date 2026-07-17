// Pure schud-wiskunde voor de Sproeier-Modus (#262), los van de DOM zodat de
// drempel-logica unit-testbaar is. Een "schok" is een grote sprong in de
// versnellingsvector tussen twee opeenvolgende devicemotion-samples.

export interface MotionSample {
  x: number;
  y: number;
  z: number;
}

/** Sprong (m/s²) tussen twee samples — de lengte van het verschilvectortje. */
export function deltaMagnitude(vorige: MotionSample, huidige: MotionSample): number {
  const dx = huidige.x - vorige.x;
  const dy = huidige.y - vorige.y;
  const dz = huidige.z - vorige.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/** Standaarddrempel: stevig schudden haalt dit ruim, lopen/tikken niet. */
export const SCHOK_DREMPEL = 18;

export function isSchok(
  vorige: MotionSample,
  huidige: MotionSample,
  drempel: number = SCHOK_DREMPEL,
): boolean {
  return deltaMagnitude(vorige, huidige) >= drempel;
}
