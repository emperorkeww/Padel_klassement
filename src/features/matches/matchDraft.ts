// Concept-opslag van een lopende match-invoer (#462). De NewMatchSheet hield
// zijn state alleen in de component en wiste alles bij elk openen; een
// verbroken verbinding, een per ongeluk gesloten sheet of een refresh gooide de
// hele invoer weg. Hier persisteren we het concept naar localStorage, zodat de
// gebruiker een onafgemaakte match kan hervatten. Faalt stil zonder storage
// (private mode) — net als src/lib/utils/localFlag.ts.

import type { CourtType, MatchFormat } from "@/types";
import type { SetPair } from "@/features/matches/api";
import type { JokerId } from "@/features/matches/jokers";
import type { NewMatchMode } from "@/features/matches/components/NewMatchSheet";

/** De persisteerbare velden van een lopende match-invoer. Bewust géén gasten
 *  (die bestaan server-side pas na een live RPC) of vluchtige zoekterm. */
export type MatchDraft = {
  teamA: string[];
  teamB: string[];
  format: MatchFormat;
  step: 1 | 2;
  scoreA: string;
  scoreB: string;
  showSets: boolean;
  sets: SetPair[];
  when: string;
  courtType: CourtType | null;
  /** Drankje-inzet (#1004); optioneel omdat concepten van vóór die feature
   *  nog in localStorage kunnen staan. */
  wagerDrink?: string | null;
  wagerQty?: number;
  /** Jokerkeuze (#1003); optioneel omdat concepten van vóór die feature nog in
   *  localStorage kunnen staan. */
  joker?: JokerId | null;
  repeat: boolean;
  repeatWeeks: number;
  pickedGroupId: string;
  savedAt: number;
};

// Sleutel per modus + groepscontext, zodat een score-concept en een
// plan-concept (of concepten in verschillende groepen) elkaar niet overschrijven.
function key(mode: NewMatchMode, groupId: string | null): string {
  return `vamos:match-draft:${mode}:${groupId ?? "none"}`;
}

/** Een concept is pas het bewaren/hervatten waard als er echt iets is ingevuld:
 *  minstens één speler, een score, een tijdstip, een baantype, een drankje-inzet,
 *  een joker of een set-stand. */
export function isDraftMeaningful(d: MatchDraft): boolean {
  return (
    d.teamA.length > 0 ||
    d.teamB.length > 0 ||
    d.scoreA !== "" ||
    d.scoreB !== "" ||
    d.when !== "" ||
    d.courtType !== null ||
    (d.wagerDrink ?? null) !== null ||
    (d.joker ?? null) !== null ||
    d.sets.some((s) => s.a !== "" || s.b !== "")
  );
}

export function readDraft(
  mode: NewMatchMode,
  groupId: string | null,
): MatchDraft | null {
  try {
    const raw = localStorage.getItem(key(mode, groupId));
    if (!raw) return null;
    const draft = JSON.parse(raw) as MatchDraft;
    // Half-geschreven of leeggelopen concept: negeren i.p.v. een lege sheet
    // "hervatten".
    return isDraftMeaningful(draft) ? draft : null;
  } catch {
    return null;
  }
}

export function writeDraft(
  mode: NewMatchMode,
  groupId: string | null,
  draft: MatchDraft,
): void {
  try {
    localStorage.setItem(key(mode, groupId), JSON.stringify(draft));
  } catch {
    // storage niet beschikbaar — negeer
  }
}

export function clearDraft(mode: NewMatchMode, groupId: string | null): void {
  try {
    localStorage.removeItem(key(mode, groupId));
  } catch {
    // storage niet beschikbaar — negeer
  }
}

/* ------------------------------------------------------------------ */
/* Score-concept van één match (#1271)                                 */
/* ------------------------------------------------------------------ */

/**
 * De invoer in de score-sheet, per match.
 *
 * `ScoreSheet` had geen concept, terwijl elk sheet sinds #1180 met een veeg
 * omlaag sluit: half ingetikte score, kleine veeg, weg. Bewust sessionStorage
 * en niet localStorage — een halve score van vorige week hoort niet terug te
 * komen; deze avond, dit tabblad is precies lang genoeg.
 */
export type ScoreDraft = {
  scoreA: string;
  scoreB: string;
  sets: SetPair[];
  setsOpen: boolean;
};

const scoreKey = (matchId: string) => `vamos:score-draft:${matchId}`;

export function readScoreDraft(matchId: string): ScoreDraft | null {
  try {
    const raw = sessionStorage.getItem(scoreKey(matchId));
    if (!raw) return null;
    const d = JSON.parse(raw) as ScoreDraft;
    // Alleen een concept mét invoer is er een; anders opent de sheet gewoon
    // met de stand die er al ligt.
    const iets =
      d.scoreA !== "" ||
      d.scoreB !== "" ||
      (d.sets ?? []).some((s) => s.a !== "" || s.b !== "");
    return iets ? d : null;
  } catch {
    return null;
  }
}

export function writeScoreDraft(matchId: string, draft: ScoreDraft): void {
  try {
    sessionStorage.setItem(scoreKey(matchId), JSON.stringify(draft));
  } catch {
    /* geen storage — dan is het concept er gewoon niet */
  }
}

export function clearScoreDraft(matchId: string): void {
  try {
    sessionStorage.removeItem(scoreKey(matchId));
  } catch {
    /* idem */
  }
}
