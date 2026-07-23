// De Zwarte Piet 🃏 (#185): één rondgaand schande-token per groep. Telkens de
// laatste sukkel draagt 'm (recency): elke nieuwe kwalificerende afgang pakt de
// Piet af. Wint de drager een match, dan raakt hij 'm kwijt en gaat de Piet naar
// de eerstvolgende flopper. De mechaniek is volgorde-afhankelijk (zoals Elo),
// dus we replayen de volledige matchhistorie chronologisch — altijd correct, óók
// na score-correcties. `since` = speeldatum van de overname-match.
//
// Dit is de pure, geteste spiegel van recompute_zwarte_piet
// (supabase/schemas/functions/21_zwarte_piet.sql), net zoals pias.ts (pickPias)
// de spiegel van recompute_pias is. Kwalificerende afgangen en hun ernst-scores
// zijn dezelfde als de pias van de maand (maandpias.ts).

import type { Match, Team } from "@/types";
import { inTeam, playersOf } from "@/features/rating/results";
import { expected } from "@/features/rating/elo";
import {
  AFDROGING_DREMPEL,
  FAVORIET_DREMPEL,
  ZWARTE_REEKS_DREMPEL,
  type MatchRatings,
  type PiasReden,
} from "@/features/groups/maandpias";

/** De huidige drager van de Zwarte Piet in een groep (of null = vrij). */
export interface ZwartePiet {
  holderId: string;
  /** Van wie hij 'm afpakte (null als de Piet daarvoor vrij was). */
  fromId: string | null;
  reden: PiasReden;
  /** Ernst-score van de overname-afgang; hoe hoger, hoe gênanter. */
  ernst: number;
  /** Ludieke omschrijving zónder naam; de UI plakt de naam ervoor. */
  detail: string;
  matchId: string;
  /** Speeldatum van de overname-match, YYYY-MM-DD. */
  since: string;
}

/** De globale Zwarte Piet (#645): de drager over álle groepen heen. Spiegelt
 *  get_global_zwarte_piet — zelfde velden als ZwartePiet, maar zonder
 *  fromId/matchId (die lekken vreemde-groep-details) en mét het roast-schild
 *  van de drager: de kaart zwijgt dan (de Piet blijft wel de Piet). */
export interface GlobaleZwartePiet {
  playerId: string;
  reden: PiasReden;
  ernst: number;
  detail: string;
  /** Speeldatum van de overname-match, YYYY-MM-DD. */
  since: string;
  /** roast_schild (#183) van de drager: geen kaart-editie, niemand schuift door. */
  beschermd: boolean;
}

/**
 * Pure spiegel van get_global_zwarte_piet (supabase/schemas/functions/
 * 26_global_zwarte_piet.sql): uit de per-groep-dragers de Piet met de hoogste
 * ernst — tie-breaks: oudste since (draagt 'm het langst), laagste holderId,
 * dan groupId voor determinisme. Omdat de invoer de per-groep-dragers zijn, is
 * de globale Piet per definitie ook de Piet van z'n eigen groep. Anders dan de
 * globale pias geen weekvenster: het token is tijdloos, tot verlossing.
 */
export function pickGlobaleZwartePiet<
  T extends Pick<ZwartePiet, "holderId" | "ernst" | "since"> & { groupId: string },
>(rows: T[]): T | null {
  let best: T | null = null;
  for (const r of rows) {
    if (
      !best ||
      r.ernst > best.ernst ||
      (r.ernst === best.ernst &&
        (r.since < best.since ||
          (r.since === best.since &&
            (r.holderId < best.holderId ||
              (r.holderId === best.holderId && r.groupId < best.groupId)))))
    )
      best = r;
  }
  return best;
}

interface Flop {
  playerId: string;
  reden: PiasReden;
  ernst: number;
  detail: string;
}

const dagVan = (m: Match) => (m.played_at ?? m.created_at).slice(0, 10);
const tijd = (m: Match) => `${m.played_at ?? m.created_at}|${m.created_at}|${m.id}`;

/** Winkans van het (verliezende) team van de speler vóór de match, of null.
 *  Alleen zinvol als favoriet (kans ≥ 0.5). Uit rating_history.rating_before. */
function favorietKans(
  m: Match,
  teams: Record<string, Team>,
  playerId: string,
  ratings: MatchRatings | undefined,
): number | null {
  if (!ratings) return null;
  const inA = inTeam(teams[m.team_a_id], playerId);
  const mijn = inA ? teams[m.team_a_id] : teams[m.team_b_id];
  const tegen = inA ? teams[m.team_b_id] : teams[m.team_a_id];
  if (!mijn || !tegen) return null;
  const avg = (t: Team): number | null => {
    const p1 = ratings.get(t.player1_id)?.rating_before;
    if (p1 == null) return null;
    // Singles (1v1): de teamrating is de rating van de ene speler zelf
    // (spiegelt recompute_zwarte_piet in SQL).
    if (!t.player2_id) return p1;
    const p2 = ratings.get(t.player2_id)?.rating_before;
    return p2 == null ? null : (p1 + p2) / 2;
  };
  const mij = avg(mijn);
  const hen = avg(tegen);
  if (mij == null || hen == null) return null;
  const kans = expected(mij, hen);
  return kans >= 0.5 ? kans : null;
}

