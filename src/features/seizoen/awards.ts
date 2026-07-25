// Medaille-uitreiking (#713, deel 3 van #474): de awards van één afgesloten
// kwartaal binnen een groep. Puur afgeleid uit de al geladen groepsmatches en
// rating-histories — geen tabel, geen migratie, zelfde patroon als
// eregalerij.ts en records.ts ernaast.
//
// Waarom deze awards en niet die uit het voorstel: #474 noemt "Beste
// Aanvaller" en "Koning van het Golden Point". Punt-voor-punt-data bestaat in
// het schema (match_points, mét is_golden_point) maar wordt door geen enkele
// flow gevuld, en set_scores blijft leeg — er is dus niets om op te rekenen.
// Daarom awards met dezelfde toon op de data die er wél is; "Golden Point"
// wordt de kraker (winsten met één game verschil). Zodra er ooit punt-invoer
// bestaat (raakvlak met #568) is de échte golden-point-award een uitbreiding
// hier.
//
// Elke award heeft een drempel: geen winnaar → de award valt weg in plaats van
// leeg op de poster te staan. Tie-breaks zijn deterministisch op playerId,
// zoals bepaalPias.

import { inTeam, longestStreak, outcomeFor, playersOf } from "@/features/rating/results";
import { matchUpset, preMatchPoints } from "@/features/matches/upset";
import { besteComeback } from "@/features/wrapped/wrapped";
import type { Pias } from "@/features/groups/maandpias";
import { piasDetail } from "@/features/groups/maandpias";
import type { Match, Profile, RatingPoint, Team } from "@/types";

export type AwardId =
  | "scherpschutter"
  | "bagelbakker"
  | "comebackkoning"
  | "reeks"
  | "stijger"
  | "gigantendoder"
  | "kraker"
  | "pias";

export interface Award {
  id: AwardId;
  emoji: string;
  titel: string;
  /** De laureaat. */
  playerId: string;
  /** Het getal achter de award (games, aantallen, rating-winst, winkans). */
  waarde: number;
  /** Korte toelichting zónder naam; de UI/poster plakt de naam ervoor. */
  detail: string;
}

/** Minimum aantal matches in het kwartaal om mee te doen aan de gemiddelde-
 *  awards: onder dit aantal is één uitschieter geen prestatie. */
export const MIN_MATCHES = 3;

/** Drempels per award; daaronder wordt de award niet uitgereikt. */
const DREMPELS: Record<AwardId, number> = {
  scherpschutter: 4, // gemiddeld ≥4 games per match
  bagelbakker: 1,
  comebackkoning: 2, // winst na ≥2 verliezen
  reeks: 3,
  stijger: 10, // ≥10 rating erbij
  gigantendoder: 0, // elke upset is er één (matchUpset heeft z'n eigen grens)
  kraker: 2, // twee krakers gewonnen
  pias: 0,
};

interface AwardOpts {
  /** Matches van het kwartaal (afgerond; wordt hier nog gefilterd). */
  matches: Match[];
  teams: Record<string, Team>;
  profiles: Record<string, Profile>;
  /** Volledige rating-historie per speler; voedt stijger en gigantendoder. */
  histories?: Record<string, RatingPoint[]>;
  /** De pias van het kwartaal (uit eregalerij.ts). Met een roast-schild op
   *  laat de UI hem weg — de award zou de spot op een poster zetten die de
   *  drager niet wil. */
  pias?: Pias | null;
}

/** Niet-gast-spelers met minstens één afgeronde match in de periode. */
function deelnemers(
  matches: Match[],
  teams: Record<string, Team>,
  profiles: Record<string, Profile>,
): string[] {
  const set = new Set<string>();
  for (const m of matches) {
    for (const t of [teams[m.team_a_id], teams[m.team_b_id]]) {
      for (const pid of playersOf(t)) {
        if (!profiles[pid]?.is_guest) set.add(pid);
      }
    }
  }
  return [...set];
}

/** Matches waarin de speler meedeed (en die een uitslag hebben). */
function eigenMatches(
  matches: Match[],
  teams: Record<string, Team>,
  playerId: string,
): Match[] {
  return matches.filter((m) => outcomeFor(m, teams, playerId) !== null);
}

/** Games vóór en tegen vanuit de speler; null zonder ingevulde scores. */
function games(
  m: Match,
  teams: Record<string, Team>,
  playerId: string,
): { voor: number; tegen: number } | null {
  if (m.score_a == null || m.score_b == null) return null;
  const inA = inTeam(teams[m.team_a_id], playerId);
  return inA
    ? { voor: m.score_a, tegen: m.score_b }
    : { voor: m.score_b, tegen: m.score_a };
}

