import { useCallback, useEffect, useRef, useState } from "react";
import { isSchok, SCHOK_DREMPEL, type MotionSample } from "./schok";

// Schud-detectie voor de Sproeier-Modus (#262). Drie werelden:
//   - Android/oudere iOS: devicemotion werkt direct → "actief".
//   - iOS 13+: DeviceMotionEvent.requestPermission() bestaat en MOET vanuit een
//     tap-handler worden aangeroepen (en alleen op HTTPS) → "toestemming-nodig"
//     tot de gebruiker de knop indrukt. Een weigering is zonder Safari-reset
//     definitief → "geweigerd".
//   - Desktop/jsdom: geen DeviceMotionEvent → "niet-ondersteund".

export type ShakeStatus =
  | "actief"
  | "toestemming-nodig"
  | "geweigerd"
  | "niet-ondersteund";

type MetPermissie = typeof DeviceMotionEvent & {
  requestPermission?: () => Promise<"granted" | "denied">;
};

export function useShake(
  onShake: () => void,
  { drempel = SCHOK_DREMPEL, cooldownMs = 4000 }: { drempel?: number; cooldownMs?: number } = {},
): { status: ShakeStatus; vraagToestemming: () => Promise<void> } {
  const [status, setStatus] = useState<ShakeStatus>(() => {
    if (typeof window === "undefined" || typeof window.DeviceMotionEvent !== "function") {
      return "niet-ondersteund";
    }
    const DM = window.DeviceMotionEvent as MetPermissie;
    return typeof DM.requestPermission === "function" ? "toestemming-nodig" : "actief";
  });

  // De callback in een ref, zodat een nieuwe closure per render de listener
  // niet steeds af- en aankoppelt.
  const onShakeRef = useRef(onShake);
  onShakeRef.current = onShake;

  useEffect(() => {
    if (status !== "actief") return;
    let vorige: MotionSample | null = null;
    // -Infinity: de allereerste schok mag altijd, ook vlak na page-load.
    let laatste = -Infinity;
    const handler = (e: DeviceMotionEvent) => {
      const a = e.accelerationIncludingGravity;
      if (!a || a.x == null || a.y == null || a.z == null) return;
      const huidige = { x: a.x, y: a.y, z: a.z };
      if (vorige && isSchok(vorige, huidige, drempel)) {
        const nu = performance.now();
        if (nu - laatste >= cooldownMs) {
          laatste = nu;
          onShakeRef.current();
        }
      }
      vorige = huidige;
    };
    window.addEventListener("devicemotion", handler);
    return () => window.removeEventListener("devicemotion", handler);
  }, [status, drempel, cooldownMs]);

  const vraagToestemming = useCallback(async () => {
    const DM = window.DeviceMotionEvent as MetPermissie | undefined;
    if (!DM || typeof DM.requestPermission !== "function") return;
    try {
      setStatus((await DM.requestPermission()) === "granted" ? "actief" : "geweigerd");
    } catch {
      // Buiten een user-gesture of op HTTP gooit Safari — behandel als geweigerd.
      setStatus("geweigerd");
    }
  }, []);

  return { status, vraagToestemming };
}
