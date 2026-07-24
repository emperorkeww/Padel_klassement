import { useCallback, useEffect, useState } from "react";

type State<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
};

/**
 * Draait een async functie bij mount en wanneer een dependency verandert.
 * Geeft data/loading/error terug plus een reload() om opnieuw te fetchen.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []): State<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  // fn wordt per render opnieuw gemaakt; we hangen bewust aan deps + tick.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fn, deps);

  useEffect(() => {
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
        if (active) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [run, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, error, reload };
}
