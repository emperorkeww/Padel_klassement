import type {
  Friendship,
  GroupMember,
  Match,
  PlayerRating,
  PlayerStanding,
  Profile,
  RatingPoint,
  Team,
} from "@/types";
import { matchUpset } from "@/features/matches/upset";
import { MONSTERZEGE_DREMPEL } from "@/features/profiles/badges";
import { outcomeFor, playersOf as teamSpelers } from "@/features/rating/results";
import { rankShifts, type Shift } from "@/features/rating/rankShift";
import { computePlayerStandings, matchesInSeason } from "@/features/rating/standings";
import { isSeasonClosed, seasonFor, type Season } from "@/features/rating/seasons";
import { eveningSummary } from "@/features/feed/eveningSummary";
import { tierChange } from "@/features/rating/tiers";
import { bepaalPias, type PiasReden } from "@/features/groups/maandpias";
import { vendettaStand } from "@/features/groups/vendetta";
import { matchDerby } from "@/features/matches/derby";
import type { ActiveBounty } from "@/features/rating/bounty";
import type { TierNaam } from "@/features/rating/tiers";
import type { PiasWeek } from "@/features/standings/pias";
import type { ZwartePiet } from "@/features/groups/zwartePiet";

/** De ándere speler in een vriendschap (zelfde logica als friends/api). */
const otherId = (f: Friendship, myId: string) =>
  f.requester_id === myId ? f.addressee_id : f.requester_id;

// Feed-opbouw (#120, uitgebreid in #138): gebeurtenissen van jou en je
// vrienden, chronologisch (nieuwste boven), client-side geaggregeerd uit al
// beschikbare bronnen. Anti-ruis: alles wat bij één match hoort (upset,
// opvallende score, reeks, rating-mijlpaal) wordt een highlight-chip op het
// match-item — losse items zijn er alleen voor niet-match-gebeurtenissen.
// Puur en getest in feed.test.ts; de UI (features/feed) doet alleen weergave.

// De upset-drempel en -math staan nu centraal in ./upset; hier her-geëxporteerd
// omdat feed.test.ts (en de UI) UPSET_MAX_KANS vanaf feed.ts importeren.
export { UPSET_MAX_KANS } from "@/features/matches/upset";
/** Winreeksen die een highlight verdienen (zelfde stappen als de badges). */
export const REEKS_STAPPEN = [3, 5, 10] as const;
/** Rating-grenzen die een highlight verdienen (zelfde tiers als de badges). */
export const RATING_DREMPELS = [1100, 1200, 1300] as const;
/** Minste plaatsen stijging/daling voor een klassement-item. */
export const RANK_SPRONG = 2;
/** Zo lang na het sluiten van een kwartaal melden we de kampioen nog. */
export const KAMPIOEN_VENSTER_DAGEN = 21;
/** Zo lang na het sluiten van een maand melden we de pias van de maand nog (#167). */
export const MAANDPIAS_VENSTER_DAGEN = 14;
/** Vanaf zoveel groepsmatches op één dag bundelen we ze tot één avond-item. */
export const AVOND_BUNDEL_MIN = 3;

