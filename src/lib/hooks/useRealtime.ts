import { useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { invalidate } from "@/lib/supabase/queryCache";

// Welke cache-prefixen een wijziging op een tabel raakt: matches beïnvloeden
// ook de standen (views), teams (nieuwe paren) en ratings (trigger).
export const CACHE_PREFIXES: Record<string, string[]> = {
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
    // Een uitslag verschuift de kroon én de zegereeks eronder (#805).
    "bounties",
    // Netrollers hangen aan de match en cascaderen mee (#809).
    "net-touches",
  ],
  pias_of_week: ["pias"],
  zwarte_piet: ["shame"],
  vendettas: ["vendettas"],
  friendships: ["friendships"],
  group_members: ["members", "groups"],
  match_predictions: ["match-predictions", "prediction-standings"],
  // Lef-tips (#804): de kaart beheert zijn eigen inzet-state, dus geen
  // subscriber; de mapping staat klaar en focus-refetch + TTL doen het werk.
  match_stakes: ["match-stakes"],
  slot_availability: ["slot-availability"],
  // Baanbeschikbaarheids-snapshots van de cron (#405); geen subscriber nu,
  // maar de mapping staat klaar (focus-refetch + korte TTL doen het werk).
  court_availability_snapshots: ["court-snapshots"],
  // Play-polls (voorheen "proposals"): de "play-poll"-prefix dekt alle drie de
  // cache-sleutels (play-polls: / play-poll-options: / play-poll-votes:).
  play_polls: ["play-poll"],
  // Het agendavenster (#1091) bundelt momenten, polls én stemmen onder één
  // sleutel, dus alle drie de tabellen moeten hem kunnen invalideren. Bij
  // play_polls zit hij al in de brede "play-poll"-prefix.
  play_poll_options: ["play-poll-options", "play-poll-agenda"],
  play_poll_votes: ["play-poll-votes", "play-poll-agenda"],
  // Wie er écht komt (#1271). Raakt het agendavenster niet: dat toont de
  // stemming, en aanwezigheid is de correctie erop op de speeldag zelf.
  play_poll_presence: ["play-poll-presence"],
  match_smoesjes: ["smoesjes"],
  // Rudy's VAR (#1025). Een uitspraak kan de uitslag verschuiven, dus een
  // wijziging aan een beroep raakt álles wat aan een match hangt — vandaar de
  // matches-prefixes erbij, in de pas met invalidateNaUitspraak in appealApi.
  point_appeals: [
    "appeals",
    "matches",
    "standings",
    "ratings",
    "match-predictions",
    "prediction-standings",
    "pias",
    "shame",
    "bounties",
  ],
  point_appeal_votes: ["appeals"],
  // Meldingen-inbox (#1090): de lijst in het paneel en de ongelezen-teller in
  // de balk. Eén prefix dekt beide sleutels (meldingen:lijst / meldingen:ongelezen).
  notifications: ["meldingen"],
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
