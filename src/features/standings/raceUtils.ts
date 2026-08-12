import {
  tierProgress,
  TIER_BANDEN,
  type TierBand,
  type TierKey,
} from "@/features/rating/tiers";
import type { Row } from "./leaderboardHelpers";

export const PACK_NEIGHBOR_GAP = 40;
export const PACK_MAX_SPREAD = 60;
export const PACK_MIN_PLAYERS = 3;

/** Adaptieve pack-drempels (#1241): de buurmansafstand die nog "gevecht" heet
 *  schaalt mee met het veld, maar blijft binnen deze grenzen. De ondergrens
 *  ligt ruim onder één matchswing (K=24), zodat een kurkdroog vlak klassement
 *  niet álles tot pack bombardeert; de bovengrens is het oude vaste plafond. */
export const PACK_GAP_MIN = 15;
export const PACK_GAP_MAX = 60;

/** Uitschieter-trim (#1241): buitenste divisiebanden verdwijnen van de as
 *  zolang er — over alle geknipte banden samen — hooguit dit aandeel van het
 *  veld in staat. Eén totaalbudget, anders knipt een gelijkmatig gespreid
 *  veld zich band voor band leeg. */
export const TRIM_MAX_AANDEEL = 0.1;
/** …én die spelers minstens zoveel rating van de rest af liggen. Anderhalve
 *  bandbreedte: een gewone hekkensluiter één divisie lager is geen uitschieter. */
export const TRIM_MIN_AFSTAND = 150;

export interface RaceAxisRange {
  min: number;
  max: number;
  step: number;
  ticks: number[];
}

/** De race-as (#1241): verankerd aan divisiegrenzen in plaats van aan de
 *  toevallige min/max van de zichtbare spelers. `zoomBand` is gezet wanneer
 *  het hele veld binnen één hoofdband valt en de as op de sub-niveaus inzoomt. */
export interface DivisionAxis extends RaceAxisRange {
  zoomBand: TierBand | null;
}

/** Hoofdband-index voor een rating; zelfde klemgedrag als `tierFor`. */
function bandIndexFor(rating: number): number {
  const laatste = TIER_BANDEN.length - 1;
  if (rating >= TIER_BANDEN[laatste].min) return laatste;
  return Math.max(
    0,
    TIER_BANDEN.findIndex((band) => band.max != null && rating < band.max),
  );
}

/** De open dictator-band heeft geen max; geef de as daar lucht boven de top. */
function dynamischeTop(maxRating: number): number {
  return Math.max(1700, Math.ceil((maxRating + 25) / 100) * 100);
}

function metTicks(min: number, max: number, step: number): RaceAxisRange {
  const ticks: number[] = [];
  for (let value = min; value <= max; value += step) ticks.push(value);
  if (ticks.at(-1) !== max) ticks.push(max);
  return { min, max, step, ticks };
}

/**
 * Eén vaste rating-as voor alle lanes, verankerd aan de divisiegrenzen van het
 * VOLLEDIGE veld (#1241). Omdat de grenzen bandgrenzen zijn en de invoer nooit
 * de gefilterde subset is, staat de as stil bij zoeken en filteren en
 * verschuift hij alleen als het veld écht een divisiegrens over gaat.
 *
 * Eén uitschieter mag het gevecht niet platdrukken: een dunbezette buitenband
 * die ver van de rest ligt wordt van de as geknipt (de spelers klemmen dan
 * zichtbaar op de rand), behalve als de kijker er zelf in staat. Valt het hele
 * veld binnen één band, dan zoomt de as in op de sub-niveaus van die band.
 */
export function calculateDivisionAxis(
  ratings: readonly number[],
  viewerRating: number | null = null,
): DivisionAxis {
  const finite = ratings.filter(Number.isFinite);
  if (finite.length === 0) {
    // Zonder gerate spelers rendert de race niet; dit is een vangnet.
    return { ...metTicks(500, 1700, 100), zoomBand: null };
  }

  let trimBudget = Math.max(1, Math.ceil(TRIM_MAX_AANDEEL * finite.length));
  const viewerBand = viewerRating != null ? bandIndexFor(viewerRating) : null;
  const bezet = [...new Set(finite.map(bandIndexFor))].sort((a, b) => a - b);

  let geknipt = true;
  while (geknipt && bezet.length > 1) {
    geknipt = false;
    for (const kant of [0, bezet.length - 1]) {
      const buiten = bezet[kant];
      if (buiten === viewerBand) continue;
      const eigen = finite.filter((r) => bandIndexFor(r) === buiten);
      const rest = finite.filter((r) => {
        const band = bandIndexFor(r);
        return band !== buiten && bezet.includes(band);
      });
      if (eigen.length > trimBudget || rest.length === 0) continue;
      const afstand =
        kant === 0
          ? Math.min(...rest) - Math.max(...eigen)
          : Math.min(...eigen) - Math.max(...rest);
      if (afstand >= TRIM_MIN_AFSTAND) {
        trimBudget -= eigen.length;
        bezet.splice(kant === 0 ? 0 : bezet.length - 1, 1);
        geknipt = true;
        break;
      }
    }
  }

  const laagsteBand = TIER_BANDEN[bezet[0]];
  const hoogsteBand = TIER_BANDEN[bezet.at(-1)!];
  const binnenMax = Math.max(
    ...finite.filter((r) => bezet.includes(bandIndexFor(r))),
  );

  // Heel veld (na trim) binnen één band: inzoomen op de sub-niveaus.
  if (bezet.length === 1) {
    const max = laagsteBand.max ?? dynamischeTop(binnenMax);
    const breedte = max - laagsteBand.min;
    return {
      ...metTicks(laagsteBand.min, max, breedte <= 100 ? 25 : 50),
      zoomBand: laagsteBand,
    };
  }

  const min = laagsteBand.min;
  const max = hoogsteBand.max ?? dynamischeTop(binnenMax);
  return { ...metTicks(min, max, max - min <= 300 ? 50 : 100), zoomBand: null };
}

