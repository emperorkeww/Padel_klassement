import type {
  Friendship,
  GroupMember,
  Match,
  PlayerStanding,
  Profile,
  RatingPoint,
  Team,
} from "./types";
import { expected } from "./elo";
import { MONSTERZEGE_DREMPEL } from "./badges";
import { outcomeFor } from "./results";
import { rankShifts, type Shift } from "./rankShift";
import { computePlayerStandings, matchesInSeason } from "./standings";
import { isSeasonClosed, seasonFor, type Season } from "./seasons";

/** De ándere speler in een vriendschap (zelfde logica als friends/api). */
const otherId = (f: Friendship, myId: string) =>
  f.requester_id === myId ? f.addressee_id : f.requester_id;

// Feed-opbouw (#120, uitgebreid in #138): gebeurtenissen van jou en je
// vrienden, chronologisch (nieuwste boven), client-side geaggregeerd uit al
// beschikbare bronnen. Anti-ruis: alles wat bij één match hoort (upset,
// opvallende score, reeks, rating-mijlpaal) wordt een highlight-chip op het
// match-item — losse items zijn er alleen voor niet-match-gebeurtenissen.
// Puur en getest in feed.test.ts; de UI (features/feed) doet alleen weergave.

/** Winkans-grens: won een team met minder kans dan dit, dan is het een upset. */
export const UPSET_MAX_KANS = 0.35;
/** Winreeksen die een highlight verdienen (zelfde stappen als de badges). */
export const REEKS_STAPPEN = [3, 5, 10] as const;
/** Rating-grenzen die een highlight verdienen (zelfde tiers als de badges). */
export const RATING_DREMPELS = [1100, 1200, 1300] as const;
/** Minste plaatsen stijging/daling voor een klassement-item. */
export const RANK_SPRONG = 3;
/** Zo lang na het sluiten van een kwartaal melden we de kampioen nog. */
export const KAMPIOEN_VENSTER_DAGEN = 21;

export type Highlight =
  | { type: "upset"; chance: number }
  | { type: "score"; label: "bagel" | "monsterzege" | "nagelbijter" }
  | { type: "streak"; playerId: string; count: number }
  | { type: "rating"; playerId: string; threshold: number };

export type FeedEvent =
  | { kind: "match"; at: string; match: Match; highlights: Highlight[]; myDelta: number | null }
  | { kind: "friendship"; at: string; a: string; b: string }
  | { kind: "planned"; at: string; match: Match }
  | { kind: "group-created"; at: string; groupId: string; groupName: string; playerId: string | null }
  | { kind: "group-joined"; at: string; groupId: string; groupName: string; playerId: string }
  | { kind: "poll"; at: string; groupId: string; groupName: string }
  | { kind: "rank"; at: string; playerId: string; shift: Shift; rank: number }
  | { kind: "season-champion"; at: string; groupId: string; groupName: string; playerId: string; seasonLabel: string };

/** Zoveel gebeurtenissen toont de feed per "pagina" ("Toon meer" laadt bij). */
export const FEED_LIMIT = 50;

/** Structurele invoer voor groepen/polls: houdt lib los van feature-API's. */
export interface FeedGroup {
  id: string;
  name: string;
  created_at: string;
  created_by?: string | null;
}
export interface FeedPoll {
  group_id: string;
  status: string;
  created_at: string;
}

/** Speler-ids in je netwerk: jijzelf + geaccepteerde vrienden. */
export function networkIds(friendships: Friendship[], myId: string): Set<string> {
  const ids = new Set([myId]);
  for (const f of friendships) {
    // Sinds #138 zijn ook vriendschappen van groepsgenoten leesbaar; alleen
    // rijen waar ik zelf in zit maken iemand mijn "vriend".
    if (
      f.status === "accepted" &&
      (f.requester_id === myId || f.addressee_id === myId)
    ) {
      ids.add(otherId(f, myId));
    }
  }
  return ids;
}

/** Spelers van een match (beide teams), lege lijst als teams onbekend zijn. */
function playersOf(m: Match, teams: Record<string, Team>): string[] {
  return [teams[m.team_a_id], teams[m.team_b_id]]
    .filter(Boolean)
    .flatMap((t) => [t!.player1_id, t!.player2_id]);
}

/** rating_history omgeklapt naar match → speler → punt (voor delta's/upsets). */
function pointsByMatch(
  histories: Record<string, RatingPoint[]>,
): Map<string, Map<string, RatingPoint>> {
  const byMatch = new Map<string, Map<string, RatingPoint>>();
  for (const [playerId, points] of Object.entries(histories)) {
    for (const p of points) {
      let inner = byMatch.get(p.match_id);
      if (!inner) byMatch.set(p.match_id, (inner = new Map()));
      inner.set(playerId, p);
    }
  }
  return byMatch;
}

