// Americano-rotatie die partners (en tegenstanders) zo veel mogelijk laat
// wisselen. De oude aanpak deelde elke ronde puur willekeurig in, zonder
// geheugen — waardoor dezelfde koppels vaak terugkwamen. Hier bouwen we uit de
// eerdere matches van de groep hoe vaak elk tweetal al samen (partner) en
// tegen elkaar (tegenstander) speelde, en kiezen we per ronde de indeling die
// die herhaling minimaliseert. Alles is puur en deterministisch te testen door
// een eigen rng mee te geven.

import type { Match, Team } from "@/types";

export interface AmericanoCourt {
  teamA: [string, string];
  teamB: [string, string];
}

export interface AmericanoRoundResult {
  courts: AmericanoCourt[];
  /** Spelers die deze ronde op de bank zitten (aantal geen veelvoud van 4). */
  reserves: string[];
}

export interface AmericanoHistory {
  /** pairKey → aantal keer samen in een team. */
  partner: Map<string, number>;
  /** pairKey → aantal keer tegen elkaar. */
  opponent: Map<string, number>;
  /** speler-id → aantal gespeelde matches (voor eerlijke bankrotatie). */
  played: Map<string, number>;
}

/** Ongeordende sleutel voor een tweetal spelers. */
function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function bump(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

export function emptyHistory(): AmericanoHistory {
  return { partner: new Map(), opponent: new Map(), played: new Map() };
}

/**
 * Telt één gespeelde (of geplande) baan mee in de geschiedenis: het tweetal
 * per team is samen geweest, en elk kruispaar stond tegenover elkaar.
 */
function countCourt(
  history: AmericanoHistory,
  a: [string, string],
  b: [string, string],
): void {
  bump(history.partner, pairKey(a[0], a[1]));
  bump(history.partner, pairKey(b[0], b[1]));
  for (const x of a) for (const y of b) bump(history.opponent, pairKey(x, y));
  for (const p of [...a, ...b])
    history.played.set(p, (history.played.get(p) ?? 0) + 1);
}

/**
 * Bouwt de partner-/tegenstandergeschiedenis uit de matches van een groep.
 * `played` blijft bewust leeg: de bankrotatie hoort binnen één generatie te
 * rouleren, niet op basis van de volledige historie (anders zitten trouwe
 * leden altijd op de bank). Geannuleerde matches tellen niet mee.
 */
export function historyFromMatches(
  matches: Match[],
  teams: Record<string, Team>,
): AmericanoHistory {
  const history = emptyHistory();
  for (const m of matches) {
    if (m.status === "cancelled") continue;
    const ta = teams[m.team_a_id];
    const tb = teams[m.team_b_id];
    if (!ta || !tb) continue;
    // Americano is inherent dubbelspel: singles (1v1) matches tellen niet mee.
    if (m.format === "1v1" || !ta.player2_id || !tb.player2_id) continue;
    const a: [string, string] = [ta.player1_id, ta.player2_id];
    const b: [string, string] = [tb.player1_id, tb.player2_id];
    bump(history.partner, pairKey(a[0], a[1]));
    bump(history.partner, pairKey(b[0], b[1]));
    for (const x of a) for (const y of b) bump(history.opponent, pairKey(x, y));
  }
  return history;
}

/** Verwerkt een zojuist gegenereerde ronde in de geschiedenis (voor de
 *  volgende ronde binnen dezelfde generatie). */
export function applyRound(
  history: AmericanoHistory,
  courts: AmericanoCourt[],
): void {
  for (const c of courts) countCourt(history, c.teamA, c.teamB);
}

/** Fisher-Yates-shuffle met een instelbare rng (default Math.random). */
function shuffle<T>(arr: readonly T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Koppelt spelers tot teams van twee, greedy en met zo min mogelijk
 * partnerherhaling. De pool is vooraf geschud, dus bij gelijke tellingen valt
 * de keuze willekeurig — en de eerste ronde (lege historie) is puur willekeurig.
 */
function pairUp(
  players: string[],
  partner: Map<string, number>,
  rng: () => number,
): [string, string][] {
  const pool = shuffle(players, rng);
  const used = new Array<boolean>(pool.length).fill(false);
  const teams: [string, string][] = [];

  for (let i = 0; i < pool.length; i++) {
    if (used[i]) continue;
    let best = -1;
    let bestW = Infinity;
    for (let j = i + 1; j < pool.length; j++) {
      if (used[j]) continue;
      const w = partner.get(pairKey(pool[i], pool[j])) ?? 0;
      if (w < bestW) {
        bestW = w;
        best = j;
      }
    }
    if (best === -1) break; // oneven rest (mag niet voorkomen bij veelvoud van 4)
    used[i] = true;
    used[best] = true;
    teams.push([pool[i], pool[best]]);
  }
  return teams;
}

/** Som van de tegenstandertellingen over de vier kruisparen van twee teams. */
function crossOpponent(
  a: [string, string],
  b: [string, string],
  opponent: Map<string, number>,
): number {
  let sum = 0;
  for (const x of a) for (const y of b) sum += opponent.get(pairKey(x, y)) ?? 0;
  return sum;
}

/** Zet teams tegen elkaar op banen, greedy met zo min mogelijk
 *  tegenstanderherhaling. */
function pairCourts(
  teams: [string, string][],
  opponent: Map<string, number>,
  rng: () => number,
): AmericanoCourt[] {
  const order = shuffle(
    teams.map((_, i) => i),
    rng,
  );
  const used = new Set<number>();
  const courts: AmericanoCourt[] = [];

  for (const ti of order) {
    if (used.has(ti)) continue;
    used.add(ti);
    let best = -1;
    let bestW = Infinity;
    for (const tj of order) {
      if (tj === ti || used.has(tj)) continue;
      const w = crossOpponent(teams[ti], teams[tj], opponent);
      if (w < bestW) {
        bestW = w;
        best = tj;
      }
    }
    if (best === -1) break;
    used.add(best);
    courts.push({ teamA: teams[ti], teamB: teams[best] });
  }
  return courts;
}

/**
 * Stelt één Americano-ronde samen voor de gegeven spelers. Vormt zoveel
 * mogelijk banen van vier (2 vs 2); wie overblijft zit op de bank, waarbij wie
 * deze generatie al het meest speelde als eerste rust. Partners en
 * tegenstanders worden zo veel mogelijk gevarieerd op basis van `history`.
 */
export function americanoRound(
  playerIds: string[],
  history: AmericanoHistory = emptyHistory(),
  rng: () => number = Math.random,
): AmericanoRoundResult {
  const ids = [...new Set(playerIds)];
  const courtCount = Math.floor(ids.length / 4);
  const benchCount = ids.length - courtCount * 4;

  // Bank kiezen: wie deze generatie al het meest speelde, rust nu (eerlijke
  // rotatie); geschud vooraf zodat gelijke tellingen willekeurig breken.
  const shuffled = shuffle(ids, rng);
  const reserves = [...shuffled]
    .sort((a, b) => (history.played.get(b) ?? 0) - (history.played.get(a) ?? 0))
    .slice(0, benchCount);
  const benchSet = new Set(reserves);
  const playing = shuffled.filter((id) => !benchSet.has(id));

  const teams = pairUp(playing, history.partner, rng);
  const courts = pairCourts(teams, history.opponent, rng);

  return { courts, reserves };
}