/** Rating naar een geklemde x-positie op de gedeelde as. */
export function calculateRacePosition(
  rating: number,
  axis: Pick<RaceAxisRange, "min" | "max">,
): number {
  if (axis.max <= axis.min) return 50;
  return Math.min(100, Math.max(0, ((rating - axis.min) / (axis.max - axis.min)) * 100));
}

export interface RacePack {
  id: string;
  rows: Row[];
  startRank: number;
  endRank: number;
  spread: number;
  includesCurrentUser: boolean;
}

/**
 * Vindt compacte clusters in ratingvolgorde. Een limiet op zowel de afstand
 * tussen buren als de totale spreiding voorkomt kettingreacties waarbij bijna
 * de hele ranglijst één pack wordt.
 */
/**
 * Pack-drempels op maat van het veld (#1241). De mediaan van de
 * buurmansgaten — robuust tegen precies de uitschieter die een gemiddelde
 * zou opblazen — bepaalt wat hier "dicht op elkaar" betekent: in een vlak
 * klassement worden de drempels strenger, in een gespreid veld ruimer.
 */
export interface PackThresholds {
  neighborGap: number;
  maxSpread: number;
}

export function packThresholds(ratings: readonly number[]): PackThresholds {
  const rated = [...ratings.filter(Number.isFinite)].sort((a, b) => b - a);
  if (rated.length < PACK_MIN_PLAYERS) {
    return { neighborGap: PACK_NEIGHBOR_GAP, maxSpread: PACK_MAX_SPREAD };
  }
  const gaten: number[] = [];
  for (let i = 0; i + 1 < rated.length; i++) gaten.push(rated[i] - rated[i + 1]);
  gaten.sort((a, b) => a - b);
  const midden = Math.floor(gaten.length / 2);
  const mediaan =
    gaten.length % 2 === 1 ? gaten[midden] : (gaten[midden - 1] + gaten[midden]) / 2;
  const neighborGap = Math.min(
    PACK_GAP_MAX,
    Math.max(PACK_GAP_MIN, Math.round(1.5 * mediaan)),
  );
  return { neighborGap, maxSpread: 2 * neighborGap };
}

export function detectRatingPacks(
  rows: readonly Row[],
  neighborGap = PACK_NEIGHBOR_GAP,
  maxSpread = PACK_MAX_SPREAD,
  minPlayers = PACK_MIN_PLAYERS,
): RacePack[] {
  const rated = rows.filter((r): r is Row & { rating: number } => r.rating != null);
  const packs: RacePack[] = [];

  for (let start = 0; start < rated.length; ) {
    let end = start;
    while (end + 1 < rated.length) {
      const next = rated[end + 1];
      const neighborDistance = rated[end].rating - next.rating;
      const totalSpread = rated[start].rating - next.rating;
      if (neighborDistance > neighborGap || totalSpread > maxSpread) break;
      end += 1;
    }

    if (end - start + 1 >= minPlayers) {
      const members = rated.slice(start, end + 1);
      const startRank = members[0].rank ?? start + 1;
      const endRank = members.at(-1)!.rank ?? end + 1;
      packs.push({
        id: `${members[0].key}:${members.at(-1)!.key}`,
        rows: members,
        startRank,
        endRank,
        spread: members[0].rating - members.at(-1)!.rating,
        includesCurrentUser: members.some((r) => r.isMe),
      });
      start = end + 1;
    } else {
      start += 1;
    }
  }
  return packs;
}

export function findCurrentUser(rows: readonly Row[]): Row | null {
  return rows.find((row) => row.isMe) ?? null;
}

export interface NearestCompetitors {
  above: { row: Row; gap: number } | null;
  below: { row: Row; gap: number } | null;
}

