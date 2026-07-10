import type { Friendship, Match, Team } from "./types";

/** De ándere speler in een vriendschap (zelfde logica als friends/api). */
const otherId = (f: Friendship, myId: string) =>
  f.requester_id === myId ? f.addressee_id : f.requester_id;

// Feed-opbouw (#120): gebeurtenissen van jou en je vrienden, chronologisch
// (nieuwste boven), client-side geaggregeerd uit al beschikbare bronnen.
// Puur en getest in feed.test.ts; de UI (features/feed) doet alleen weergave.

export type FeedEvent =
  | { kind: "match"; at: string; match: Match }
  | { kind: "friendship"; at: string; meId: string; friendId: string };

/** Zoveel gebeurtenissen toont de feed maximaal (recent venster, geen paginatie). */
export const FEED_LIMIT = 50;

/** Speler-ids in je netwerk: jijzelf + geaccepteerde vrienden. */
export function networkIds(friendships: Friendship[], myId: string): Set<string> {
  const ids = new Set([myId]);
  for (const f of friendships) {
    if (f.status === "accepted") ids.add(otherId(f, myId));
  }
  return ids;
}

/**
 * Bouwt de feed: afgeronde matches waarin iemand uit je netwerk meespeelde,
 * plus je eigen geaccepteerde vriendschappen (andermans vriendschappen zijn
 * per RLS niet zichtbaar). Gesorteerd op tijdstip, nieuwste eerst.
 */
export function buildFeed(input: {
  matches: Match[];
  teams: Record<string, Team>;
  friendships: Friendship[];
  myId: string;
  limit?: number;
}): FeedEvent[] {
  const { matches, teams, friendships, myId, limit = FEED_LIMIT } = input;
  const network = networkIds(friendships, myId);

  const events: FeedEvent[] = [];

  for (const m of matches) {
    if (m.status !== "completed") continue;
    const players = [teams[m.team_a_id], teams[m.team_b_id]]
      .filter(Boolean)
      .flatMap((t) => [t!.player1_id, t!.player2_id]);
    if (!players.some((pid) => network.has(pid))) continue;
    events.push({ kind: "match", at: m.played_at ?? m.created_at, match: m });
  }

  for (const f of friendships) {
    if (f.status !== "accepted") continue;
    events.push({
      kind: "friendship",
      // updated_at ≈ het moment van accepteren.
      at: f.updated_at ?? f.created_at,
      meId: myId,
      friendId: otherId(f, myId),
    });
  }

  return events.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}

/** Kalenderdag (YYYY-MM-DD) van een gebeurtenis, voor de dag-kopjes. */
export function feedDay(event: FeedEvent): string {
  return event.at.slice(0, 10);
}
