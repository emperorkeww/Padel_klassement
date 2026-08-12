// Volgorde van de spelerslijst in het match-sheet (#1183).
//
// De lijst stond in de volgorde waarin de aanroeper hem toevallig aanleverde.
// Met twintig-plus namen betekent dat scrollen of zoeken voor mensen met wie je
// elke week speelt. Vier regels, van boven naar beneden: jijzelf, wie je het
// laatst meenam, de rest alfabetisch, en gasten onderaan.
//
// "Het laatst meegenomen" en niet "het vaakst mee gespeeld": speelfrequentie
// staat in de databank en zou een extra query per opening kosten, terwijl de
// vorige keer al bijna altijd het goede antwoord is. De lijst komt uit
// localStorage en faalt stil zonder storage (private mode) — zelfde afspraak
// als matchDraft.ts.

import { displayName } from "@/features/profiles/api";
import type { Profile } from "@/types";

/** Hoeveel medespelers we onthouden. Ruim genoeg voor een vaste ploeg, kort
 *  genoeg dat "recent" nog iets betekent. */
const MAX_RECENT = 8;

// Sleutel per groep: met wie je in de ene groep speelt zegt niets over de
// andere. Zelfde vorm als de conceptsleutel in matchDraft.ts.
function key(groupId: string | null): string {
  return `vamos:match-mru:${groupId ?? "none"}`;
}

/** De laatst meegenomen spelers, nieuwste eerst. Leeg als er niets (leesbaars)
 *  staat — een kapotte of volgeschreven storage mag de kiezer niet breken. */
export function leesRecent(groupId: string | null): string[] {
  try {
    const ruw = localStorage.getItem(key(groupId));
    if (!ruw) return [];
    const lijst: unknown = JSON.parse(ruw);
    if (!Array.isArray(lijst)) return [];
    return lijst.filter((id): id is string => typeof id === "string");
  } catch {
    return [];
  }
}

/** Zet de zojuist gekozen spelers vooraan; de rest schuift op. Jezelf hoort er
 *  niet in: je staat toch al bovenaan, en anders eet je een plek op. */
export function onthoudRecent(
  groupId: string | null,
  ids: string[],
  myId: string,
): void {
  try {
    const nieuw = [...new Set([...ids.filter((id) => id !== myId), ...leesRecent(groupId)])];
    localStorage.setItem(key(groupId), JSON.stringify(nieuw.slice(0, MAX_RECENT)));
  } catch {
    // Geen storage, geen geheugen. De lijst staat dan gewoon alfabetisch.
  }
}

/** Jij eerst, dan wie je het laatst meenam, dan alfabetisch, gasten onderaan. */
export function sorteerSpelers(
  spelers: Profile[],
  { myId, recent }: { myId: string; recent: string[] },
): Profile[] {
  const rang = (p: Profile): number => {
    if (p.is_guest) return 3;
    if (p.id === myId) return 0;
    return recent.includes(p.id) ? 1 : 2;
  };
  return [...spelers].sort((a, b) => {
    const verschil = rang(a) - rang(b);
    if (verschil !== 0) return verschil;
    // Binnen "recent" telt hoe recent: de eerste in de lijst staat bovenaan.
    if (rang(a) === 1) return recent.indexOf(a.id) - recent.indexOf(b.id);
    return displayName(a).localeCompare(displayName(b), "nl");
  });
}