/** Emoji + korte tekst per highlight; de UI plakt er namen bij. */
export function scoreHighlight(m: Match): Highlight | null {
  if (m.score_a == null || m.score_b == null || m.winner_team_id == null) {
    return null;
  }
  const hi = Math.max(m.score_a, m.score_b);
  const lo = Math.min(m.score_a, m.score_b);
  // Eén score-chip per match; bagel is het sterkste verhaal, dan monsterzege.
  if (lo === 0 && hi > 0) return { type: "score", label: "bagel" };
  if (hi - lo >= MONSTERZEGE_DREMPEL) return { type: "score", label: "monsterzege" };
  if (hi - lo === 1) return { type: "score", label: "nagelbijter" };
  return null;
}

/**
 * Upset: winkans van het winnende team vóór de match (échte pre-match ratings
 * uit rating_history) lager dan UPSET_MAX_KANS. Zonder volledige ratings voor
 * alle vier de spelers: geen uitspraak (null).
 */
export function upsetHighlight(
  m: Match,
  teams: Record<string, Team>,
  points: Map<string, RatingPoint> | undefined,
): Highlight | null {
  if (!m.winner_team_id || !points) return null;
  const winner = teams[m.winner_team_id];
  const loserId = m.winner_team_id === m.team_a_id ? m.team_b_id : m.team_a_id;
  const loser = teams[loserId];
  if (!winner || !loser) return null;
  const avg = (t: Team): number | null => {
    const p1 = points.get(t.player1_id)?.rating_before;
    const p2 = points.get(t.player2_id)?.rating_before;
    return p1 == null || p2 == null ? null : (p1 + p2) / 2;
  };
  const w = avg(winner);
  const l = avg(loser);
  if (w == null || l == null) return null;
  const chance = expected(w, l);
  return chance < UPSET_MAX_KANS ? { type: "upset", chance } : null;
}

/**
 * Bouwt de feed. Alleen `matches`/`teams`/`friendships`/`myId` zijn verplicht;
 * elke extra bron ontsluit extra gebeurtenistypen (de UI levert wat geladen is).
 */