/** De hoogste waarde wint; bij gelijke waarde de laagste playerId (stabiel). */
function beste<T extends { playerId: string; waarde: number }>(
  kandidaten: T[],
): T | null {
  let top: T | null = null;
  for (const k of kandidaten) {
    if (!top || k.waarde > top.waarde || (k.waarde === top.waarde && k.playerId < top.playerId))
      top = k;
  }
  return top;
}

/** 🎯 Scherpschutter: hoogste gemiddelde aantal gewonnen games per match. */
function scherpschutter(
  matches: Match[],
  teams: Record<string, Team>,
  spelers: string[],
): Award | null {
  const kandidaten = spelers.flatMap((playerId) => {
    const eigen = eigenMatches(matches, teams, playerId).filter(
      (m) => games(m, teams, playerId) != null,
    );
    if (eigen.length < MIN_MATCHES) return [];
    const totaal = eigen.reduce((s, m) => s + games(m, teams, playerId)!.voor, 0);
    return [{ playerId, waarde: totaal / eigen.length }];
  });
  const top = beste(kandidaten);
  if (!top || top.waarde < DREMPELS.scherpschutter) return null;
  return {
    id: "scherpschutter",
    emoji: "🎯",
    titel: "Scherpschutter",
    playerId: top.playerId,
    waarde: top.waarde,
    detail: `${top.waarde.toFixed(1)} games per match`,
  };
}

/** 🥯 Bagelbakker: meeste 6-0's uitgedeeld. */
function bagelbakker(
  matches: Match[],
  teams: Record<string, Team>,
  spelers: string[],
): Award | null {
  const kandidaten = spelers.map((playerId) => {
    let aantal = 0;
    for (const m of eigenMatches(matches, teams, playerId)) {
      const g = games(m, teams, playerId);
      // Zelfde bagel-definitie als wrapped.ts/records.ts: precies één nul.
      if (g && g.tegen === 0 && g.voor > 0) aantal += 1;
    }
    return { playerId, waarde: aantal };
  });
  const top = beste(kandidaten);
  if (!top || top.waarde < DREMPELS.bagelbakker) return null;
  return {
    id: "bagelbakker",
    emoji: "🥯",
    titel: "Bagelbakker",
    playerId: top.playerId,
    waarde: top.waarde,
    detail: top.waarde === 1 ? "1 bagel uitgedeeld" : `${top.waarde} bagels uitgedeeld`,
  };
}

/** 🧗 Comebackkoning: winst na de langste voorafgaande verliesreeks. Leunt op
 *  besteComeback uit het Wrapped (#115/#712) — één definitie van "comeback". */
function comebackkoning(
  matches: Match[],
  teams: Record<string, Team>,
  spelers: string[],
): Award | null {
  const ids = new Set(matches.map((m) => m.id));
  const kandidaten = spelers.flatMap((playerId) => {
    const comeback = besteComeback(matches, ids, teams, playerId);
    return comeback ? [{ playerId, waarde: comeback.naVerliezen }] : [];
  });
  const top = beste(kandidaten);
  if (!top || top.waarde < DREMPELS.comebackkoning) return null;
  return {
    id: "comebackkoning",
    emoji: "🧗",
    titel: "Comebackkoning",
    playerId: top.playerId,
    waarde: top.waarde,
    detail: `stond op na ${top.waarde} verliezen op rij`,
  };
}

/** 🔥 Langste reeks: langste winreeks binnen het kwartaal. */
function langsteReeks(
  matches: Match[],
  teams: Record<string, Team>,
  spelers: string[],
): Award | null {
  const top = beste(
    spelers.map((playerId) => ({
      playerId,
      waarde: longestStreak(matches, teams, playerId),
    })),
  );
  if (!top || top.waarde < DREMPELS.reeks) return null;
  return {
    id: "reeks",
    emoji: "🔥",
    titel: "Langste reeks",
    playerId: top.playerId,
    waarde: top.waarde,
    detail: `${top.waarde} overwinningen op rij`,
  };
}

/** 📈 Grootste stijger: hoogste rating-winst binnen het kwartaal. */
function grootsteStijger(
  matches: Match[],
  histories: Record<string, RatingPoint[]>,
  spelers: string[],
): Award | null {
  const ids = new Set(matches.map((m) => m.id));
  const kandidaten = spelers.flatMap((playerId) => {
    const punten = (histories[playerId] ?? []).filter((p) => ids.has(p.match_id));
    if (punten.length === 0) return [];
    // De historie is chronologisch; delta's optellen geeft de netto sprong
    // binnen het kwartaal, ook als er punten buiten de groep tussen zitten.
    const delta = punten.reduce((s, p) => s + p.delta, 0);
    return [{ playerId, waarde: delta }];
  });
  const top = beste(kandidaten);
  if (!top || top.waarde < DREMPELS.stijger) return null;
  return {
    id: "stijger",
    emoji: "📈",
    titel: "Grootste stijger",
    playerId: top.playerId,
    waarde: top.waarde,
    detail: `+${Math.round(top.waarde)} rating dit seizoen`,
  };
}

