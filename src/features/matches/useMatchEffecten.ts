// De lef-, joker- en effectgegevens van een lijst matches, in één hook (#1151).
//
// MatchHistory (#981/#1003) en RondeBlok droegen hier ieder een eigen kopie van:
// twee cache-revisies, twee bulk-queries over de groepsmatches, en dan per kaart
// lefKaartRegel() + jokerKaartRegel() met dezelfde vier argumenten. Dezelfde
// twintig regels, twee keer opgeschreven — en dus twee plekken waar ze konden
// gaan afwijken. Met de profielpagina erbij (#1151) zou dat een derde kopie zijn.
//
// Hier staat het één keer. Zelfde reden en zelfde opzet als matchState.ts.
//
// De queries kijken bewust alleen naar groepsmatches: buiten een groep bestaat
// er geen inzet en geen joker, dus daar valt niets op te halen.

import { useMemo } from "react";
import { useAsync } from "@/lib/hooks/useAsync";
import { useCacheRevision } from "@/lib/hooks/useCacheRevision";
import { lefKaartRegel } from "@/features/matches/stakes";
import { getStakesForMatches } from "@/features/matches/stakesApi";
import { jokerKaartRegel } from "@/features/matches/jokers";
import { getJokersForMatches } from "@/features/matches/jokersApi";
import { displayName } from "@/features/profiles/api";
import {
  matchEffecten,
  GEEN_EFFECTEN,
  type MatchEffecten,
} from "@/features/matches/matchEffecten";
import type { Match, Profile, Team } from "@/types";

/** Wat er van één match te tonen valt aan bijzonderheden. */
export interface MatchExtras {
  /** De lef-regel, of null als er geen is (of hij nog verborgen hoort te zijn). */
  lef: string | null;
  /** De jokerregel, zelfde afspraak. */
  joker: string | null;
  /** De drie vlaggen waar de kaart zijn achtergrond uit samenstelt. */
  effecten: MatchEffecten;
}

const LEEG: MatchExtras = { lef: null, joker: null, effecten: GEEN_EFFECTEN };

/**
 * Haalt de inzetten en jokers van een matchlijst in bulk op en levert per match
 * de kant-en-klare regels plus de effectvlaggen.
 *
 * Geeft een lookup terug en geen map-in-de-render: de aanroepers lopen hun
 * matches toch al door in JSX, en zo blijft de vorm dicht bij wat er stond.
 * Zolang de queries lopen levert de lookup lege extras — de kaart toont dan
 * geen regel en geen kleur, wat precies de juiste tussenstand is.
 */
export function useMatchEffecten(opts: {
  matches: Match[];
  teams: Record<string, Team>;
  profiles: Record<string, Profile>;
  /** De kijker; bepaalt welke jokers van anderen al zichtbaar zijn. */
  myId?: string | null;
}): (match: Match) => MatchExtras {
  const { matches, teams, profiles } = opts;
  const myId = opts.myId ?? null;

  // De cache-revisies trekken de regels bij wanneer er elders op deze pagina
  // ingezet of een kaart gespeeld wordt (#907).
  const stakesRev = useCacheRevision("match-stakes");
  const jokersRev = useCacheRevision("match-jokers");

  // Als string-sleutel en niet als array: een nieuwe array-identiteit bij elke
  // render zou de query elke keer opnieuw afvuren.
  const ids = useMemo(
    () =>
      matches
        .filter((m) => m.group_id != null)
        .map((m) => m.id)
        .join(","),
    [matches],
  );

  const stakes = useAsync(
    () => getStakesForMatches(ids ? ids.split(",") : []),
    [ids, stakesRev],
  );
  const jokers = useAsync(
    () => getJokersForMatches(ids ? ids.split(",") : []),
    [ids, jokersRev],
  );

  return useMemo(() => {
    const naam = (id: string) => displayName(profiles[id]);
    return (match: Match): MatchExtras => {
      if (match.group_id == null) {
        // Buiten een groep bestaan lef en joker niet; de inzet wel.
        return { ...LEEG, effecten: matchEffecten({ match }) };
      }
      const lef = lefKaartRegel({
        match,
        stakes: stakes.data ?? [],
        teams,
        naam,
      });
      const joker = jokerKaartRegel({
        match,
        jokers: jokers.data ?? [],
        teams,
        naam,
        myId,
      });
      return { lef, joker, effecten: matchEffecten({ match, lef, joker }) };
    };
  }, [stakes.data, jokers.data, teams, profiles, myId]);
}