export function buildFeed(input: {
  matches: Match[];
  teams: Record<string, Team>;
  friendships: Friendship[];
  myId: string;
  limit?: number;
  /** rating_history per speler → ▲/▼-delta's, upsets en rating-mijlpalen. */
  histories?: Record<string, RatingPoint[]>;
  /** Globale stand → klassementsprongen (rankShifts). */
  standings?: PlayerStanding[];
  /** Eigen groepen (+ leden en polls) → groeps- en poll-items. */
  groups?: FeedGroup[];
  membersByGroup?: Record<string, GroupMember[]>;
  pollsByGroup?: Record<string, FeedPoll[]>;
  /** Afgeronde matches per groep → seizoenskampioenen (alleen recent gesloten). */
  groupMatchesByGroup?: Record<string, Match[]>;
  profiles?: Record<string, Profile>;
  now?: Date;
}): FeedEvent[] {
  const {
    matches,
    teams,
    friendships,
    myId,
    limit = FEED_LIMIT,
    histories = {},
    standings,
    groups = [],
    membersByGroup = {},
    pollsByGroup = {},
    groupMatchesByGroup = {},
    profiles = {},
    now = new Date(),
  } = input;
  // Publiek van de feed: jijzelf + vrienden + iedereen met wie je een groep
  //  deelt — hun matches, reeksen, rating- en klassementsnieuws zijn zichtbaar.
  const network = networkIds(friendships, myId);
  for (const members of Object.values(membersByGroup)) {
    for (const m of members) network.add(m.player_id);
  }
  const byMatch = pointsByMatch(histories);
  const events: FeedEvent[] = [];

  // ── Matches (afgerond, met highlights) en geplande matches ──
  const networkMatches = matches.filter((m) =>
    playersOf(m, teams).some((pid) => network.has(pid)),
  );

  // Reeks-detectie: per netwerk-speler de chronologische uitkomsten binnen het
  // venster; raakt een winreeks op een match exact 3/5/10, dan hoort de chip
  // bij díe match. (Reeksen die vóór het venster begonnen tellen mogelijk
  // lager — bewust geaccepteerd, het venster is ruim.)
  const chrono = [...networkMatches].sort((a, b) =>
    (a.played_at ?? a.created_at).localeCompare(b.played_at ?? b.created_at),
  );
  const streakAt = new Map<string, Highlight[]>(); // match_id → streak-chips
  for (const pid of network) {
    let run = 0;
    for (const m of chrono) {
      const o = outcomeFor(m, teams, pid);
      if (!o) continue;
      run = o === "W" ? run + 1 : 0;
      if ((REEKS_STAPPEN as readonly number[]).includes(run)) {
        const list = streakAt.get(m.id) ?? [];
        list.push({ type: "streak", playerId: pid, count: run });
        streakAt.set(m.id, list);
      }
    }
  }

  for (const m of networkMatches) {
    if (m.status === "completed") {
      const points = byMatch.get(m.id);
      const highlights: Highlight[] = [];

      const upset = upsetHighlight(m, teams, points);
      if (upset) highlights.push(upset);
      const score = scoreHighlight(m);
      if (score) highlights.push(score);
      highlights.push(...(streakAt.get(m.id) ?? []));
      // Rating-mijlpaal: een netwerk-speler kruiste bij deze match een grens.
      if (points) {
        for (const [pid, p] of points) {
          if (!network.has(pid)) continue;
          for (const t of RATING_DREMPELS) {
            if (p.rating_before < t && p.rating_after >= t) {
              highlights.push({ type: "rating", playerId: pid, threshold: t });
            }
          }
        }
      }

      events.push({
        kind: "match",
        at: m.played_at ?? m.created_at,
        match: m,
        highlights,
        myDelta: points?.get(myId)?.delta ?? null,
      });
    } else if (m.status !== "cancelled" && m.played_at != null) {
      // Nieuw gepland mét geprikte speeltijd: het event is het moment van
      // plannen; de kaart toont de speeldatum zelf. Matches zonder tijd (bv.
      // een hele gegenereerde ronde) blijven weg — anders vloedt één
      // Americano-generatie de feed vol.
      events.push({ kind: "planned", at: m.created_at, match: m });
    }
  }

  // ── Vriendschappen: je eigen, plus (per RLS, #138) die van groepsgenoten
  //    wanneer beide betrokkenen met jou in één groep zitten. ──
  for (const f of friendships) {
    if (f.status !== "accepted") continue;
    events.push({
      kind: "friendship",
      at: f.updated_at ?? f.created_at,
      a: f.requester_id,
      b: f.addressee_id,
    });
  }

  // ── Groepen: aangemaakt + latere toetreders ──
  for (const g of groups) {
    events.push({
      kind: "group-created",
      at: g.created_at,
      groupId: g.id,
      groupName: g.name,
      playerId: g.created_by ?? null,
    });
    for (const member of membersByGroup[g.id] ?? []) {
      // Oprichters (toegevoegd bij het aanmaken) zijn geen apart nieuws.
      if (Date.parse(member.joined_at) - Date.parse(g.created_at) < 5 * 60_000) {
        continue;
      }
      events.push({
        kind: "group-joined",
        at: member.joined_at,
        groupId: g.id,
        groupName: g.name,
        playerId: member.player_id,
      });
    }

    // Speeldag-polls: alleen "gestart" is betrouwbaar te dateren (created_at;
    // lock/boek hebben geen timestamp-kolom — bewust buiten scope in #138).
    for (const poll of pollsByGroup[g.id] ?? []) {
      if (poll.status === "cancelled") continue;
      events.push({
        kind: "poll",
        at: poll.created_at,
        groupId: g.id,
        groupName: g.name,
      });
    }

    // Seizoenskampioen: alleen als het vorige kwartaal recent sloot.
    const groupMatches = groupMatchesByGroup[g.id];
    if (groupMatches) {
      const season = recentlyClosedSeason(now);
      if (season) {
        const rows = computePlayerStandings(
          matchesInSeason(
            groupMatches.filter((m) => m.status === "completed"),
            season,
          ),
          teams,
          profiles,
        );
        if (rows.length > 0) {
          events.push({
            kind: "season-champion",
            at: season.end.toISOString(),
            groupId: g.id,
            groupName: g.name,
            playerId: rows[0].player_id,
            seasonLabel: season.label,
          });
        }
      }
    }
  }

  // ── Klassementsprongen (dag-granulair, na de laatste speeldag) ──
  // NB: zodra #107 (show_in_global_ranking) bestaat hier ook op filteren.
  if (standings && standings.length > 0) {
    const shifts = rankShifts(standings, matches, teams, null);
    const lastPlayed = matches
      .filter((m) => m.status === "completed")
      .map((m) => m.played_at ?? m.created_at)
      .sort()
      .pop();
    if (lastPlayed) {
      const rankOf = new Map(standings.map((r, i) => [r.player_id, i + 1]));
      for (const [pid, shift] of shifts) {
        if (!network.has(pid)) continue;
        const rank = rankOf.get(pid) ?? 0;
        const big =
          typeof shift === "number"
            ? Math.abs(shift) >= RANK_SPRONG
            : rank > 0 && rank <= 3; // "nieuw" is alleen nieuws in de top 3
        if (!big) continue;
        events.push({ kind: "rank", at: lastPlayed, playerId: pid, shift, rank });
      }
    }
  }

  return events.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}

/** Het vorige kwartaal, maar alleen zolang het "vers" gesloten is (venster). */
export function recentlyClosedSeason(now: Date): Season | null {
  const current = seasonFor(now);
  const sinceClose = now.getTime() - current.start.getTime();
  if (sinceClose > KAMPIOEN_VENSTER_DAGEN * 24 * 3600_000) return null;
  const prev = seasonFor(new Date(current.start.getTime() - 24 * 3600_000));
  return isSeasonClosed(prev, now) ? prev : null;
}

/** Kalenderdag (YYYY-MM-DD) van een gebeurtenis, voor de dag-kopjes. */
export function feedDay(event: FeedEvent): string {
  return event.at.slice(0, 10);
}