export type Highlight =
  | { type: "upset"; chance: number; winnerTeamId: string }
  | { type: "score"; label: "bagel" | "monsterzege" | "nagelbijter" }
  | { type: "streak"; playerId: string; count: number }
  | { type: "duo"; teamId: string; count: number }
  | { type: "rating"; playerId: string; threshold: number }
  | {
      type: "tier";
      playerId: string;
      /** Volledige divisie waarin de speler nu zit, incl. sub-niveau ("Wannabe II"). */
      label: string;
      emoji: string;
      richting: "promotie" | "degradatie";
    }
  | {
      /** Vendetta-duel (#169): stand ná dit duel, vanuit de uitdager. */
      type: "vendetta";
      challengerId: string;
      rivalId: string;
      winsChallenger: number;
      winsRival: number;
    }
  | {
      /** Derby (#169): alle spelers in dezelfde hoofddivisie. */
      type: "derby";
      tierNaam: TierNaam;
      emoji: string;
    }
  | {
      /** Bounty geclaimd (#805): de leider ging onderuit en betaalde de pool op
       *  z'n hoofd. Volledig uit rating_history afgeleid — de negatieve
       *  bounty_delta wíjst de drager aan, dus dit is geen gok. */
      type: "bounty";
      carrierId: string;
      /** Wat de winnaars samen opstreken, ofwel wat de drager betaalde. */
      amount: number;
    }
  | {
      /** Bounty verdedigd (#805): de drager won en z'n reeks — en dus de prijs
       *  op z'n hoofd — groeide door. Alleen op zijn meest recente match: de
       *  huidige pool zegt niets over een partij van twee weken terug. */
      type: "bounty-verdedigd";
      carrierId: string;
      /** Wat er ná deze zege op z'n hoofd staat. */
      pool: number;
    }
  | {
      /** Lef-tip (#804): deze speler speelde met lef (dubbel-of-niets). */
      type: "lef";
      playerId: string;
      factor: number;
      won: boolean;
    };

export type FeedEvent =
  | {
      kind: "match";
      at: string;
      match: Match;
      highlights: Highlight[];
      myDelta: number | null;
      /** Lef-tip (#804): 2 als je eigen mutatie verdubbeld is. Zonder dit zou
       *  jouw getal onverklaarbaar afwijken van dat van je ploegmaat. */
      myStakeFactor?: number;
      /** Bounty (#805): jouw deel van de verschuiving, positief of negatief.
       *  Zit al in myDelta; het staat er los bij om hetzelfde te doen als de
       *  lef-factor — een afwijkend getal verklaren. */
      myBounty?: number;
    }
  | { kind: "friendship"; at: string; a: string; b: string }
  | { kind: "planned"; at: string; match: Match }
  | { kind: "group-created"; at: string; groupId: string; groupName: string; playerId: string | null }
  | { kind: "group-joined"; at: string; groupId: string; groupName: string; playerId: string }
  | { kind: "poll"; at: string; groupId: string; groupName: string }
  | { kind: "poll-locked" | "poll-booked"; at: string; groupId: string; groupName: string; date: string | null; time: string | null }
  | { kind: "evening"; at: string; groupId: string; groupName: string; day: string; count: number; topPlayerId: string | null; bestDuoTeamId: string | null; highlights: Highlight[] }
  | { kind: "rank"; at: string; playerId: string; shift: Shift; rank: number }
  | { kind: "tier"; at: string; playerId: string; vanLabel: string; naarLabel: string; vanEmoji: string; naarEmoji: string; richting: "promotie" | "degradatie"; matchId: string }
  | { kind: "season-champion"; at: string; groupId: string; groupName: string; playerId: string; seasonLabel: string }
  | { kind: "maand-pias"; at: string; groupId: string; groupName: string; playerId: string; reden: PiasReden; detail: string; periodeLabel: string }
  | { kind: "pias-week"; at: string; groupId: string; groupName: string; playerId: string; reden: PiasReden; waarde: number; winChance: number | null; weekStart: string }
  | { kind: "zwarte-piet"; at: string; groupId: string; groupName: string; toPlayerId: string; fromPlayerId: string | null; reden: PiasReden; detail: string }
  | { kind: "smoes"; at: string; matchId: string; groupId: string; groupName: string; playerId: string; smoes: string; match: Match | null }
  | { kind: "vendetta"; at: string; sub: "gestart" | "omgeslagen" | "beslist"; groupId: string; groupName: string; challengerId: string; rivalId: string; winsChallenger: number; winsRival: number; doel: number; matchId: string | null };

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
  locked_at?: string | null;
  booked_at?: string | null;
  /** Gekozen moment (datum + "HH:MM"), door de UI geresolved uit de optie. */
  locked_date?: string | null;
  locked_time?: string | null;
}
/** Een op een verloren groepsmatch geplaatste smoes (#296). Structurele invoer,
 *  houdt lib los van de feature-API (match_smoesjes-rij). */