export function getNearestCompetitors(
  rows: readonly Row[],
  playerKey: string,
): NearestCompetitors {
  const rated = rows.filter((r): r is Row & { rating: number } => r.rating != null);
  const index = rated.findIndex((r) => r.key === playerKey);
  if (index < 0) return { above: null, below: null };
  const player = rated[index];
  const above = rated[index - 1];
  const below = rated[index + 1];
  return {
    above: above ? { row: above, gap: Math.max(0, above.rating - player.rating) } : null,
    below: below ? { row: below, gap: Math.max(0, player.rating - below.rating) } : null,
  };
}

export function getNextDivision(rating: number | null) {
  return tierProgress(rating);
}

/** Een poort op de as: een hoofddivisiegrens, of ingezoomd een sub-niveau. */
export interface RaceCheckpoint {
  key: TierKey;
  naam: string;
  emoji: string;
  min: number;
}

/** De poorten die werkelijk op de zichtbare as liggen. Op een ingezoomde as
 *  (heel veld binnen één band) zijn dat de sub-niveaugrenzen II en I, met
 *  dezelfde snijlogica als `tierFor`. */
export function divisionCheckpoints(axis: DivisionAxis): RaceCheckpoint[] {
  if (axis.zoomBand) {
    const band = axis.zoomBand;
    if (band.max == null) return []; // El Padelissimo kent geen sub-niveaus.
    const breedte = band.max - band.min;
    return (["II", "I"] as const).map((sub, i) => ({
      key: band.key,
      naam: `${band.naam} ${sub}`,
      emoji: band.emoji,
      min: band.min + Math.ceil(((i + 1) * breedte) / 3),
    }));
  }
  return TIER_BANDEN.filter(
    (band, index) => index > 0 && band.min > axis.min && band.min < axis.max,
  ).map((band) => ({
    key: band.key,
    naam: band.naam,
    emoji: band.emoji,
    min: band.min,
  }));
}

/** Jouw ene doel bovenaan de race (#1241): het kleinste positieve doel —
 *  de speler vlak boven je of de volgende hoofddivisie — wint de kop; het
 *  andere wordt de ondersteunende regel. */
export interface RaceGoal {
  kop: string;
  sub: string | null;
}

export function raceGoal(
  me: Row & { rating: number },
  rows: readonly Row[],
): RaceGoal {
  const { above, below } = getNearestCompetitors(rows, me.key);
  const next = tierProgress(me.rating);
  const divisieDoel = next?.volgende
    ? `Nog ${next.puntenNodig} rating tot ${next.volgende.emoji} ${next.volgende.naam}`
    : null;

  if (!above) {
    if (divisieDoel) return { kop: divisieDoel, sub: "Je leidt het klassement" };
    return {
      kop: "Je leidt het klassement",
      sub: below ? `${below.gap} rating voorsprong op ${below.row.name}` : null,
    };
  }

  const inhaal =
    above.gap === 0
      ? `Gelijk met ${above.row.name}`
      : `${above.gap} rating achter ${above.row.name}`;
  if (!divisieDoel || next?.puntenNodig == null) return { kop: inhaal, sub: null };
  return above.gap <= next.puntenNodig
    ? { kop: inhaal, sub: divisieDoel }
    : { kop: divisieDoel, sub: inhaal };
}

/** ▲2/▼1/nieuw-label voor een rij; ook bruikbaar buiten de lane (detailsheet). */
export function rankShiftLabel(row: Row, previousRank: number | null): string | null {
  if (row.shift === "nieuw") return "nieuw";
  if (typeof row.shift === "number" && row.shift !== 0) {
    return row.shift > 0 ? `▲${row.shift}` : `▼${-row.shift}`;
  }
  if (previousRank != null && row.rank != null && previousRank !== row.rank) {
    const delta = previousRank - row.rank;
    return delta > 0 ? `▲${delta}` : `▼${-delta}`;
  }
  return null;
}

/**
 * Het verhaal van de baan voor schermlezers (#1241): volgorde, onderlinge
 * afstanden en de divisiepoorten. De visuele strook is puur decoratie; dit
 * is de toegankelijke tegenhanger.
 */
export function raceSrSummary(
  rows: readonly Row[],
  checkpoints: readonly RaceCheckpoint[],
): string {
  const rated = rows.filter((r): r is Row & { rating: number } => r.rating != null);
  if (rated.length === 0) return "";
  const volgorde = rated
    .map((r, i) => {
      const boven = i > 0 ? rated[i - 1] : null;
      const gap = boven ? boven.rating - r.rating : null;
      const afstand =
        gap == null ? "" : gap === 0 ? ", gelijk" : `, ${gap} achter`;
      return `${r.rank ?? i + 1}. ${r.name} (${r.rating} rating${afstand})`;
    })
    .join("; ");
  const poorten =
    checkpoints.length > 0
      ? ` Divisiepoorten op de baan: ${checkpoints
          .map((c) => `${c.naam} vanaf ${c.min} rating`)
          .join(", ")}.`
      : "";
  return `${volgorde}.${poorten}`;
}

// De replay-reconstructie is in #1241 opgegaan in de speeldag-tijdlijn:
// zie buildRaceTimeline in raceTimeline.ts.
