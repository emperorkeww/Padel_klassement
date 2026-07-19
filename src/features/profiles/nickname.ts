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
  grootsteZege: number; // grootste winstmarge
  nachtmatches: number; // gespeeld vanaf 21u
  bagelsGeincasseerd: number; // verloren met 0-6
  nipteZeges: number; // gewonnen met marge van 1
  ochtendmatches: number; // gespeeld vóór 10u
  weekendmatches: number; // gespeeld op zaterdag of zondag
  format1v1: number; // m.format === "1v1"
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
  let bagelsGeincasseerd = 0;
  let nipteZeges = 0;
  let ochtendmatches = 0;
  let weekendmatches = 0;
  let format1v1 = 0;

  for (const m of matches) {
    const o = outcomeFor(m, teams, playerId);
    if (!o) continue;
    gespeeld++;

    const d = matchDate(m);
    if (d) {
      const hours = d.getHours();
      if (hours >= 21) nachtmatches++;
      if (hours < 10) ochtendmatches++;
      const day = d.getDay(); // 0 = zondag, 6 = zaterdag
      if (day === 0 || day === 6) weekendmatches++;
    }

    if (m.format === "1v1") format1v1++;

    if (m.score_a != null && m.score_b != null) {
      const inA = inTeam(teams[m.team_a_id], playerId);
      const mij = inA ? m.score_a : m.score_b;
      const hen = inA ? m.score_b : m.score_a;
      const marge = mij - hen;

      if (o === "W") {
        gewonnen++;
        grootsteZege = Math.max(grootsteZege, marge);
        if (hen === 0 && mij > 0) bagelsUitgedeeld++;
        if (marge === 1) nipteZeges++;
      } else if (o === "L") {
        if (mij === 0 && hen > 0) bagelsGeincasseerd++;
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
    bagelsGeincasseerd,
    nipteZeges,
    ochtendmatches,
    weekendmatches,
    format1v1,
  };
}

interface BijnaamDef {
  naam: string;
  past(s: Stats): boolean;
}

// Volgorde is niet belangrijk: alle passende kandidaten dingen mee, de seed
// kiest. Voorwaarden zijn bewust afgeleid uit puur telbare matchdata.
const KANDIDATEN: BijnaamDef[] = [
  // Originele/Bestaande bijnamen (behoud de criteria/namen voor continuïteit)
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

  // Categorie A: Tactisch & Statistisch Drama
  { naam: "De Alibi-Padelspeler 🕵️", past: (s) => s.gespeeld >= 10 && s.winrate >= 0.45 && s.winrate <= 0.55 },
  { naam: "De Angstgegner van Zichzelf 😱", past: (s) => s.gespeeld >= 5 && s.winrate < 0.25 },
  { naam: "De Wandelende Bye 🎁", past: (s) => s.gespeeld >= 10 && s.winrate < 0.3 },
  { naam: "De Tactische Blunder 📓", past: (s) => s.gespeeld >= 15 && s.winrate < 0.35 },
  { naam: "De Sponsor van de Clubbar 🍻", past: (s) => s.gespeeld >= 20 && s.winrate < 0.4 },

  // Categorie B: Fysiek & Baan-gerelateerd
  { naam: "De Glazenwasser 🧼", past: (s) => s.bagelsGeincasseerd >= 1 },
  { naam: "De Windmolen van Veld 2 💨", past: (s) => s.gespeeld >= 10 && s.grootsteZege <= 2 },
  { naam: "De Net-Magneet 🕸️", past: (s) => s.gespeeld >= 10 && s.winrate < 0.45 },
  { naam: "De Ballenjongen-Schrik 💥", past: (s) => s.grootsteZege >= 6 },

  // Categorie C: Rudy’s Favorieten
  { naam: "De Spiekschrift-Fraudeur 📝", past: (s) => s.gespeeld >= 10 && s.winrate >= 0.7 },
  { naam: "De Vriend van Gianni Infantino 🤝", past: (s) => s.gespeeld >= 15 && s.winrate >= 0.6 },
  { naam: "De Witte Boorden-Pias 👔", past: (s) => s.gespeeld >= 30 },
  { naam: "De Rode Kaart-Verzamelaar 🟥", past: (s) => s.gespeeld >= 10 && s.winrate < 0.4 },

  // Categorie E: Extra's & Overige
  { naam: "De Vroege Vogel 🐦", past: (s) => s.ochtendmatches >= 3 },
  { naam: "De Ontsnappingskoning 🔑", past: (s) => s.nipteZeges >= 3 },
  { naam: "De Fietsenmaker 🚲", past: (s) => s.bagelsGeincasseerd >= 2 },
  { naam: "De Eenzame Wolf 🐺", past: (s) => s.format1v1 >= 3 },
  { naam: "Weekend Warrior 🛡️", past: (s) => s.weekendmatches >= 5 },
  { naam: "De Onverslaanbare 🏆", past: (s) => s.gespeeld >= 15 && s.winrate >= 0.8 },
  { naam: "De Klant is Koning 👑", past: (s) => s.gespeeld >= 20 && s.winrate < 0.3 },
  { naam: "De Geluksvogel 🍀", past: (s) => s.gespeeld >= 10 && s.winrate >= 0.65 && s.grootsteZege <= 2 },
  { naam: "De Tactische Stoomwals 🚂", past: (s) => s.grootsteZege >= 6 },
  { naam: "De Racket-Mishandelaar 🪵", past: (s) => s.gespeeld >= 10 && s.winrate < 0.4 },
  { naam: "De Lobbyist van de Tegenpartij 💼", past: (s) => s.gespeeld >= 10 && s.winrate < 0.3 },

  // Trump-gerelateerde bijnamen
  { naam: "Het Stabiele Genie 🧠", past: (s) => s.gespeeld >= 10 && s.winrate >= 0.65 },
  { naam: "De Muurbouwer 🧱", past: (s) => s.gespeeld >= 15 && s.winrate >= 0.6 },
  { naam: "De Fake News Verspreider 📰", past: (s) => s.gespeeld >= 10 && s.winrate < 0.35 },
  { naam: "De Rigged Match Klager 🗣️", past: (s) => s.bagelsGeincasseerd >= 1 },
  { naam: "De Crowd Size Opschepper 👥", past: (s) => s.gespeeld >= 25 },
  { naam: "De Big League Smasher 🚀", past: (s) => s.grootsteZege >= 6 },
];

/** Neutrale terugval als geen enkele kandidaat past (bv. 0 matches). */
const NEUTRAAL = [
  "De Racketzwaaier 🏸",
  "De Baanbewoner 🏕️",
  "De Puntenzoeker 🔎",
  "De Sportieveling 👟",
  "De Service-specialist 🎾",
  "De Lijnrechter 📏",
  "De Kooi-inspecteur 🧐",
  "De Racket-Mishandelaar 🪵",
  "De Ballenzoeker in de Struiken 🌳",
  "De Derde Helft-Kampioen 🍺",
  "De Kooi-Toerist 🗺️",
  "De Hobby-Zwaaier 🥋",
];

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
