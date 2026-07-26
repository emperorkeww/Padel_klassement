import { useEffect, useRef } from "react";
import { sweepExpired } from "@/lib/supabase/queryCache";

/**
 * Roept `onFocus` aan zodra de gebruiker terugkeert naar het tabblad/venster
 * (tab weer zichtbaar of window krijgt focus). Handig om data te verversen die
 * ondertussen verouderd kan zijn — zoals de baanbeschikbaarheid van Playtomic.
 *
 * `visibilitychange` en `focus` kunnen samen afgaan bij het terugkeren naar een
 * tab; een korte cooldown voorkomt een dubbele refetch.
 *
 * Meteen het moment om de querycache te vegen (#738): een tab die uren op de
 * achtergrond stond, heeft alleen nog verlopen entries.
 */
export function useRefetchOnFocus(onFocus: () => void, cooldownMs = 2000) {
  const last = useRef(0);

  useEffect(() => {
    const trigger = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - last.current < cooldownMs) return;
      last.current = now;
      sweepExpired();
      onFocus();
    };

    window.addEventListener("focus", trigger);
    document.addEventListener("visibilitychange", trigger);
    return () => {
      window.removeEventListener("focus", trigger);
      document.removeEventListener("visibilitychange", trigger);
    };
  }, [onFocus, cooldownMs]);
}
