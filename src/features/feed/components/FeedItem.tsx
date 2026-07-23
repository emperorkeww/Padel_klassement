import { formatDate } from "@/lib/utils/format";
import { displayName } from "@/features/profiles/api";
import { piasDetail } from "@/features/groups/maandpias";
import type { Profile, Team } from "@/types";
import type { FeedEvent } from "../feedLogic";
import { FeedHighlight } from "./FeedHighlight";
import { FeedLine } from "./FeedLine";
import { FeedMatch } from "./FeedMatch";
import { VendettaFeedCard } from "./VendettaFeedCard";

export function FeedItem({
  event,
  pmap,
  tmap,
  myId,
  name,
}: {
  event: FeedEvent;
  pmap: Record<string, Profile>;
  tmap: Record<string, Team>;
  myId: string;
  name: (pid: string) => string;
}) {
  switch (event.kind) {
    case "smoes":
      return null; // smoezen renderen via SmoesCard, niet via FeedItem
    case "evening":
      return null; // speelavonden renderen via EveningCard, niet via FeedItem
    case "match":
      return <FeedMatch event={event} tmap={tmap} pmap={pmap} name={name} />;
    case "friendship": {
      // Eigen vriendschap: "Jij en X"; die van groepsgenoten: "X en Y".
      const involvesMe = event.a === myId || event.b === myId;
      const other = event.a === myId ? event.b : event.a;
      return (
        <FeedLine
          icon="🤝"
          to={`/spelers/${involvesMe ? other : event.a}`}
          avatars={[event.a, event.b]}
          pmap={pmap}
          at={event.at}
        >
          {involvesMe ? (
            <>
              Jij en <strong>{displayName(pmap[other])}</strong> zijn nu
              vrienden.
            </>
          ) : (
            <>
              <strong>{displayName(pmap[event.a])}</strong> en{" "}
              <strong>{displayName(pmap[event.b])}</strong> zijn nu vrienden.
            </>
          )}
        </FeedLine>
      );
    }
    case "planned":
      return (
        <FeedLine
          icon="🗓️"
          to={`/matches/${event.match.id}`}
          pmap={pmap}
          at={event.at}
        >
          Nieuwe match gepland op{" "}
          <strong>{formatDate(event.match.played_at)}</strong>.
        </FeedLine>
      );
    case "group-created":
      return (
        <FeedLine
          icon="👥"
          to={`/groepen/${event.groupId}`}
          avatars={event.playerId ? [event.playerId] : []}
          pmap={pmap}
          at={event.at}
        >
          {event.playerId ? (
            <>
              {name(event.playerId)} startte de groep{" "}
              <strong>{event.groupName}</strong>.
            </>
          ) : (
            <>
              Nieuwe groep: <strong>{event.groupName}</strong>.
            </>
          )}
        </FeedLine>
      );
    case "group-joined":
      return (
        <FeedLine
          icon="👥"
          to={`/groepen/${event.groupId}`}
          avatars={[event.playerId]}
          pmap={pmap}
          at={event.at}
        >
          {name(event.playerId)} {event.playerId === myId ? "bent" : "is"} lid
          geworden van <strong>{event.groupName}</strong>.
        </FeedLine>
      );
    case "poll":
      return (
        <FeedLine
          icon="🗳️"
          to={`/groepen/${event.groupId}?tab=plannen`}
          pmap={pmap}
          at={event.at}
        >
          Speeldag-poll gestart in <strong>{event.groupName}</strong> — stem
          mee!
        </FeedLine>
      );
    case "poll-locked":
    case "poll-booked":
      return (
        <FeedLine
          icon={event.kind === "poll-locked" ? "📌" : "✅"}
          to={`/groepen/${event.groupId}?tab=plannen`}
          pmap={pmap}
          at={event.at}
        >
          {event.kind === "poll-locked" ? "Speeldag ligt vast" : "Baan geboekt"}
          {event.date && (
            <>
              : <strong>{formatDate(event.date)}
              {event.time ? ` om ${event.time}` : ""}</strong>
            </>
          )}{" "}
          — <strong>{event.groupName}</strong>
        </FeedLine>
      );
    case "rank": {
      const nieuw = event.shift === "nieuw";
      const omhoog = !nieuw && (event.shift as number) > 0;
      return (
        <FeedHighlight
          cat="rank"
          icon={nieuw ? "✨" : omhoog ? "⬆️" : "⬇️"}
          label={`Klassement · ${nieuw ? "nieuw" : omhoog ? "stijger" : "daler"}`}
          to="/klassement"
          at={event.at}
        >
          {nieuw ? (
            <>
              {name(event.playerId)} staat nieuw op <strong>#{event.rank}</strong>.
            </>
          ) : (
            <>
              {name(event.playerId)} {omhoog ? "steeg" : "zakte"}{" "}
              <strong>{Math.abs(event.shift as number)} plekken</strong> naar #{event.rank}.
            </>
          )}
        </FeedHighlight>
      );
    }
    case "tier":
      return (
        <FeedHighlight
          cat="rank"
          icon={event.naarEmoji}
          label={event.richting === "promotie" ? "Promotie" : "Degradatie"}
          to={`/matches/${event.matchId}`}
          at={event.at}
        >
          {event.richting === "promotie" ? (
            <>
              🔥 <strong>{name(event.playerId)}</strong> stijgt naar een gloednieuwe divisie:{" "}
              <strong>{event.naarLabel}</strong>!
            </>
          ) : (
            <>
              📉 <strong>{name(event.playerId)}</strong> degradeert naar{" "}
              <strong>{event.naarLabel}</strong> (was {event.vanLabel})
            </>
          )}
        </FeedHighlight>
      );
    case "season-champion":
      return (
        <FeedHighlight
          cat="champ"
          icon="🏆"
          label="Seizoenskampioen"
          to={`/groepen/${event.groupId}?tab=stand&seizoen=${event.seasonLabel}`}
          at={event.at}
        >
          {name(event.playerId)} {event.playerId === myId ? "bent" : "is"} kampioen van{" "}
          <strong>{event.groupName}</strong> ({event.seasonLabel})!
        </FeedHighlight>
      );
    case "maand-pias":
      {
        const beschermd = pmap[event.playerId]?.roast_schild ?? false;
        return (
          <FeedHighlight cat="roast" icon={beschermd ? "📊" : "🤡"} label={beschermd ? "Opvallende maand" : "Pias van de maand"} to={`/groepen/${event.groupId}`} at={event.at}>
            {beschermd ? (
              <>
                {name(event.playerId)} had een <strong>opvallende maand</strong> ({event.periodeLabel}): {event.detail}.
              </>
            ) : event.playerId === myId ? (
              <>
                Jij bent de <strong>pias van de maand</strong> ({event.periodeLabel}): je {event.detail}.
              </>
            ) : (
              <>
                {name(event.playerId)} is de <strong>pias van de maand</strong> ({event.periodeLabel}):{" "}
                {event.detail}.
              </>
            )}
          </FeedHighlight>
        );
      }
    case "pias-week":
      {
        const beschermd = pmap[event.playerId]?.roast_schild ?? false;
        return (
          <FeedHighlight cat="roast" icon={beschermd ? "📊" : "🤡"} label={beschermd ? "Opvallende week" : "Pias van de week"} to={`/groepen/${event.groupId}`} at={event.at}>
            {beschermd ? (
              <>
                {name(event.playerId)} had een <strong>opvallende week</strong> in {event.groupName}:
                een week om snel te vergeten.
              </>
            ) : event.playerId === myId ? (
              <>
                Jij bent de <strong>pias van de week</strong> in {event.groupName}: je{" "}
                {piasDetail(event.reden, event.waarde)}.
              </>
            ) : (
              <>
                {name(event.playerId)} is de <strong>pias van de week</strong> in {event.groupName}:{" "}
                {piasDetail(event.reden, event.waarde)}.
              </>
            )}
          </FeedHighlight>
        );
      }
    case "zwarte-piet":
      {
        const beschermd = pmap[event.toPlayerId]?.roast_schild ?? false;
        if (beschermd) {
          return (
            <FeedHighlight cat="roast" icon="📊" label="Schande-token" to={`/groepen/${event.groupId}`} at={event.at}>
              {name(event.toPlayerId)} kreeg het <strong>schande-token</strong> in {event.groupName}
              {event.fromPlayerId ? ` van ${name(event.fromPlayerId)}` : ""}: {event.detail}.
            </FeedHighlight>
          );
        }
      }
      return (
        <FeedHighlight cat="roast" icon="🃏" label="Zwarte Piet" to={`/groepen/${event.groupId}`} at={event.at}>
          {event.toPlayerId === myId ? "Jij pakte" : `${name(event.toPlayerId)} pakte`} de{" "}
          <strong>Zwarte Piet</strong> in {event.groupName}
          {event.fromPlayerId ? ` af van ${name(event.fromPlayerId)}` : ""}: {event.detail}.
        </FeedHighlight>
      );
    case "vendetta": {
      // `name` geeft "Jij" voor jezelf: prima als onderwerp, maar in
      // lijdend/meewerkend voorwerp leest alleen "jou" goed ("tegen jou").
      const jou = (pid: string) => (pid === myId ? "jou" : name(pid));
      if (event.sub === "beslist") {
        return <VendettaFeedCard event={event} name={name} jou={jou} />;
      }
      if (event.sub === "gestart") {
        return (
          <FeedLine
            icon="⚔️"
            to={`/groepen/${event.groupId}?tab=spelen`}
            avatars={[event.challengerId, event.rivalId]}
            pmap={pmap}
            at={event.at}
          >
            {name(event.challengerId)} verklaarde een{" "}
            <strong>vendetta</strong> tegen <strong>{jou(event.rivalId)}</strong>{" "}
            in {event.groupName} — eerste tot {event.doel} zeges.
          </FeedLine>
        );
      }
      // "omgeslagen": de leiding in het onderlinge seizoen kantelde.
      const chLeidt = event.winsChallenger > event.winsRival;
      const leiderId = chLeidt ? event.challengerId : event.rivalId;
      const anderId = chLeidt ? event.rivalId : event.challengerId;
      const stand = chLeidt
        ? `${event.winsChallenger}–${event.winsRival}`
        : `${event.winsRival}–${event.winsChallenger}`;
      return (
        <FeedLine
          icon="🔄"
          to={event.matchId ? `/matches/${event.matchId}` : `/groepen/${event.groupId}?tab=spelen`}
          avatars={[event.challengerId, event.rivalId]}
          pmap={pmap}
          at={event.at}
        >
          De vendetta kantelt: <strong>{name(leiderId)}</strong> leidt nu{" "}
          <strong>{stand}</strong> tegen {jou(anderId)} in {event.groupName}.
        </FeedLine>
      );
    }
  }
}
