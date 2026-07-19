import { useEffect, useRef, useSyncExternalStore } from "react";
import { useToast } from "@/ui/ToastProvider";
import {
  applyUpdate,
  getSwUpdateSnapshot,
  subscribeSwUpdate,
} from "@/lib/utils/swUpdate";

/** Toont één zachte, tikbare toast wanneer een nieuwe app-versie klaarstaat
 *  (#463). Tikken activeert de wachtende service worker; die herlaadt de
 *  pagina daarna gecontroleerd via controllerchange. Rendert zelf niets. */
export function SwUpdatePrompt() {
  const toast = useToast();
  const updateAvailable = useSyncExternalStore(
    subscribeSwUpdate,
    getSwUpdateSnapshot,
    () => false,
  );
  // Eén keer tonen: de toast is vluchtig, maar we willen hem niet bij elke
  // re-render opnieuw opstapelen.
  const shown = useRef(false);

  useEffect(() => {
    if (!updateAvailable || shown.current) return;
    shown.current = true;
    toast.info("Nieuwe versie beschikbaar — tik om te herladen", {
      onClick: applyUpdate,
    });
  }, [updateAvailable, toast]);

  return null;
}
