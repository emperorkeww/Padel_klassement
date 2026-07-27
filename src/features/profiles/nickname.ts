// Bijnaam-generator (#167): een ludieke bijnaam per speler, puur afgeleid uit
// de al geladen matches + teams. Deterministisch geseed op het speler-id, zodat
// de hele groep dezelfde bijnaam ziet (een gedeelde grap, geen per-kijker
// verrassing). Kandidaten waarvan de voorwaarde klopt worden verzameld; daaruit
// kiest de seed er één. Zonder passende kandidaat valt hij terug op een
// neutrale pool, zodat er altíjd een bijnaam is.

import type { Match, Team } from "@/types";
import { inTeam, outcomeFor } from "@/features/rating/results";
import { matchDate } from "@/features/dashboard/missions";

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
  bagelsGeïncasseerd: number; // verloren met 0–6
  grootsteZege: number; // grootste winstmarge
  grootsteMargeVerlies: number; // grootste verliesmarge
  nachtmatches: number; // gespeeld vanaf 21u
  nachtwinrate: number; // winrate in de nacht
  winstreeks: number; // langste winstreeks
  verliesreeks: number; // langste verliesreeks
  actueleWinstreeks: number;
  actueleVerliesreeks: number;
}

function statsVoor(
  matches: Match[],
  teams: Record<string, Team>,
  playerId: string,
): Stats {
  let gespeeld = 0;
  let gewonnen = 0;
  let bagelsUitgedeeld = 0;
  let bagelsGeïncasseerd = 0;
  let grootsteZege = 0;
  let grootsteMargeVerlies = 0;
  let nachtmatches = 0;
  let nachtwinst = 0;

  // Sorteren op datum om reeksen (streaks) te kunnen berekenen
  const sorted = [...matches]
    .filter((m) => outcomeFor(m, teams, playerId) !== null)
    .sort((a, b) => (a.played_at ?? a.created_at).localeCompare(a.played_at ?? a.created_at));

  let winstreeks = 0;
  let verliesreeks = 0;
  let huidigeWinstreeks = 0;
  let huidigeVerliesreeks = 0;

  for (const m of sorted) {
    const o = outcomeFor(m, teams, playerId);
    if (!o) continue;

    gespeeld++;
    const d = matchDate(m);
    if (d && d.getHours() >= 21) {
      nachtmatches++;
      if (o === "W") nachtwinst++;
    }

    if (m.score_a != null && m.score_b != null) {
      const inA = inTeam(teams[m.team_a_id], playerId);
      const mij = inA ? m.score_a : m.score_b;
      const hen = inA ? m.score_b : m.score_a;

      if (o === "W") {
        gewonnen++;
        grootsteZege = Math.max(grootsteZege, mij - hen);
        if (hen === 0 && mij > 0) bagelsUitgedeeld++;

        huidigeWinstreeks++;
        huidigeVerliesreeks = 0;
        winstreeks = Math.max(winstreeks, huidigeWinstreeks);
      } else if (o === "L") {
        grootsteMargeVerlies = Math.max(grootsteMargeVerlies, hen - mij);
        if (mij === 0 && hen > 0) bagelsGeïncasseerd++;

        huidigeVerliesreeks++;
        huidigeWinstreeks = 0;
        verliesreeks = Math.max(verliesreeks, huidigeVerliesreeks);
      }
    }
  }

  return {
    gespeeld,
    gewonnen,
    winrate: gespeeld > 0 ? gewonnen / gespeeld : 0,
    bagelsUitgedeeld,
    bagelsGeïncasseerd,
    grootsteZege,
    grootsteMargeVerlies,
    nachtmatches,
    nachtwinrate: nachtmatches > 0 ? nachtwinst / nachtmatches : 0,
    winstreeks,
    verliesreeks,
    actueleWinstreeks: huidigeWinstreeks,
    actueleVerliesreeks: huidigeVerliesreeks,
  };
}

