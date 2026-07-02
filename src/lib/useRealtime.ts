import { useEffect } from "react";
import { supabase } from "./supabase";
import { invalidate } from "./queryCache";

// Welke cache-prefixen een wijziging op een tabel raakt: matches beïnvloeden
// ook de standen (views), teams (nieuwe paren) en ratings (trigger).
const CACHE_PREFIXES: Record<string, string[]> = {
  matches: ["matches", "standings", "teams", "ratings"],
  friendships: ["friendships"],
  group_members: ["members", "groups"],
};

/**
 * Abonneert op wijzigingen (insert/update/delete) op een public-tabel en roept
 * onChange aan zodra er iets verandert. RLS geldt op de realtime-stroom.
 *
 * Events worden ~400ms gebundeld: een Americano-avond waarop meerdere scores
 * vlak na elkaar binnenkomen triggert zo één refetch i.p.v. een storm.
 * Met `filter` (bv. "group_id=eq.<id>") reageert de pagina alleen op de eigen
 * rijen. Let op: delete-events dragen enkel de primary key en vallen buiten
 * zo'n filter — gebruik filters alleen waar deletes niet relevant zijn.
 *
 * Geef een stabiele onChange mee (bv. via useCallback).
 */
export function useRealtime(
  table: string,
  onChange: () => void,
  filter?: string,
) {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const debounced = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        // Eerst de cache invalideren, zodat de reload die volgt vers ophaalt.
        invalidate(...(CACHE_PREFIXES[table] ?? []));
        onChange();
      }, 400);
    };

    const channel = supabase
      .channel(`realtime:${table}:${filter ?? "all"}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table, ...(filter ? { filter } : {}) },
        debounced,
      )
      .subscribe();
    return () => {
      clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [table, filter, onChange]);
}
