import { categorize, otherId } from "@/features/friends/api";
import type { GroupSummary } from "@/features/groups/api";
import type { Friendship, Profile } from "@/types";

/**
 * Wat `profiles.discoverable` betekent (#1014):
 *
 *   Uit = je verschijnt niet in lijsten waarin iemand je zou kunnen ontdekken of
 *   aangeboden krijgt. Je blijft zichtbaar waar je zelf al meedoet — klassement,
 *   matches waarin je speelt, groepen waar je lid van bent — en voor je vrienden
 *   en groepsgenoten.
 *
 * De tweede helft van die regel is essentieel: zonder uitzondering kun je een
 * verborgen clubgenoot niet meer aantikken, en dan wordt de privacy-toggle een
 * blokkade voor anderen in plaats van rust voor jezelf.
 */

/** Ids die ik hoe dan ook mag zien: ikzelf, mijn geaccepteerde vrienden en
 *  mijn groepsgenoten. `groups` komt van `getMyGroups()`, dat `member_ids` al
 *  meelevert — geen extra fetch per groep nodig. */
export function bekendeSpelerIds(
  friendships: Friendship[],
  groups: GroupSummary[],
  myId: string,
): Set<string> {
  const bekend = new Set<string>();
  if (myId) bekend.add(myId);
  // categorize() houdt bewust alleen vriendschappen over waar ik zelf in zit;
  // sinds #326 zijn ook die van groepsgenoten leesbaar.
  for (const f of categorize(friendships, myId).accepted) {
    bekend.add(otherId(f, myId));
  }
  for (const g of groups) {
    for (const id of g.member_ids) bekend.add(id);
  }
  return bekend;
}

/** Verborgen spelers eruit, behalve wie ik al ken (`bekend`) of expliciet
 *  opvraag (`altijd` — bv. de speler wiens profiel al open staat).
 *  Test op `!== false`: `Profile.discoverable` is optioneel en een profiel dat
 *  het veld niet meelevert geldt als zichtbaar, net als de DB-default. */
export function zichtbareSpelers<T extends Profile>(
  lijst: T[],
  bekend: Set<string>,
  altijd: (string | null | undefined)[] = [],
): T[] {
  const vrij = new Set(altijd.filter(Boolean) as string[]);
  return lijst.filter(
    (p) => p.discoverable !== false || bekend.has(p.id) || vrij.has(p.id),
  );
}