export interface FeedSmoes {
  match_id: string;
  player_id: string;
  group_id: string;
  smoes: string;
  created_at: string;
}
/** Een vendetta-contract (#169). Structurele invoer (vendettas-rij); de stand
 *  wordt hier client-side afgeleid via features/groups/vendetta.ts. */
export interface FeedVendetta {
  id: string;
  group_id: string;
  challenger_id: string;
  rival_id: string;
  target_wins: number;
  status: string;
  started_at: string;
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
  return [teams[m.team_a_id], teams[m.team_b_id]].flatMap((t) => teamSpelers(t));
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

/**
 * Bounty geclaimd (#805): wie in deze match z'n pool betaalde, en hoeveel. De
 * negatieve bounty_delta staat in de historie van de drager zelf, dus dit is
 * exact wat de databank verrekend heeft — geen reconstructie uit de uitslag.
 */
export function bountyHighlights(
  points: Map<string, RatingPoint> | undefined,
): Highlight[] {
  if (!points) return [];
  const uit: Highlight[] = [];
  for (const [playerId, p] of points) {
    const b = p.bounty_delta ?? 0;
    if (b < 0) uit.push({ type: "bounty", carrierId: playerId, amount: -b });
  }
  return uit;
}

/**
 * Bounty verdedigd (#805): match → dragers die 'm daar overeind hielden.
 *
 * Alleen de méést recente match van elke drager telt. Een reeks van drie zegt
 * dat z'n laatste drie matches gewonnen zijn, maar de pool die we tonen is de
 * huidige — die op een oudere partij plakken zou een verkeerd bedrag zijn. Dat
 * de laatste match een zege wás volgt uit streak ≥ 1: de reeks telt terug vanaf
 * de recentste match.
 */
export function bountyDefences(
  bounties: ActiveBounty[],
  histories: Record<string, RatingPoint[]>,
): Map<string, Highlight[]> {
  const perMatch = new Map<string, Highlight[]>();
  // Eén rij per drager: dezelfde speler kan zowel de troon als een kroon
  // dragen, maar de vaste pool telt per speler maar één keer.
  const pools = new Map<string, number>();
  for (const b of bounties) {
    if (b.streak < 1) continue;
    pools.set(b.playerId, Math.max(pools.get(b.playerId) ?? 0, b.pool));
  }
  for (const [playerId, pool] of pools) {
    const punten = histories[playerId];
    if (!punten?.length) continue;
    // De histories komen chronologisch binnen (oud → nieuw), maar daar rekent
    // deze helper niet op: zoek zelf de recentste, net als onFire.ts.
    const laatste = punten.reduce((a, b) =>
      b.played_at.localeCompare(a.played_at) > 0 ? b : a,
    );
    const lijst = perMatch.get(laatste.match_id) ?? [];
    lijst.push({ type: "bounty-verdedigd", carrierId: playerId, pool });
    perMatch.set(laatste.match_id, lijst);
  }
  return perMatch;
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
  const u = matchUpset(m, teams, points);
  return u
    ? { type: "upset", chance: u.chance, winnerTeamId: u.winnerTeamId }
    : null;
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
  /** Huidige rating-snapshot per speler → rating-leidende rang in rankShifts. */
  ratings?: Record<string, PlayerRating>;
  /** Eigen groepen (+ leden en polls) → groeps- en poll-items. */
  groups?: FeedGroup[];
  membersByGroup?: Record<string, GroupMember[]>;
  pollsByGroup?: Record<string, FeedPoll[]>;
  /** Afgeronde matches per groep → seizoenskampioenen (alleen recent gesloten). */
  groupMatchesByGroup?: Record<string, Match[]>;
  /** Serverside aangeduide pias van de week per groep (#127) → pias-items. */
  piasWeeks?: PiasWeek[];
  /** Huidige Zwarte Piet-drager per groep (#185) → overdracht-items. */
  shameTransfers?: Array<ZwartePiet & { groupId: string }>;
  /** Actieve bounty's (#805) → "kroon verdedigd"-chip op de recentste match van
   *  een drager. Een geclaimde bounty heeft dit niet nodig: die staat in de
   *  historie zelf. */
  bounties?: ActiveBounty[];
  /** Geplaatste smoezen in je groepen (#296) → smoes-items op de feed. */
  smoesjes?: FeedSmoes[];
  /** Vendetta-contracten in je groepen (#169) → verhaallijn-items + chips. */
  vendettas?: FeedVendetta[];
  profiles?: Record<string, Profile>;
  now?: Date;
  /** Client-side soortfilter (filterchips); werkt vóór de limiet. */
  filter?: (e: FeedEvent) => boolean;
}): FeedEvent[] {
  const {
    matches,
    teams,
    friendships,
    myId,
    limit = FEED_LIMIT,
    histories = {},
    standings,
    ratings = {},
    groups = [],
    membersByGroup = {},
    pollsByGroup = {},
    groupMatchesByGroup = {},
    piasWeeks = [],
    shameTransfers = [],
    smoesjes = [],
    vendettas = [],
    profiles = {},
    now = new Date(),
    filter,
  } = input;
  // Publiek van de feed: jijzelf + vrienden + iedereen met wie je een groep
  //  deelt — hun matches, reeksen, rating- en klassementsnieuws zijn zichtbaar.
  const network = networkIds(friendships, myId);
  for (const members of Object.values(membersByGroup)) {
    for (const m of members) network.add(m.player_id);
  }
  const byMatch = pointsByMatch(histories);
  // Verdedigde bounty's (#805): per match de dragers die 'm daar overeind
  // hielden. Buiten de lus, want het is één pas over de dragers.
  const verdedigd = bountyDefences(input.bounties ?? [], histories);
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
  // Duo-reeksen: winstreeks van een vast duo (team-id) over dezelfde matches.
  const duoRun = new Map<string, number>();
  for (const m of chrono) {
    if (m.status !== "completed" || !m.winner_team_id) continue;
    const winners = m.winner_team_id;
    const losers = winners === m.team_a_id ? m.team_b_id : m.team_a_id;
    duoRun.set(winners, (duoRun.get(winners) ?? 0) + 1);
    duoRun.set(losers, 0);
    const run = duoRun.get(winners)!;
    if ((REEKS_STAPPEN as readonly number[]).includes(run)) {
      const list = streakAt.get(m.id) ?? [];
      list.push({ type: "duo", teamId: winners, count: run });
      streakAt.set(m.id, list);
    }
  }
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

  // ── Vendetta's (#169): het contract komt uit de DB, de verhaallijn is
  //    client-side. Anti-ruis: per vendetta hooguit twee losse items —
  //    "gestart" plus de laatste omslag óf de beslissing (beslist wint);
  //    elk meegeteld duel wordt een chip op zijn eigen match-item. De stand
  //    telt over de vólledige groepshistorie als die geladen is; anders het
  //    feed-venster (progressief, zoals de andere bronnen). ──
  const vendettaChipAt = new Map<string, Highlight[]>();
  {
    const nameById = new Map(groups.map((g) => [g.id, g.name]));
    for (const v of vendettas) {
      const groupName = nameById.get(v.group_id);
      if (!groupName) continue;
      const bron = groupMatchesByGroup[v.group_id] ?? matches;
      const stand = vendettaStand(v, bron, teams);
      const basis = {
        groupId: v.group_id,
        groupName,
        challengerId: v.challenger_id,
        rivalId: v.rival_id,
        doel: v.target_wins,
      };
      events.push({
        kind: "vendetta",
        sub: "gestart",
        at: v.started_at,
        ...basis,
        winsChallenger: 0,
        winsRival: 0,
        matchId: null,
      });
      if (stand.beslist) {
        const m = stand.beslist.match;
        events.push({
          kind: "vendetta",
          sub: "beslist",
          at: m.played_at ?? m.created_at,
          ...basis,
          winsChallenger: stand.winsChallenger,
          winsRival: stand.winsRival,
          matchId: m.id,
        });
      } else if (stand.omslagen.length > 0) {
        const omslag = stand.omslagen[stand.omslagen.length - 1];
        const snap = stand.duels.find((d) => d.match.id === omslag.match.id);
        events.push({
          kind: "vendetta",
          sub: "omgeslagen",
          at: omslag.match.played_at ?? omslag.match.created_at,
          ...basis,
          winsChallenger: snap?.winsChallenger ?? stand.winsChallenger,
          winsRival: snap?.winsRival ?? stand.winsRival,
          matchId: omslag.match.id,
        });
      }
      for (const d of stand.duels) {
        const list = vendettaChipAt.get(d.match.id) ?? [];
        list.push({
          type: "vendetta",
          challengerId: v.challenger_id,
          rivalId: v.rival_id,
          winsChallenger: d.winsChallenger,
          winsRival: d.winsRival,
        });
        vendettaChipAt.set(d.match.id, list);
      }
    }
  }

  for (const m of networkMatches) {
    if (m.status === "completed") {
      const points = byMatch.get(m.id);
      const highlights: Highlight[] = [];

      // Bounty (#805) bovenaan: dat de leider z'n prijs betaalde is het
      // grootste nieuws van zo'n match, groter dan een bagel of een upset.
      highlights.push(...bountyHighlights(points));
      highlights.push(...(verdedigd.get(m.id) ?? []));
      const upset = upsetHighlight(m, teams, points);
      if (upset) highlights.push(upset);
      const score = scoreHighlight(m);
      if (score) highlights.push(score);
      highlights.push(...(streakAt.get(m.id) ?? []));
      highlights.push(...(vendettaChipAt.get(m.id) ?? []));
      // Derby (#169): alle spelers in dezelfde hoofddivisie, gemeten aan de
      // échte pre-match ratings.
      const derby = matchDerby(
        m,
        teams,
        (pid) => points?.get(pid)?.rating_before ?? null,
      );
      if (derby) {
        highlights.push({ type: "derby", tierNaam: derby.naam, emoji: derby.emoji });
      }
      // Rating-mijlpaal: een netwerk-speler kruiste bij deze match een grens.
      if (points) {
        for (const [pid, p] of points) {
          if (!network.has(pid)) continue;
          for (const t of RATING_DREMPELS) {
            if (p.rating_before < t && p.rating_after >= t) {
              highlights.push({ type: "rating", playerId: pid, threshold: t });
            }
          }
          // Ranking-nieuws: alleen een wissel van hoofddivisie (Wannabe →
          // Glazenwasser) is nieuwswaardig. Sub-niveaus (Wannabe III → II)
          // blijven volledig weg — geen chip én geen standalone tier-item
          // (#354), zodat een divisie-melding weer echt iets betekent.
          const wissel = tierChange(p.rating_before, p.rating_after);
          if (wissel?.hoofdtier) {
            highlights.push({
              type: "tier",
              playerId: pid,
              label: wissel.naar.label,
              emoji: wissel.naar.emoji,
              richting: wissel.richting,
            });
            events.push({
              kind: "tier",
              at: m.played_at ?? m.created_at,
              playerId: pid,
              vanLabel: wissel.van.label,
              naarLabel: wissel.naar.label,
              vanEmoji: wissel.van.emoji,
              naarEmoji: wissel.naar.emoji,
              richting: wissel.richting,
              matchId: m.id,
            });
          }
        }
        // Lef-inzetten (#804): voeg een highlight toe als iemand lef speelde
        for (const [pid, p] of points) {
          if (p.stake_factor && p.stake_factor > 1) {
            highlights.push({
              type: "lef",
              playerId: pid,
              factor: p.stake_factor,
              won: p.delta > 0,
            });
          }
        }
      }

      events.push({
        kind: "match",
        at: m.played_at ?? m.created_at,
        match: m,
        highlights,
        myDelta: points?.get(myId)?.delta ?? null,
        myStakeFactor: points?.get(myId)?.stake_factor,
        myBounty: points?.get(myId)?.bounty_delta || undefined,
      });
    } else if (
      m.status !== "cancelled" &&
      m.played_at != null &&
      m.round_number == null
    ) {
      // Nieuw gepland mét geprikte speeltijd: het event is het moment van
      // plannen; de kaart toont de speeldatum zelf. Gegenereerde rondes
      // (round_number gezet) blijven weg — dat is één handeling die tien
      // matches oplevert, en die zou de feed volvloeien. Vóór #827 viel dat
      // vanzelf weg omdat zo'n ronde geen played_at had; nu is het expliciet.
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
      if (poll.locked_at) {
        events.push({
          kind: "poll-locked",
          at: poll.locked_at,
          groupId: g.id,
          groupName: g.name,
          date: poll.locked_date ?? null,
          time: poll.locked_time ?? null,
        });
      }
      if (poll.booked_at) {
        events.push({
          kind: "poll-booked",
          at: poll.booked_at,
          groupId: g.id,
          groupName: g.name,
          date: poll.locked_date ?? null,
          time: poll.locked_time ?? null,
        });
      }
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

      // Pias van de maand (#167): de anti-MVP van de net-gesloten maand — de
      // maandelijkse tegenhanger van de wekelijkse pias (#127). byMatch levert
      // de pre-match ratings voor de choke-detectie.
      const maand = recentlyClosedMonth(now);
      if (maand) {
        const pias = bepaalPias(
          groupMatches.filter((m) => m.status === "completed"),
          teams,
          maand,
          byMatch,
        );
        if (pias) {
          events.push({
            kind: "maand-pias",
            at: maand.end.toISOString(),
            groupId: g.id,
            groupName: g.name,
            playerId: pias.playerId,
            reden: pias.reden,
            detail: pias.detail,
            periodeLabel: maand.label,
          });
        }
      }
    }
  }

  const matchById = new Map(matches.map((m) => [m.id, m]));
  const groupNamesById = new Map(groups.map((g) => [g.id, g.name]));

  // ── Pias van de week (#127): serverside aangeduid per groep, de grootste
  //    choke. We tonen enkel piassen van groepen die de feed kent (jouw
  //    groepen) zodat we een groepsnaam hebben. ──
  for (const p of piasWeeks) {
    const groupName = groupNamesById.get(p.groupId);
    if (!groupName) continue;
    const m = matchById.get(p.matchId);
    const fallbackAt = addDays(p.weekStart, 6) + "T23:59:59Z";
    events.push({
      kind: "pias-week",
      at: m ? (m.played_at ?? m.created_at) : fallbackAt,
      groupId: p.groupId,
      groupName,
      playerId: p.playerId,
      reden: p.reden,
      waarde: p.waarde,
      winChance: p.winChance,
      weekStart: p.weekStart,
    });
  }

  // ── Zwarte Piet (#185): de huidige drager per groep, gedateerd op de
  //    overname-match. Eén item per groep (geen stroom van overdrachten). ──
  for (const t of shameTransfers) {
    const groupName = groupNamesById.get(t.groupId);
    if (!groupName) continue;
    const m = matchById.get(t.matchId);
    const at = m ? (m.played_at ?? m.created_at) : `${t.since}T00:00:00Z`;
    events.push({
      kind: "zwarte-piet",
      at,
      groupId: t.groupId,
      groupName,
      toPlayerId: t.holderId,
      fromPlayerId: t.fromId,
      reden: t.reden,
      detail: t.detail,
    });
  }

  // ── Smoesjes (#296): een op een verloren groepsmatch geplaatste smoes van de
  //    verliezer, onder Coach Rudy's stem. RLS levert enkel smoezen uit jouw
  //    groepen, dus we hebben altijd een groepsnaam. ──
  for (const s of smoesjes) {
    const groupName = groupNamesById.get(s.group_id);
    if (!groupName) continue;
    events.push({
      kind: "smoes",
      at: s.created_at,
      matchId: s.match_id,
      groupId: s.group_id,
      groupName,
      playerId: s.player_id,
      smoes: s.smoes,
      // De verloren match zelf (indien binnen het feed-venster), zodat de kaart
      // toont bij wélke nederlaag de smoes hoort — tegenstander + score.
      match: matchById.get(s.match_id) ?? null,
    });
  }

  // ── Klassementsprongen (dag-granulair, na de laatste speeldag) ──
  // NB: zodra #107 (show_in_global_ranking) bestaat hier ook op filteren.
  if (standings && standings.length > 0) {
    const shifts = rankShifts(standings, matches, teams, null, histories, ratings);
    const lastPlayed = matches
      .filter((m) => m.status === "completed")
      .map((m) => m.played_at ?? m.created_at)
      .sort()
      .pop();
    if (lastPlayed) {
      for (const [pid, { shift, rank, was }] of shifts) {
        if (!network.has(pid)) continue;
        const enteredTop3 = rank > 0 && rank <= 3 && (was === null || was > 3);
        const leftTop3 = rank > 3 && was !== null && was <= 3;
        const bigShift = typeof shift === "number" && Math.abs(shift) >= RANK_SPRONG;

        if (enteredTop3 || leftTop3 || bigShift) {
          events.push({ kind: "rank", at: lastPlayed, playerId: pid, shift, rank });
        }
      }
    }
  }

  // ── Avond-bundeling: N of meer groepsmatches op één dag worden één item
  //    met samenvatting en de chips van die avond (alleen eigen groepen —
  //    namen van andermans groepen zijn per RLS niet beschikbaar). ──
  const groupNameById = new Map(groups.map((g) => [g.id, g.name]));
  const buckets = new Map<string, Extract<FeedEvent, { kind: "match" }>[]>();
  for (const e of events) {
    if (e.kind !== "match" || !e.match.group_id) continue;
    if (!groupNameById.has(e.match.group_id)) continue;
    const key = `${e.match.group_id}|${e.at.slice(0, 10)}`;
    const list = buckets.get(key) ?? [];
    list.push(e);
    buckets.set(key, list);
  }
  const bundled = new Set<FeedEvent>();
  for (const [key, list] of buckets) {
    if (list.length < AVOND_BUNDEL_MIN) continue;
    const [groupId, day] = key.split("|");
    // `day` komt uit de bucket-key hierboven (UTC-slice); dat blijft zo
    // (#783 pakt bewust alleen de groep-Vandaag-tab/globale-lijst aan).
    const summary = eveningSummary(list.map((e) => e.match), teams, day, "UTC", histories);
    for (const e of list) bundled.add(e);
    events.push({
      kind: "evening",
      at: list.map((e) => e.at).sort().pop()!,
      groupId,
      groupName: groupNameById.get(groupId)!,
      day,
      count: list.length,
      topPlayerId: summary.rows[0]?.playerId ?? null,
      bestDuoTeamId: summary.bestDuo?.teamId ?? null,
      highlights: list.flatMap((e) => e.highlights).slice(0, 6),
    });
  }

  return events
    .filter((e) => !bundled.has(e))
    .filter((e) => (filter ? filter(e) : true))
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, limit);
}