interface BijnaamDef {
  naam: string;
  past(s: Stats): boolean;
}

// Volgorde is niet belangrijk: alle passende kandidaten dingen mee, de seed
// kiest. Voorwaarden zijn bewust afgeleid uit puur telbare matchdata.
const KANDIDATEN: BijnaamDef[] = [
  // Huidige/historische beulen
  { naam: "De Beul van Baan 1 🔪", past: (s) => s.bagelsUitgedeeld >= 2 },
  { naam: "De Bagelbakker 🥯", past: (s) => s.bagelsUitgedeeld >= 1 },
  { naam: "De Sloopkogel 💥", past: (s) => s.grootsteZege >= 6 },
  { naam: "De Glazen Wand 🛡️", past: (s) => s.gespeeld >= 10 && s.winrate >= 0.6 },

  // Tryhards & Wannabe-Profs (sarcasme voor winnaars)
  { naam: "Tryhard van Baan 2 🥵", past: (s) => s.winrate >= 0.7 && s.gespeeld >= 12 },
  { naam: "Wannabe-Prof 🤡", past: (s) => s.winrate >= 0.65 && s.gespeeld >= 20 },
  { naam: "Zweetdief 💦", past: (s) => s.winrate >= 0.6 && s.gespeeld >= 15 },

  // Nachtbrakers
  { naam: "De Nachtbraker 🌙", past: (s) => s.nachtmatches >= 3 },
  { naam: "Nachtbrakende Kneus 🌙", past: (s) => s.nachtmatches >= 5 && s.nachtwinrate < 0.3 },

  // Middelmaat & Meubilair
  { naam: "De Grijze Muis 🐭", past: (s) => s.gespeeld >= 10 && s.winrate >= 0.45 && s.winrate <= 0.55 },
  { naam: "Het Paaltje van Baan 3 🪵", past: (s) => s.gespeeld >= 30 && s.winrate >= 0.45 && s.winrate <= 0.55 },
  { naam: "De Eeuwige Middelmaat ⚖️", past: (s) => s.gespeeld >= 15 && s.winrate >= 0.47 && s.winrate <= 0.53 },
  { naam: "Het Meubilair 🛋️", past: (s) => s.gespeeld >= 100 },
  { naam: "De Baanplakker 🧗", past: (s) => s.gespeeld >= 50 },

  // Harde roasts (voor verliezers)
  { naam: "Lopende Bye op het Schema 🚶", past: (s) => s.gespeeld >= 12 && s.winrate < 0.20 },
  { naam: "Baanreservering-Sponsor 💸", past: (s) => s.gespeeld >= 10 && s.winrate < 0.25 },
  { naam: "Sponsor van de Tegenstander 💸", past: (s) => s.gespeeld >= 10 && s.winrate < 0.4 },
  { naam: "Puntendonateur van de Club 🎁", past: (s) => s.gespeeld >= 10 && s.winrate < 0.35 },
  { naam: "Chronisch Verliezer 🥀", past: (s) => s.verliesreeks >= 3 },
  { naam: "Zandzak op de Baan ⏳", past: (s) => s.verliesreeks >= 5 },
  { naam: "De Rode Lantaarn 🏮", past: (s) => s.actueleVerliesreeks >= 4 },
  { naam: "Baan 1 Schietschijf 🎯", past: (s) => s.bagelsGeïncasseerd >= 2 },
  { naam: "Bagel-Magneet 🥯", past: (s) => s.bagelsGeïncasseerd >= 1 },
  { naam: "Toerist met Racket 🎒", past: (s) => s.gespeeld >= 3 && s.winrate === 0 },
  { naam: "Gevaar voor de Eigen Ruiten 🪟", past: (s) => s.gespeeld >= 5 && s.winrate < 0.35 && s.grootsteMargeVerlies >= 5 },

  // Nieuwelingen
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
