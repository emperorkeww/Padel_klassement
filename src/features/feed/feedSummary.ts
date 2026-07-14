import type { FeedEvent } from "../../lib/feed";
import type { Match, Profile, RoastIntensiteit, Team } from "@/types";
import { formatDate } from "@/lib/utils/format";
import { kleurRoast, roastCtx, roastSeed } from "../../lib/roastTone";
import { teamLabel } from "../matches/api";
import { displayName } from "../profiles/api";

// Compacte één-regel-samenvatting per feed-gebeurtenis, voor de
// "Recente activiteit"-preview op het dashboard (#59). De volledige /feed-
// pagina houdt haar rijke weergave (MatchCard, avatars, chips); hier willen
// we juist korte regels. Icoon en linkdoel spiegelen Feed.tsx zodat beide
// oppervlakken consistent aanvoelen. Puur en getest in feedSummary.test.ts.

export interface FeedRegel {
  /** Emoji-icoon vóór de tekst. */
  icon: string;
  /** Korte omschrijving in het Nederlands. */
  tekst: string;
  /** Doel-route van het item (match/profiel/groep/klassement). */
  to: string;
}

export interface FeedSummaryCtx {
  profiles: Record<string, Profile>;
  teams: Record<string, Team>;
  myId: string;
  /** Roast-toon per groep (#183); ontbreekt → 'gemeen' (de DB-default). */
  intensiteitVoor?: (groupId: string) => RoastIntensiteit;
}

/** Roast-context voor een pias-item: groeps-intensiteit + schild van het doelwit. */
function piasCtx(ctx: FeedSummaryCtx, groupId: string, playerId: string) {
  return roastCtx(
    { roast_intensiteit: ctx.intensiteitVoor?.(groupId) ?? "gemeen" },
    ctx.profiles[playerId],
  );
}

const naam = (ctx: FeedSummaryCtx, id: string) => displayName(ctx.profiles[id]);
const team = (ctx: FeedSummaryCtx, id: string) =>
  teamLabel(ctx.teams[id], ctx.profiles);

/** Korte uitslagregel: "X won van Y" / "X speelde gelijk tegen Y". */
function matchTekst(m: Match, ctx: FeedSummaryCtx): string {
  const a = team(ctx, m.team_a_id);
  const b = team(ctx, m.team_b_id);
  if (!m.winner_team_id) return `${a} speelde gelijk tegen ${b}`;
  const win = m.winner_team_id === m.team_a_id ? a : b;
  const verlies = m.winner_team_id === m.team_a_id ? b : a;
  return `${win} won van ${verlies}`;
}

export function feedSummary(e: FeedEvent, ctx: FeedSummaryCtx): FeedRegel {
  switch (e.kind) {
    case "match":
      return { icon: "🎾", tekst: matchTekst(e.match, ctx), to: `/matches/${e.match.id}` };
    case "friendship": {
      const betreftMij = e.a === ctx.myId || e.b === ctx.myId;
      const ander = e.a === ctx.myId ? e.b : e.a;
      return {
        icon: "🤝",
        tekst: betreftMij
          ? `Jij en ${naam(ctx, ander)} zijn nu vrienden`
          : `${naam(ctx, e.a)} en ${naam(ctx, e.b)} zijn nu vrienden`,
        to: `/spelers/${betreftMij ? ander : e.a}`,
      };
    }
    case "planned":
      return {
        icon: "🗓️",
        tekst: `Nieuwe match gepland op ${formatDate(e.match.played_at)}`,
        to: `/matches/${e.match.id}`,
      };
    case "group-created":
      return {
        icon: "👥",
        tekst: e.playerId
          ? `${naam(ctx, e.playerId)} startte ${e.groupName}`
          : `Nieuwe groep: ${e.groupName}`,
        to: `/groepen/${e.groupId}`,
      };
    case "group-joined":
      return {
        icon: "👥",
        tekst: `${naam(ctx, e.playerId)} ${e.playerId === ctx.myId ? "bent" : "is"} lid geworden van ${e.groupName}`,
        to: `/groepen/${e.groupId}`,
      };
    case "poll":
      return {
        icon: "🗳️",
        tekst: `Speeldag-poll gestart in ${e.groupName}`,
        to: `/groepen/${e.groupId}?tab=plannen`,
      };
    case "poll-locked":
    case "poll-booked": {
      const wat = e.kind === "poll-locked" ? "Speeldag ligt vast" : "Baan geboekt";
      const wanneer = e.date
        ? ` op ${formatDate(e.date)}${e.time ? ` om ${e.time}` : ""}`
        : "";
      return {
        icon: e.kind === "poll-locked" ? "📌" : "✅",
        tekst: `${wat}${wanneer} — ${e.groupName}`,
        to: `/groepen/${e.groupId}?tab=plannen`,
      };
    }
    case "evening":
      return {
        icon: "🎾",
        tekst: `Speelavond in ${e.groupName}: ${e.count} matches`,
        to: `/groepen/${e.groupId}`,
      };
    case "rank":
      return {
        icon: e.shift === "nieuw" ? "✨" : (e.shift as number) > 0 ? "⬆️" : "⬇️",
        tekst:
          e.shift === "nieuw"
            ? `${naam(ctx, e.playerId)} staat nieuw op #${e.rank} in het klassement`
            : `${naam(ctx, e.playerId)} ${(e.shift as number) > 0 ? "steeg" : "zakte"} naar #${e.rank}`,
        to: "/klassement",
      };
    case "season-champion":
      return {
        icon: "🏆",
        tekst: `${naam(ctx, e.playerId)} ${e.playerId === ctx.myId ? "bent" : "is"} kampioen van ${e.groupName} (${e.seasonLabel})`,
        to: `/groepen/${e.groupId}?tab=stand&seizoen=${e.seasonLabel}`,
      };
    case "maand-pias":
      return {
        icon: "🤡",
        tekst: kleurRoast(
          `${naam(ctx, e.playerId)} is de pias van de maand (${e.periodeLabel}): ${e.detail}`,
          piasCtx(ctx, e.groupId, e.playerId),
          roastSeed(e.playerId, e.periodeLabel),
        ),
        to: `/groepen/${e.groupId}`,
      };
    case "pias-week":
      return {
        icon: "🤡",
        tekst: kleurRoast(
          `${naam(ctx, e.playerId)} is de pias van de week in ${e.groupName}: verloor als torenhoge favoriet (${Math.round(e.winChance * 100)}%)`,
          piasCtx(ctx, e.groupId, e.playerId),
          roastSeed(e.playerId, e.weekStart),
        ),
        to: `/groepen/${e.groupId}`,
      };
    case "zwarte-piet":
      return {
        icon: "🃏",
        tekst: kleurRoast(
          `${naam(ctx, e.toPlayerId)} pakte de Zwarte Piet in ${e.groupName}${e.fromPlayerId ? ` af van ${naam(ctx, e.fromPlayerId)}` : ""}: ${e.detail}`,
          piasCtx(ctx, e.groupId, e.toPlayerId),
          roastSeed(e.toPlayerId, e.at),
        ),
        to: `/groepen/${e.groupId}`,
      };
    case "smoes": {
      const tegen =
        e.match && e.match.winner_team_id
          ? ` tegen ${team(ctx, e.match.winner_team_id)}`
          : "";
      return {
        icon: "🙈",
        tekst: `${naam(ctx, e.playerId)} verzon een smoes na de nederlaag${tegen} in ${e.groupName}`,
        to: `/matches/${e.matchId}`,
      };
    }
  }
}
