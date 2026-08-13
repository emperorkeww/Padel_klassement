import { dayInZone } from "@/lib/utils/time";
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

/**
 * De eerste ronde in de groep waarvan de uitslagen nog moeten komen (#1271).
 *
 * Dit is de blokkade van `generate_mexicano_round`, en die kijkt naar de hele
 * groep — niet naar de dag die je toevallig openhebt. De UI keek eerst alleen
 * naar de matches van die ene speeldag, dus een ronde die vorige week is blijven
 * hangen gaf een groene knop en dan een serverfout die nergens op sloeg. De dag
 * gaat mee terug, zodat de melding kan zeggen wélke avond nog openstaat.
 *
 * Alleen `scheduled` telt: een geannuleerde match levert nooit meer een uitslag
 * en zou de groep anders permanent blokkeren — dezelfde regel als de RPC.
 */
export function openGeplandeRonde(
  matches: Match[],
  timeZone: string,
): { round: number; dag: string } | null {
  const open = matches.filter((m) => m.status === "scheduled");
  if (open.length === 0) return null;
  const wanneer = (m: Match) =>
    new Date(m.played_at ?? m.created_at).getTime();
  const eerste = open.reduce((a, b) => (wanneer(a) <= wanneer(b) ? a : b));
  return {
    round: eerste.round_number ?? 0,
    dag: dayInZone(eerste.played_at ?? eerste.created_at, timeZone),
  };
}
