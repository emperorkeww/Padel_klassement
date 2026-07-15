import { Link } from "react-router-dom";
import { Avatar } from "@/ui/Avatar";
import { CoachAvatar, type CoachMood } from "@/features/coach/components/CoachAvatar";
import { COMMENTATOR } from "@/features/coach/roastTone";
import { kiesOordeel } from "@/features/matches/excuses";
import { teamLabel } from "@/features/matches/api";
import type { Profile, Team } from "@/types";
import type { FeedEvent } from "../feedLogic";
import { CoachInfoButton } from "./CoachInfoButton";

/** Smoes-kaart (#296): de verliezer plaatste een excuus onder Coach Rudy's stem.
 *  Bewust twéé duidelijk verschillende bubbels — de speler zélf (eigen avatar +
 *  naam in een neutrale bubbel met 🙈-chip) en Coach Rudy's jury-oordeel in zijn
 *  eigen coach-bubbel eronder — zodat een smoes nooit te verwarren is met Rudy's
 *  gewone commentaar. Het oordeel is deterministisch uit de smoes afgeleid en
 *  respecteert het roast-schild van de speler. */
export function SmoesCard({
  event,
  pmap,
  tmap,
  name,
  onInfo,
}: {
  event: Extract<FeedEvent, { kind: "smoes" }>;
  pmap: Record<string, Profile>;
  tmap: Record<string, Team>;
  name: (pid: string) => string;
  onInfo: () => void;
}) {
  const beschermd = pmap[event.playerId]?.roast_schild ?? false;
  const oordeel = kiesOordeel(event.smoes, beschermd);
  // Rudy's mysterie volgt zijn oordeel: goedgekeurd → trots, afgekeurd → gemeen.
  const mood: CoachMood =
    beschermd || oordeel.gradatie === "matig"
      ? "portret"
      : oordeel.gradatie === "goedgekeurd"
        ? "trots"
        : "gemeen";
  // Bij wélke nederlaag hoort de smoes: tegenstander + score vanuit het verloren
  // team, zodat de kaart niet los in de feed hangt.
  const m = event.match;
  const nederlaag =
    m && m.winner_team_id
      ? (() => {
          const verliezerTeam =
            m.winner_team_id === m.team_a_id ? m.team_b_id : m.team_a_id;
          const tegenstander = teamLabel(tmap[m.winner_team_id], pmap);
          const heeftScore = m.score_a != null && m.score_b != null;
          const eigen = verliezerTeam === m.team_a_id ? m.score_a : m.score_b;
          const tegen = verliezerTeam === m.team_a_id ? m.score_b : m.score_a;
          return { tegenstander, score: heeftScore ? `${eigen}–${tegen}` : null };
        })()
      : null;
  return (
    <div className="feed-smoes">
      <Link className="feed-smoes__head" to={`/matches/${event.matchId}`}>
        <span className="feed-smoes__tok" aria-hidden="true">🙈</span>
        <span className="feed-smoes__headbody">
          <span className="feed-smoes__title">Smoes van de nederlaag</span>
          {nederlaag && (
            <span className="feed-smoes__match">
              verloor{nederlaag.score ? ` ${nederlaag.score}` : ""} van{" "}
              <strong>{nederlaag.tegenstander}</strong>
            </span>
          )}
        </span>
        <span className="feed-smoes__group">{event.groupName}</span>
      </Link>
      {/* De speler zelf verzint een excuus. */}
      <div className="smoes-bubble">
        <Avatar profile={pmap[event.playerId]} size={34} />
        <div className="smoes-bubble__body">
          <span className="smoes-bubble__name">
            {name(event.playerId)}
            <span className="smoes-bubble__tag">🙈 Smoes</span>
          </span>
          <span className="smoes-bubble__text">“{event.smoes}”</span>
        </div>
      </div>
      {/* Coach Rudy's jury-oordeel — de bestaande coach-bubbel. */}
      <div className="coach-comment">
        <CoachAvatar size={34} mood={mood} className="coach-comment__face" />
        <div className="coach-comment__bubble">
          <span className="coach-comment__head">
            <span className="coach-comment__name">{COMMENTATOR.naam} · jury</span>
            <CoachInfoButton onInfo={onInfo} />
          </span>
          <span
            className={`coach-comment__text smoes-oordeel smoes-oordeel--${oordeel.gradatie}`}
          >
            {oordeel.tekst}
          </span>
        </div>
      </div>
    </div>
  );
}