/**
 * Privacyfilter (#59): verbergt 'nieuwe vriendschap'-items waarbij een van
 * beide personen niet vindbaar is (`discoverable === false`). Match-, groeps-
 * en klassementitems blijven — dat is gedeelde activiteit waar de persoon zelf
 * aan meedeed. `discoverable` ontbreekt of true = zichtbaar. Bedoeld om als
 * `filter` aan `buildFeed` mee te geven (of te componeren met een soortfilter).
 */
export function feedPrivacyFilter(
  profiles: Record<string, Profile>,
): (e: FeedEvent) => boolean {
  const zichtbaar = (id: string) => profiles[id]?.discoverable !== false;
  return (e) => e.kind !== "friendship" || (zichtbaar(e.a) && zichtbaar(e.b));
}

const MAANDEN_NL = [
  "januari", "februari", "maart", "april", "mei", "juni",
  "juli", "augustus", "september", "oktober", "november", "december",
];

/**
 * De vorige kalendermaand als half-open bereik + NL-label, maar alleen zolang
 * de nieuwe maand nog "vers" is (venster). Tegenhanger van
 * recentlyClosedSeason, voor de maandelijkse pias van de maand (#167).
 */
export function recentlyClosedMonth(
  now: Date,
): { start: Date; end: Date; label: string } | null {
  const eersteVanDeze = new Date(now.getFullYear(), now.getMonth(), 1);
  const sinceClose = now.getTime() - eersteVanDeze.getTime();
  if (sinceClose > MAANDPIAS_VENSTER_DAGEN * 24 * 3600_000) return null;
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return {
    start,
    end: eersteVanDeze,
    label: `${MAANDEN_NL[start.getMonth()]} ${start.getFullYear()}`,
  };
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

/** Telt N dagen op bij een YYYY-MM-DD datumstring en geeft YYYY-MM-DD terug. */
function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/* ---------- Opeenvolgende vriendschappen bundelen (#944) ---------- */

/** Eén samengevatte regel in plaats van een reeks losse vriendschapsrijen. */
export interface FriendshipBundel {
  kind: "friendship-bundel";
  /** Tijdstip van de eerste (nieuwste) vriendschap in de bundel. */
  at: string;
  /** De gebundelde gebeurtenissen zelf; de UI kan ze uitklappen. */
  events: Extract<FeedEvent, { kind: "friendship" }>[];
}

/** Vanaf zoveel opeenvolgende vriendschappen wordt het één regel. Twee rijen
 *  is geen muur; vanaf drie verdrinkt de rest van de feed erin. */
export const BUNDEL_DREMPEL = 3;

/**
 * Vat opeenvolgende vriendschapsgebeurtenissen samen (#944).
 *
 * Een clubavond waarop iedereen elkaar toevoegt levert acht identieke regels
 * met hetzelfde tijdstip op ("X en Y zijn nu vrienden"), en daar verdwijnt de
 * rest van de feed onder. Alleen áán elkaar grenzende items worden gebundeld:
 * staat er een match tussen, dan zijn het twee losse momenten en horen ze dat
 * ook te blijven.
 *
 * Bewust een aparte pass over de al gefilterde, al afgekapte lijst in plaats van
 * een stap in `buildFeed`: zo blijven de filtertellers en de "toon meer"-limiet
 * tellen wat er echt gebeurd is.
 */
export function bundelVriendschappen<T>(
  items: T[],
  eventVan: (item: T) => FeedEvent,
  drempel = BUNDEL_DREMPEL,
): (T | { bundel: FriendshipBundel; leden: T[] })[] {
  const uit: (T | { bundel: FriendshipBundel; leden: T[] })[] = [];
  let reeks: T[] = [];

  const spoel = () => {
    if (reeks.length === 0) return;
    if (reeks.length < drempel) uit.push(...reeks);
    else {
      const events = reeks.map(
        (r) => eventVan(r) as Extract<FeedEvent, { kind: "friendship" }>,
      );
      uit.push({
        bundel: { kind: "friendship-bundel", at: events[0].at, events },
        leden: reeks,
      });
    }
    reeks = [];
  };

  for (const item of items) {
    if (eventVan(item).kind === "friendship") reeks.push(item);
    else {
      spoel();
      uit.push(item);
    }
  }
  spoel();
  return uit;
}

/** De spelers in een bundel, in volgorde van verschijnen en zonder dubbels —
 *  voedt de avatarrij van de samengevatte regel. */
export function bundelSpelers(bundel: FriendshipBundel): string[] {
  const gezien = new Set<string>();
  for (const e of bundel.events) {
    gezien.add(e.a);
    gezien.add(e.b);
  }
  return [...gezien];
}
