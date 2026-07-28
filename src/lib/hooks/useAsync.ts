import { useCallback, useEffect, useState } from "react";
import { errorMessage } from "@/lib/utils/errors";

/** Wat useAsync teruggeeft. Geëxporteerd zodat een parent zijn geladen data
 *  als geheel kan doorgeven (bv. GroupDetail → PlanTab, #674). */
export type AsyncState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
};

type State<T> = AsyncState<T>;

export type AsyncOptions = {
  /** Op false wordt er niets opgehaald (data blijft null, loading false) tot
   *  hij op true springt. Voor data die pas nodig is als een tab opengaat
   *  (#674 C2) — zet 'm daarna niet meer terug op false, anders herlaadt hij
   *  bij elke tabwissel. */
  enabled?: boolean;
};

/**
 * Draait een async functie bij mount en wanneer een dependency verandert.
 * Geeft data/loading/error terug plus een reload() om opnieuw te fetchen.
 */
export function useAsync<T>(
  fn: () => Promise<T>,
  deps: unknown[] = [],
  { enabled = true }: AsyncOptions = {},
): State<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  // fn wordt per render opnieuw gemaakt; we hangen bewust aan deps + tick.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fn, deps);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    setLoading(true);
    setError(null);
    run()
      .then((res) => {
        if (active) setData(res);
      })
      .catch((e: unknown) => {
        // Niet elke consument toont de error-state (bv. de editie-context op
        // de FUT-kaart): zonder log was een falende RPC onzichtbaar (#661 —
        // de Zwarte Piet-editie verdween geluidloos toen get_global_zwarte_piet
        // op hosted ontbrak).
        console.warn("useAsync:", e);
        if (active) setError(errorMessage(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [run, tick, enabled]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, error, reload };
}
