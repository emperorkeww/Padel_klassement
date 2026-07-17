// Vendetta's (#169): de lopende verhaallijn bovenop een verklaarde rivaliteit.
// De DB bewaart alleen het contract (vendettaApi.ts); alles hier is puur en
// client-side afgeleid uit de al geladen matches + teams, zodat score-
// correcties automatisch doorwerken — zelfde filosofie als rivalry.ts.
// Het "seizoen" is een race: wie het eerst target_wins onderlinge
// overwinningen pakt sinds de start, beslist de vendetta.

import type { Match, RoastIntensiteit, Team } from "@/types";
import { inTeam } from "@/features/rating/results";
import { kiesUniek } from "@/features/coach/roastTone";

/** De velden van het vendetta-contract die de stand nodig heeft — structureel
 *  gelijk aan (een subset van) vendettaApi.Vendetta, maar zonder import zodat
 *  deze module puur blijft. */
export interface VendettaContract {
  challenger_id: string;
  rival_id: string;
  target_wins: number;
  started_at: string;
}

export interface VendettaDuel {
  match: Match;
  /** null = gelijkspel. */
  winnerId: string | null;
}

export interface VendettaStand {
  /** Meegetelde duels: als tegenstanders, afgerond, sinds de start. */
  played: number;
  winsChallenger: number;
  winsRival: number;
  draws: number;
  /** Wie er voorstaat; null bij gelijke stand of nog geen duels. */
  leiderId: string | null;
  /** Momenten waarop de leiding van kant wisselde, chronologisch. */
  omslagen: Array<{ match: Match; nieuweLeiderId: string }>;
  /** Het duel waarmee iemand het doel haalde; duels erna tellen niet mee. */
  beslist: { winnaarId: string; match: Match } | null;
  laatste: VendettaDuel | null;
}

/**
 * De tussenstand van een vendetta uit de (volledige) groepshistorie. Telt
 * alleen afgeronde matches waarin de twee betrokkenen als tégenstanders
 * stonden en die op of na de start vielen; stopt bij het duel waarmee iemand
 * `target_wins` haalt — daarna is het seizoen beslist en bevroren.
 */
export function vendettaStand(
  v: VendettaContract,
  matches: Match[],
  teams: Record<string, Team>,
): VendettaStand {
  const duels = matches
    .filter(
      (m) =>
        m.status === "completed" &&
        (m.played_at ?? m.created_at) >= v.started_at,
    )
    .sort((x, y) =>
      (x.played_at ?? x.created_at).localeCompare(y.played_at ?? y.created_at),
    );

  const stand: VendettaStand = {
    played: 0,
    winsChallenger: 0,
    winsRival: 0,
    draws: 0,
    leiderId: null,
    omslagen: [],
    beslist: null,
    laatste: null,
  };
  // Laatste niet-nul teken van winsChallenger - winsRival; een omslag gaat
  // altijd via een gelijke stand, dus het tekenverschil alleen volstaat niet
  // (zelfde aanpak als lastLeader in rivalry.ts).
  let lastLeader = 0;

  for (const m of duels) {
    const ta = teams[m.team_a_id];
    const tb = teams[m.team_b_id];
    if (!ta || !tb) continue;
    const chInA = inTeam(ta, v.challenger_id);
    const chInB = inTeam(tb, v.challenger_id);
    const rvInA = inTeam(ta, v.rival_id);
    const rvInB = inTeam(tb, v.rival_id);
    // Alleen duels als tegenstanders tellen; als partners of afwezig niet.
    if (!((chInA && rvInB) || (chInB && rvInA))) continue;

    let winnerId: string | null = null;
    if (m.winner_team_id === m.team_a_id)
      winnerId = chInA ? v.challenger_id : v.rival_id;
    else if (m.winner_team_id === m.team_b_id)
      winnerId = chInB ? v.challenger_id : v.rival_id;

    stand.played++;
    if (winnerId === null) stand.draws++;
    else if (winnerId === v.challenger_id) stand.winsChallenger++;
    else stand.winsRival++;
    stand.laatste = { match: m, winnerId };

    const leadAfter = Math.sign(stand.winsChallenger - stand.winsRival);
    if (leadAfter !== 0) {
      if (lastLeader !== 0 && leadAfter !== lastLeader) {
        stand.omslagen.push({
          match: m,
          nieuweLeiderId: leadAfter > 0 ? v.challenger_id : v.rival_id,
        });
      }
      lastLeader = leadAfter;
    }

    if (
      stand.winsChallenger >= v.target_wins ||
      stand.winsRival >= v.target_wins
    ) {
      stand.beslist = {
        winnaarId:
          stand.winsChallenger >= v.target_wins ? v.challenger_id : v.rival_id,
        match: m,
      };
      break;
    }
  }

  stand.leiderId =
    stand.winsChallenger === stand.winsRival
      ? null
      : stand.winsChallenger > stand.winsRival
        ? v.challenger_id
        : v.rival_id;
  return stand;
}

