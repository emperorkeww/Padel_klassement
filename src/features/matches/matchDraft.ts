// Concept-opslag van een lopende match-invoer (#462). De NewMatchSheet hield
// zijn state alleen in de component en wiste alles bij elk openen; een
// verbroken verbinding, een per ongeluk gesloten sheet of een refresh gooide de
// hele invoer weg. Hier persisteren we het concept naar localStorage, zodat de
// gebruiker een onafgemaakte match kan hervatten. Faalt stil zonder storage
// (private mode) — net als src/lib/utils/localFlag.ts.

import type { CourtType, MatchFormat } from "@/types";
import type { SetPair } from "@/features/matches/api";
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
 *  minstens één speler, een score, een tijdstip, een baantype of een set-stand. */
export function isDraftMeaningful(d: MatchDraft): boolean {
  return (
    d.teamA.length > 0 ||
    d.teamB.length > 0 ||
    d.scoreA !== "" ||
    d.scoreB !== "" ||
    d.when !== "" ||
    d.courtType !== null ||
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