/** De ergste afgang van één verliezende speler in déze match, of null. Zelfde
 *  redenen/ernst als maandpias.ts, maar per match (streak = lopende reeks nu). */
function afgangVoor(
  playerId: string,
  mijnScore: number | null,
  hunScore: number | null,
  streak: number,
  kans: number | null,
): Flop | null {
  const kandidaten: Flop[] = [];
  if (mijnScore != null && hunScore != null) {
    if (mijnScore === 0 && hunScore > 0) {
      kandidaten.push({ playerId, reden: "bagel", ernst: 110, detail: "kreeg een bagel om de oren 🥯" });
    }
    const marge = hunScore - mijnScore;
    if (marge >= AFDROGING_DREMPEL) {
      kandidaten.push({
        playerId,
        reden: "afdroging",
        ernst: 50 + marge,
        detail: `werd met ${marge} games verschil vakkundig afgedroogd`,
      });
    }
  }
  if (streak >= ZWARTE_REEKS_DREMPEL) {
    kandidaten.push({
      playerId,
      reden: "zwarte-reeks",
      ernst: 40 + streak,
      detail: `stapelde verlies op verlies (${streak}× op rij)`,
    });
  }
  if (kans != null && kans >= FAVORIET_DREMPEL) {
    kandidaten.push({
      playerId,
      reden: "choke",
      ernst: 30 + Math.round(kans * 10),
      detail: `choke-te hard als favoriet (${Math.round(kans * 100)}% winkans vooraf)`,
    });
  }
  // Ergste reden wint; bij gelijke ernst maakt het niet uit (zelfde speler).
  return kandidaten.sort((a, b) => b.ernst - a.ernst)[0] ?? null;
}

/**
 * Replay van de Zwarte Piet over de (afgeronde) matches van één groep. De caller
 * filtert op groep. Geeft de huidige drager terug, of null als de Piet vrij is.
 */
export function zwartePiet(
  matches: Match[],
  teams: Record<string, Team>,
  ratingsByMatch?: Map<string, MatchRatings>,
): ZwartePiet | null {
  const chrono = matches
    .filter((m) => m.status === "completed")
    .sort((a, b) => tijd(a).localeCompare(tijd(b)));

  const streak = new Map<string, number>(); // lopende verliesreeks per speler
  let piet: ZwartePiet | null = null;

  for (const m of chrono) {
    const teamA = teams[m.team_a_id];
    const teamB = teams[m.team_b_id];
    if (!teamA || !teamB) continue;

    // Gelijkspel: geen winnaar, geen flop; breekt ieders verliesreeks.
    if (m.winner_team_id == null) {
      for (const p of [...playersOf(teamA), ...playersOf(teamB)]) {
        streak.set(p, 0);
      }
      continue;
    }

    const winnaar = m.winner_team_id === m.team_a_id ? teamA : teamB;
    const verliezer = m.winner_team_id === m.team_a_id ? teamB : teamA;
    const winners = playersOf(winnaar);
    const losers = playersOf(verliezer);
    for (const p of winners) streak.set(p, 0);

    const verliezerScore = m.winner_team_id === m.team_a_id ? m.score_b : m.score_a;
    const winnaarScore = m.winner_team_id === m.team_a_id ? m.score_a : m.score_b;

    const flops: Flop[] = [];
    for (const p of losers) {
      const s = (streak.get(p) ?? 0) + 1;
      streak.set(p, s);
      const flop = afgangVoor(
        p,
        verliezerScore,
        winnaarScore,
        s,
        favorietKans(m, teams, p, ratingsByMatch?.get(m.id)),
      );
      if (flop) flops.push(flop);
    }

    // Ergste flopper van deze match (hoogste ernst, tie-break kleinste id).
    const worst = flops.sort(
      (a, b) => b.ernst - a.ernst || (a.playerId < b.playerId ? -1 : 1),
    )[0];

    if (worst) {
      // Recency: een nieuwe flopper pakt de Piet af. Dezelfde drager die opnieuw
      // flopt houdt 'm (since blijft lopen).
      if (!piet || piet.holderId !== worst.playerId) {
        const vorige: string | null = piet ? piet.holderId : null;
        piet = {
          holderId: worst.playerId,
          fromId: vorige,
          reden: worst.reden,
          ernst: worst.ernst,
          detail: worst.detail,
          matchId: m.id,
          since: dagVan(m),
        };
      }
      continue;
    }

    // Geen flop; wint de drager deze match, dan is hij verlost → Piet vrij.
    if (piet && winners.includes(piet.holderId)) piet = null;
  }

  return piet;
}