/** Tussenstand als leesbare kop: "Tom leidt 4–2", "Gelijk 2–2" of een
 *  aansporing zolang er nog niet gespeeld is. De stand staat vanuit de leider. */
export function vendettaKop(
  stand: VendettaStand,
  v: VendettaContract,
  nameOf: (id: string) => string,
): string {
  if (stand.played === 0) return "Nog geen duels — plan de eerste confrontatie!";
  if (stand.leiderId === null)
    return `Gelijk ${stand.winsChallenger}–${stand.winsRival}`;
  const leiderIsCh = stand.leiderId === v.challenger_id;
  const voor = leiderIsCh ? stand.winsChallenger : stand.winsRival;
  const tegen = leiderIsCh ? stand.winsRival : stand.winsChallenger;
  return `${nameOf(stand.leiderId)} leidt ${voor}–${tegen}`;
}

// Taunts na een gewonnen vendetta-duel, per roast-intensiteit van de groep.
// Speels en over padel/ego — plagen, geen kwetsen (zie roastTone.ts).
// Sjablonen: {winnaar}, {verliezer}, {stand} (stand vanuit de winnaar).
const TAUNTS: Record<RoastIntensiteit, readonly string[]> = {
  mild: [
    "{winnaar} prikt er eentje bij: {stand}. {verliezer}, de revanche staat vast al in je agenda?",
    "Punt voor {winnaar} ({stand}). {verliezer} noemt het 'tactisch verlies'.",
    "{winnaar} neemt de bragging rights van vandaag mee naar huis: {stand}.",
    "{stand} voor {winnaar}. {verliezer}, rustig ademhalen — het is een marathon, geen sprint.",
    "{winnaar} schuift een bolletje op: {stand}. Wordt vervolgd.",
  ],
  gemeen: [
    "{winnaar} maakt er {stand} van. {verliezer} bestudeert de achterwand nog even na.",
    "Alweer {winnaar}: {stand}. {verliezer}, je smoes ligt klaar bij de bar.",
    "{stand}. {winnaar} speelt padel, {verliezer} speelt figurant.",
    "{winnaar} loopt uit naar {stand} en {verliezer} loopt vooral achter de bal aan.",
    "Vendetta-les van {winnaar} ({stand}): eerst de bal, dán het praatje, {verliezer}.",
  ],
  radioactief: [
    "{winnaar} zet de teller op {stand}. {verliezer} zet de tranen op ongezouten.",
    "{stand}. Dit is geen vendetta meer, {verliezer}, dit is liefdadigheid van {winnaar}.",
    "{winnaar} sloopt de stand naar {stand}; {verliezer} mag het glas gaan poetsen dat-ie zo vaak raakte.",
    "Iemand een brancard voor {verliezer}? {winnaar} walst door: {stand}.",
    "{stand} voor {winnaar}. {verliezer}, je racket overweegt een transfer.",
  ],
};

/**
 * Taunt bij het laatste gewonnen duel, deterministisch per seed (bv.
 * roastSeed(vendettaId, matchId)) zodat de hele groep dezelfde ziet.
 * `stand` staat vanuit de winnaar, bv. "4–2".
 */
export function vendettaTaunt(input: {
  winnaar: string;
  verliezer: string;
  stand: string;
  intensiteit: RoastIntensiteit;
  seed: number;
}): string {
  return kiesUniek(TAUNTS[input.intensiteit], input.seed)
    .replaceAll("{winnaar}", input.winnaar)
    .replaceAll("{verliezer}", input.verliezer)
    .replaceAll("{stand}", input.stand);
}