/** 🎲 Gigantendoder: de grootste verrassing — de winnaar met de kleinste
 *  winkans vooraf. Beide winnaars van dat duo delen de eer; de award gaat naar
 *  de speler met de laagste playerId, de ander staat in het detail. */
function gigantendoder(
  matches: Match[],
  teams: Record<string, Team>,
  profiles: Record<string, Profile>,
  histories: Record<string, RatingPoint[]>,
): Award | null {
  // Laagste winkans = grootste verrassing; bij gelijke kans wint de vroegste.
  let laagste: { m: Match; kans: number } | null = null;
  for (const m of matches) {
    const upset = matchUpset(m, teams, preMatchPoints(histories, m.id));
    if (!upset) continue;
    if (!laagste || upset.chance < laagste.kans) laagste = { m, kans: upset.chance };
  }
  if (!laagste || !laagste.m.winner_team_id) return null;
  const winnaars = playersOf(teams[laagste.m.winner_team_id]).filter(
    (pid) => !profiles[pid]?.is_guest,
  );
  if (winnaars.length === 0) return null;
  const kans = Math.round(laagste.kans * 100);
  return {
    id: "gigantendoder",
    emoji: "🎲",
    titel: "Gigantendoder",
    playerId: [...winnaars].sort()[0],
    waarde: laagste.kans,
    detail: `won met ${kans}% winkans vooraf`,
  };
}

/** 👑 Koning van de kraker: meeste winsten met precies één game verschil — de
 *  eerlijke vervanger van "Koning van het Golden Point" (zie kop). */
function koningVanDeKraker(
  matches: Match[],
  teams: Record<string, Team>,
  spelers: string[],
): Award | null {
  const kandidaten = spelers.map((playerId) => {
    let aantal = 0;
    for (const m of eigenMatches(matches, teams, playerId)) {
      if (outcomeFor(m, teams, playerId) !== "W") continue;
      const g = games(m, teams, playerId);
      if (g && g.voor - g.tegen === 1) aantal += 1;
    }
    return { playerId, waarde: aantal };
  });
  const top = beste(kandidaten);
  if (!top || top.waarde < DREMPELS.kraker) return null;
  return {
    id: "kraker",
    emoji: "👑",
    titel: "Koning van de kraker",
    playerId: top.playerId,
    waarde: top.waarde,
    detail: `${top.waarde} keer met één game verschil gewonnen`,
  };
}

/** 🤡 Pias van het seizoen: dezelfde afgang die de eregalerij al aanwijst. */
function piasAward(pias: Pias): Award {
  return {
    id: "pias",
    emoji: "🤡",
    titel: "Pias van het seizoen",
    playerId: pias.playerId,
    waarde: pias.waarde,
    detail: piasDetail(pias.reden, pias.waarde),
  };
}

/**
 * De awards van één kwartaal, in vaste volgorde: eerst de eer, de pias als
 * slot (schande verdringt nooit verdienste — dezelfde ordening als de
 * editie-prioriteit in edities.ts). Awards zonder laureaat vallen weg.
 */
export function seizoenAwards(opts: AwardOpts): Award[] {
  const { teams, profiles } = opts;
  // Chronologisch: de Comebackkoning leest de reeks vóór een winst, en
  // getGroupMatches levert de lijst op rondenummer aflopend.
  const matches = opts.matches
    .filter((m) => m.status === "completed")
    .sort((a, b) =>
      (a.played_at ?? a.created_at).localeCompare(b.played_at ?? b.created_at),
    );
  if (matches.length === 0) return [];
  const histories = opts.histories ?? {};
  const spelers = deelnemers(matches, teams, profiles);

  return [
    scherpschutter(matches, teams, spelers),
    bagelbakker(matches, teams, spelers),
    koningVanDeKraker(matches, teams, spelers),
    langsteReeks(matches, teams, spelers),
    comebackkoning(matches, teams, spelers),
    grootsteStijger(matches, histories, spelers),
    gigantendoder(matches, teams, profiles, histories),
    opts.pias ? piasAward(opts.pias) : null,
  ].filter((a): a is Award => a !== null);
}
