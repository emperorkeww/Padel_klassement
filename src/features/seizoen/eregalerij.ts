// Eregalerij (#711, deel 1 van #474): de geschiedenis van een groep per
// afgesloten kwartaal — kampioen, podium en de Pias van dat seizoen. Puur
// client-side afgeleid uit de al geladen groepsmatches, precies zoals
// wrapped.ts en maandpias.ts: geen tabel, geen servertaak, geen migratie. De
// groepspagina heeft matches, teams, profiles en rating-histories al in de
// hand (GroupDetail.tsx), en getGroupMatches haalt de volledige historie op.
//
// Deze module geeft bewust `PlayerStanding`-rijen terug en géén namen: het
// formatteren van een naam hoort bij displayName (features/profiles/api.ts),
// en dat bestand sleept de supabase-client mee — die hoort niet in een pure
// module. De UI plakt de namen erop.
//
// De winnaar heet hier **kampioen**, niet "Big Daddy": Big Daddy is in deze
// app de rating-#1 (features/dashboard/bigDaddy.ts, de icon-editie op de
// FUT-kaart), terwijl de seizoenswinnaar de punten-#1 van dat kwartaal is.
// Twee verschillende titels, dus twee verschillende woorden.

import {
  afgeslotenSeizoenen,
  seizoenNaam,
  type Season,
  type SeizoenNaam,
} from "@/features/rating/seasons";
import { computePlayerStandings, matchesInSeason } from "@/features/rating/standings";
import { bepaalPias, type MatchRatings, type Pias } from "@/features/groups/maandpias";
import { seizoenAwards, type Award } from "./awards";
import type { Match, PlayerStanding, Profile, RatingPoint, Team } from "@/types";

export interface SeizoenEer {
  season: Season;
  /** "☀️ Zomer 2026" + losse delen, zie seizoenNaam. */
  naam: SeizoenNaam;
  /** Volledige seizoensstand van de groep, punten-#1 eerst (gasten vallen er
   *  al uit in computePlayerStandings, #468). */
  standings: PlayerStanding[];
  /** De punten-#1 van het kwartaal, of null als niemand meespeelde. */
  kampioen: PlayerStanding | null;
  /** Aantal afgeronde matches in dit kwartaal. */
  gespeeld: number;
  /** De gênantste afgang van het kwartaal, of null zonder afgang boven een
   *  drempel. Zelfde bepaling als de pias van de maand — dus inclusief gasten,
   *  anders dan de stand (#468). Bewust: de pias is een grap over wie er die
   *  avond bij was, en dashboard, groepskaart en feed doen het al zo. */
  pias: Pias | null;
  /** De medaille-uitreiking van dit kwartaal (#713), in vaste volgorde;
   *  awards zonder laureaat zitten er niet in. */
  awards: Award[];
}

/**
 * De eregalerij van een groep: één regel per afgesloten kwartaal waarin
 * gespeeld is, nieuwste eerst. Kwartalen zonder afgeronde match vallen weg —
 * een leeg seizoen is geen geschiedenis.
 *
 * `matches` mag de ruwe groepslijst zijn (alle statussen); alleen afgeronde
 * matches tellen mee. `ratingsByMatch` is optioneel en voedt enkel de
 * choke-detectie van de pias (zoals bij PiasCard).
 */
export function eregalerij(opts: {
  matches: Match[];
  teams: Record<string, Team>;
  profiles: Record<string, Profile>;
  ratingsByMatch?: Map<string, MatchRatings>;
  /** Rating-historie per speler; voedt twee awards (#713). Zonder deze data
   *  vallen alleen de stijger- en gigantendoder-award weg. */
  histories?: Record<string, RatingPoint[]>;
  now?: Date;
}): SeizoenEer[] {
  const { teams, profiles, ratingsByMatch } = opts;
  const now = opts.now ?? new Date();
  const completed = opts.matches.filter((m) => m.status === "completed");
  if (completed.length === 0) return [];

  const eerste = completed.reduce<string | null>((min, m) => {
    const d = m.played_at ?? m.created_at;
    return min === null || d < min ? d : min;
  }, null);
  if (eerste === null) return [];

  const rijen: SeizoenEer[] = [];
  for (const season of afgeslotenSeizoenen(new Date(eerste), now)) {
    const inSeizoen = matchesInSeason(completed, season);
    if (inSeizoen.length === 0) continue;
    const standings = computePlayerStandings(inSeizoen, teams, profiles);
    // bepaalPias neemt een vrije periode: het kwartaal past er direct in.
    const pias = bepaalPias(
      inSeizoen,
      teams,
      { start: season.start, end: season.end },
      ratingsByMatch,
    );
    // De pias gaat mee de uitreiking in; de UI laat hem weg bij een
    // roast-schild (#183) — een poster is minder vergeeflijk dan een regel.
    const beschermd = pias ? (profiles[pias.playerId]?.roast_schild ?? false) : false;
    rijen.push({
      season,
      naam: seizoenNaam(season),
      standings,
      kampioen: standings[0] ?? null,
      gespeeld: inSeizoen.length,
      pias,
      awards: seizoenAwards({
        matches: inSeizoen,
        teams,
        profiles,
        histories: opts.histories,
        pias: beschermd ? null : pias,
      }),
    });
  }
  return rijen;
}
