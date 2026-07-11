import { useEffect } from "react";
import { supabase } from "./supabase";
import { invalidate } from "./queryCache";

// Welke cache-prefixen een wijziging op een tabel raakt: matches beïnvloeden
// ook de standen (views), teams (nieuwe paren) en ratings (trigger).
const CACHE_PREFIXES: Record<string, string[]> = {
  matches: [
    "matches",
    "standings",
    "teams",
    "ratings",
    // De grading-trigger beoordeelt tips bij een uitslag/correctie (#116).
    "match-predictions",
    "prediction-standings",
    // De pias-trigger duidt bij elke uitslag/correctie de pias opnieuw aan.
    "pias",
    // De Zwarte Piet verhuist ook bij elke uitslag/correctie (#185).
    "shame",
  ],
  pias_of_week: ["pias"],
  zwarte_piet: ["shame"],
  friendships: ["friendships"],
  group_members: ["members", "groups"],
  attendance: ["attendance"],
  match_predictions: ["match-predictions", "prediction-standings"],
  slot_availability: ["slot-availability"],
  play_proposals: ["play-proposal"],
  play_proposal_votes: ["play-proposal"],
};

// Kanaalnamen moeten uniek zijn per abonnee: twee hooks met dezelfde tabel en
// filter (bv. Voorstellen + Vanavond op één pagina) zouden anders hetzelfde
// kanaal delen, en `.on()` na `subscribe()` gooit een runtime-fout.
let channelSeq = 0;

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
      .channel(`realtime:${table}:${filter ?? "all"}:${++channelSeq}`)
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
