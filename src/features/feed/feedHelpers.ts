import type { FeedEvent, Highlight } from "./feedLogic";

/** Ruim venster aan recente uitslagen om de feed uit te filteren. */
export const MATCH_WINDOW = 250;

/** Filterchips: soortgroep → event-kinds. `null` = alles. Categorieën spiegelen
 *  de nieuwe kaart-hiërarchie (#232): de vroeger overladen "Groepen" is
 *  opgesplitst in Klassement (+ kampioen), een eigen Roast en een slanke Groepen. */
export const FILTERS = {
  Alles: null,
  Matches: new Set<FeedEvent["kind"]>(["match", "evening", "planned"]),
  Klassement: new Set<FeedEvent["kind"]>(["rank", "season-champion", "tier"]),
  Roast: new Set<FeedEvent["kind"]>(["pias-week", "maand-pias", "zwarte-piet", "smoes"]),
  Groepen: new Set<FeedEvent["kind"]>([
    "group-created",
    "group-joined",
    "poll",
    "poll-locked",
    "poll-booked",
  ]),
  Sociaal: new Set<FeedEvent["kind"]>(["friendship"]),
} as const;
export type FilterLabel = keyof typeof FILTERS;
export const FILTER_LABELS = Object.keys(FILTERS) as FilterLabel[];

/** Categoriekleur-stip per filter — spiegelt de highlight-kaarten (#232). */
export const FILTER_CAT: Partial<Record<FilterLabel, "match" | "rank" | "roast">> = {
  Matches: "match",
  Klassement: "rank",
  Roast: "roast",
};

export function eventKey(event: FeedEvent): string {
  switch (event.kind) {
    case "match":
      return `m-${event.match.id}`;
    case "planned":
      return `p-${event.match.id}`;
    case "friendship":
      return `f-${event.a}-${event.b}-${event.at}`;
    case "group-created":
      return `gc-${event.groupId}`;
    case "group-joined":
      return `gj-${event.groupId}-${event.playerId}`;
    case "poll":
      return `poll-${event.groupId}-${event.at}`;
    case "poll-locked":
    case "poll-booked":
      return `${event.kind}-${event.groupId}-${event.at}`;
    case "evening":
      return `e-${event.groupId}-${event.day}`;
    case "rank":
      return `r-${event.playerId}-${event.at}`;
    case "tier":
      return `t-${event.playerId}-${event.matchId}`;
    case "season-champion":
      return `sc-${event.groupId}-${event.seasonLabel}`;
    case "maand-pias":
      return `mp-${event.groupId}-${event.periodeLabel}`;
    case "pias-week":
      return `pw-${event.groupId}-${event.weekStart}`;
    case "zwarte-piet":
      return `zp-${event.groupId}-${event.at}`;
    case "smoes":
      return `sm-${event.matchId}-${event.playerId}`;
  }
}

/** Chip-tekst per highlight; namen/teams komen uit de meegegeven resolvers. */
export function highlightText(
  h: Highlight,
  name: (pid: string) => string,
  team: (teamId: string) => string,
): string {
  switch (h.type) {
    case "upset":
      return `🎯 ${team(h.winnerTeamId)} verrasten (${Math.round(h.chance * 100)}% kans)`;
    case "score":
      return h.label === "bagel"
        ? "🥯 6-0 Droog"
        : h.label === "monsterzege"
          ? "🦖 Monsterzege"
          : "😬 Nagelbijter";
    case "streak":
      return `🔥 ${name(h.playerId)} ${h.count} op rij`;
    case "duo":
      return `👯 ${team(h.teamId)} ${h.count} samen op rij`;
    case "rating":
      return `📈 ${name(h.playerId)} door de ${h.threshold}`;
    case "tier":
      return h.richting === "promotie"
        ? `${h.emoji} ${name(h.playerId)} promoveert naar ${h.label}`
        : `${h.emoji} ${name(h.playerId)} zakt naar ${h.label}`;
  }
}