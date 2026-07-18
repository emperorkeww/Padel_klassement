import { useEffect, useState } from "react";
import { flush, getCount, subscribe } from "@/features/matches/outbox";
import { useToast } from "@/ui/ToastProvider";
import { errorMessage } from "@/lib/utils/errors";

/**
 * Mount dit één keer hoog in de ingelogde boom (#462): het leegt de outbox bij
 * het opstarten (het `online`-event wordt gemist als de tab dicht was) én bij
 * elke herverbinding. De flush draait in de paginacontext omdat hij de
 * geauthenticeerde Supabase-client nodig heeft.
 */
export function useOutboxFlush(): void {
  const toast = useToast();
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const { sent, dropped } = await flush();
      if (cancelled) return;
      for (const d of dropped) {
        toast.error(
          `Een bewaarde match kon niet verstuurd worden: ${errorMessage(d.error)}`,
        );
      }
      if (sent > 0) {
        toast.success(
          sent === 1
            ? "Je bewaarde match is alsnog verstuurd."
            : `${sent} bewaarde matches zijn alsnog verstuurd.`,
        );
      }
    };
    void run(); // flush bij opstarten
    const onOnline = () => void run();
    window.addEventListener("online", onOnline);
    return () => {
      cancelled = true;
      window.removeEventListener("online", onOnline);
    };
  }, [toast]);
}

/** Aantal nog te versturen schrijfacties in de outbox, live (#462). */
export function useOutboxCount(): number {
  const [count, setCount] = useState(() => getCount());
  useEffect(() => {
    setCount(getCount());
    return subscribe(setCount);
  }, []);
  return count;
}
