import type { Match } from "@/types";

/**
 * Groepeert matches per ronde (round_number), losse matches op ronde 0, en
 * sorteert de rondes aflopend zodat de nieuwste bovenaan staat.
 */
export function groupByRound(
  matches: Match[],
): { round: number; list: Match[] }[] {
  const map = new Map<number, Match[]>();
  for (const m of matches) {
    const r = m.round_number ?? 0;
    if (!map.has(r)) map.set(r, []);
    map.get(r)!.push(m);
  }
  return [...map.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([round, list]) => ({ round, list }));
}
