import { Link } from "react-router-dom";
import { Avatar } from "@/ui/Avatar";
import { type CoachMood } from "@/features/coach/components/CoachAvatar";
import { teamLabel } from "@/features/matches/api";
import { MatchCard } from "@/features/matches/components/MatchList";
import type { EveningSummary } from "@/features/feed/eveningSummary";
import type { Profile } from "@/types";
import type { FeedEvent } from "../feedLogic";
import { CoachMonologue } from "./CoachMonologue";

/** Rijk speelavond-blok (#232 PR C): mini-eindstand van de avond + beste duo,
 *  met Coach Rudy's avondverslag eronder — i.p.v. één compacte regel. */
export function EveningCard({
  event,
  data,
  mood,
  pmap,
  tmap,
  name,
  onInfo,
}: {
  event: Extract<FeedEvent, { kind: "evening" }>;
  data: { summary: EveningSummary; coachLines: string[] };
  mood: CoachMood;
  pmap: Record<string, Profile>;
  tmap: Parameters<typeof MatchCard>[0]["teams"];
  name: (pid: string) => string;
  onInfo: () => void;
}) {
  const { summary, coachLines } = data;
  const top = summary.rows.slice(0, 4);
  return (
    <div className="feed-evening">
      <Link className="feed-evening__head" to={`/groepen/${event.groupId}`}>
        <span className="feed-evening__tok" aria-hidden="true">🎾</span>
        <span className="feed-evening__title">Speelavond · {event.count} matches</span>
        <span className="feed-evening__group">{event.groupName}</span>
      </Link>
      {top.length > 0 && (
        <ol className="ev-stand">
          {top.map((r, i) => (
            <li className="ev-row" key={r.playerId}>
              <span className="ev-row__pos">{i + 1}</span>
              <Avatar profile={pmap[r.playerId]} size={22} />
              <span className="ev-row__nm">{name(r.playerId)}</span>
              <span className="ev-row__wl">
                {r.won}–{r.lost}
              </span>
              <span className="ev-row__pt">{r.points} ptn</span>
            </li>
          ))}
        </ol>
      )}
      {summary.bestDuo && (
        <p className="ev-duo">
          👯 Beste duo: <strong>{teamLabel(tmap[summary.bestDuo.teamId], pmap)}</strong> —{" "}
          {summary.bestDuo.won} {summary.bestDuo.won === 1 ? "winst" : "winsten"} samen.
        </p>
      )}
      <CoachMonologue lines={coachLines} mood={mood} onInfo={onInfo} />
    </div>
  );
}
