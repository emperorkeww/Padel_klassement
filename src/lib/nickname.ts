// Bijnaam-generator (#167): een ludieke bijnaam per speler, puur afgeleid uit
// de al geladen matches + teams. Deterministisch geseed op het speler-id, zodat
// de hele groep dezelfde bijnaam ziet (een gedeelde grap, geen per-kijker
// verrassing). Kandidaten waarvan de voorwaarde klopt worden verzameld; daaruit
// kiest de seed er één. Zonder passende kandidaat valt hij terug op een
// neutrale pool, zodat er altíjd een bijnaam is.

import type { Match, Team } from "./types";
import { inTeam, outcomeFor } from "./results";
import { matchDate } from "./missions";

/** Kleine stabiele hash van een string (djb2-variant), voor de seed. */
function hash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 33) + s.charCodeAt(i)) | 0;
  return h;
}

interface Stats {
  gespeeld: number;
  gewonnen: number;
  winrate: number; // 0..1
  bagelsUitgedeeld: number; // gewonnen met 6–0
  grootsteZege: number; // grootste winstmarge
  nachtmatches: number; // gespeeld vanaf 21u
}

function statsVoor(
  matches: Match[],
  teams: Record<string, Team>,
  playerId: string,
): Stats {
  let gespeeld = 0;
  let gewonnen = 0;
  let bagelsUitgedeeld = 0;
  let grootsteZege = 0;
  let nachtmatches = 0;
  for (const m of matches) {
    const o = outcomeFor(m, teams, playerId);
    if (!o) continue;
    gespeeld++;
    const d = matchDate(m);
    if (d && d.getHours() >= 21) nachtmatches++;
    if (o === "W") {
      gewonnen++;
      if (m.score_a != null && m.score_b != null) {
        const inA = inTeam(teams[m.team_a_id], playerId);
        const mij = inA ? m.score_a : m.score_b;
        const hen = inA ? m.score_b : m.score_a;
        grootsteZege = Math.max(grootsteZege, mij - hen);
        if (hen === 0 && mij > 0) bagelsUitgedeeld++;
      }
    }
  }
  return {
    gespeeld,
    gewonnen,
    winrate: gespeeld > 0 ? gewonnen / gespeeld : 0,
    bagelsUitgedeeld,
    grootsteZege,
    nachtmatches,
  };
}

interface BijnaamDef {
  naam: string;
  past(s: Stats): boolean;
}

// Volgorde is niet belangrijk: alle passende kandidaten dingen mee, de seed
// kiest. Voorwaarden zijn bewust afgeleid uit puur telbare matchdata.
const KANDIDATEN: BijnaamDef[] = [
  { naam: "De Beul van Baan 1 🔪", past: (s) => s.bagelsUitgedeeld >= 2 },
  { naam: "De Bagelbakker 🥯", past: (s) => s.bagelsUitgedeeld >= 1 },
  { naam: "De Sloopkogel 💥", past: (s) => s.grootsteZege >= 6 },
  { naam: "De Nachtbraker 🌙", past: (s) => s.nachtmatches >= 3 },
  { naam: "De Glazen Wand 🛡️", past: (s) => s.gespeeld >= 10 && s.winrate >= 0.6 },
  { naam: "De Grijze Muis 🐭", past: (s) => s.gespeeld >= 10 && s.winrate >= 0.45 && s.winrate <= 0.55 },
  { naam: "Sponsor van de Tegenstander 💸", past: (s) => s.gespeeld >= 10 && s.winrate < 0.4 },
  { naam: "Het Meubilair 🛋️", past: (s) => s.gespeeld >= 100 },
  { naam: "De Baanplakker 🧗", past: (s) => s.gespeeld >= 50 },
  { naam: "De Groene Banaan 🍌", past: (s) => s.gespeeld > 0 && s.gespeeld < 10 },
];

/** Neutrale terugval als geen enkele kandidaat past (bv. 0 matches). */
const NEUTRAAL = ["De Racketzwaaier 🏸", "De Baanbewoner 🏕️", "De Puntenzoeker 🔎"];

/** Alleen een neutrale bijnaam (#183): voor spelers met een roast-schild aan,
 *  die geen plagende bijnaam willen. Deterministisch op het speler-id. */
export function neutraleBijnaam(playerId: string): string {
  const i = ((hash(playerId) % NEUTRAAL.length) + NEUTRAAL.length) % NEUTRAAL.length;
  return NEUTRAAL[i];
}

/** Deterministische ludieke bijnaam voor een speler. */
export function bijnaam(
  matches: Match[],
  teams: Record<string, Team>,
  playerId: string,
): string {
  const s = statsVoor(matches, teams, playerId);
  const passend = KANDIDATEN.filter((k) => k.past(s)).map((k) => k.naam);
  const pool = passend.length > 0 ? passend : NEUTRAAL;
  const i = ((hash(playerId) % pool.length) + pool.length) % pool.length;
  return pool[i];
}
