import { useEffect } from "react";
import { supabase } from "./supabase";

/**
 * Abonneert op wijzigingen (insert/update/delete) op een public-tabel en roept
 * onChange aan zodra er iets verandert. RLS geldt op de realtime-stroom.
 * Geef een stabiele onChange mee (bv. via useCallback).
 */
export function useRealtime(table: string, onChange: () => void) {
  useEffect(() => {
    const channel = supabase
      .channel(`realtime:${table}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => onChange(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [table, onChange]);
}
