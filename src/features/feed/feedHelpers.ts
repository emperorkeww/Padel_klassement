import { BOUNTY_EMOJI } from "@/features/rating/bounty";
import { PECHVOGEL_EMOJI } from "@/features/rating/pechvogel";
import type { FeedEvent, Highlight } from "./feedLogic";

/** Ruim venster aan recente uitslagen om de feed uit te filteren. */
export const MATCH_WINDOW = 250;

/** Filterchips: soortgroep → event-kinds. `null` = alles. Categorieën spiegelen
 *  de nieuwe kaart-hiërarchie (#232): de vroeger overladen "Groepen" is
 *  opgesplitst in Klassement (+ kampioen), een eigen Roast en een slanke Groepen. */
export const FILTERS = {
  Alles: null,
  Matches: new Set<FeedEvent["kind"]>(["match", "evening", "planned"]),
  // In-Form en On Fire horen hier en niet bij Roast: het zijn verdiensten uit
  // het klassement, net als een rangsprong of een promotie (#986).
  Klassement: new Set<FeedEvent["kind"]>([
    "rank",
    "season-champion",
    "tier",
    "in-form",
    "on-fire",
  ]),
  // De VAR hoort bij Roast en niet bij Matches: het is een sociaal ritueel met
  // Rudy als scheidsrechter, geen uitslag (#1025).
  Roast: new Set<FeedEvent["kind"]>([
    "pias-week",
    "maand-pias",
    "zwarte-piet",
    "smoes",
    "vendetta",
    "var",
  ]),
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
    // Eén In-Form-item per speler per week, één On Fire-item per doorbraak:
    // de sleutels zeggen precies dat, zodat een groeiende reeks of een tweede
    // zege in dezelfde week geen nieuw item oplevert (#986).
    case "in-form":
      return `if-${event.playerId}-${event.weekStart}`;
    case "on-fire":
      return `of-${event.playerId}-${event.matchId}`;
    case "smoes":
      return `sm-${event.matchId}-${event.playerId}`;
    case "vendetta":
      return `v-${event.groupId}-${event.challengerId}-${event.rivalId}-${event.sub}-${event.at}`;
    case "var":
      return `var-${event.appealId}`;
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
    case "vendetta":
      return `⚔️ Vendetta ${name(h.challengerId)} ${h.winsChallenger}–${h.winsRival} ${name(h.rivalId)}`;
    case "derby":
      return `🏟️ Derby · ${h.emoji} ${h.tierNaam}`;
    case "bounty":
      return `${BOUNTY_EMOJI} Bounty geclaimd op ${name(h.carrierId)} · +${h.amount}`;
    case "bounty-verdedigd":
      return `${BOUNTY_EMOJI} ${name(h.carrierId)} verdedigt z'n bounty · nu ${h.pool}`;
    case "lef":
      return `🎲 ${name(h.playerId)} speelde met lef (x${h.factor}) · ${h.won ? "winst!" : "verlies"}`;
    case "pechvogel":
      return `${PECHVOGEL_EMOJI} Pechvogel-meter van ${name(h.playerId)} vol · +${h.amount} troost`;
  }
}