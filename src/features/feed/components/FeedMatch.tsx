import { Link } from "react-router-dom";
import { readSetScores, teamLabel } from "@/features/matches/api";
import { traktatieRegel } from "@/features/matches/drankkaart";
import { formatTime } from "@/lib/utils/format";
import type { Profile, Team } from "@/types";
import type { FeedEvent } from "../feedLogic";
import { highlightText } from "../feedHelpers";
import { TeamCol } from "./TeamCol";

/** Match-kaart in de feed (#232): chip-header, avatars boven de teamnaam, grote
 *  centrale score met winnaar-accent en de set-uitslag als chips eronder. */
export function FeedMatch({
  event,
  tmap,
  pmap,
  name,
}: {
  event: Extract<FeedEvent, { kind: "match" }>;
  tmap: Record<string, Team>;
  pmap: Record<string, Profile>;
  name: (pid: string) => string;
}) {
  const m = event.match;
  const done = m.status === "completed";
  const aWon = done && m.winner_team_id === m.team_a_id;
  const bWon = done && m.winner_team_id === m.team_b_id;
  const scored = m.score_a != null && m.score_b != null;
  const sets = readSetScores(m) ?? [];
  const traktatie = traktatieRegel(m);
  const teamLbl = (tid: string) => teamLabel(tmap[tid], pmap);
  return (
    <Link className="fmatch" to={`/matches/${m.id}`}>
      <div className="fmatch__head">
        {event.myDelta != null && event.myDelta !== 0 && (
          <span className={`badge ${event.myDelta > 0 ? "badge--win" : "badge--loss"}`}>
            {event.myDelta > 0 ? "▲" : "▼"} {Math.abs(event.myDelta)} rating
            {/* Lef-tip (#804): zonder dit staat er een getal dat twee keer zo
                groot is als dat van je ploegmaat, zonder enige uitleg. */}
            {(event.myStakeFactor ?? 1) > 1 && ` · lef ×${event.myStakeFactor}`}
            {/* Bounty (#805): om dezelfde reden. Je deel van de verschuiving
                zit al in het getal ernaast; dit vertelt waar het vandaan kwam. */}
            {!!event.myBounty &&
              ` · bounty ${event.myBounty > 0 ? "+" : "−"}${Math.abs(event.myBounty)}`}
          </span>
        )}
        {event.highlights.map((h, i) => (
          <span key={i} className="fmatch__chip">
            {highlightText(h, name, teamLbl)}
          </span>
        ))}
        <span className="fmatch__time">{formatTime(event.at)}</span>
      </div>
      <div className="fmatch__board">
        <TeamCol team={tmap[m.team_a_id]} pmap={pmap} won={aWon} label={teamLbl(m.team_a_id)} />
        <div className="fmatch__score">
          {scored ? (
            <>
              <span className={aWon ? "w" : ""}>{m.score_a}</span>
              <span className="d">–</span>
              <span className={bWon ? "w" : ""}>{m.score_b}</span>
            </>
          ) : (
            <span className="fmatch__vs">{done ? "gespeeld" : "vs"}</span>
          )}
        </div>
        <TeamCol team={tmap[m.team_b_id]} pmap={pmap} won={bWon} label={teamLbl(m.team_b_id)} />
      </div>
      {sets.length > 0 && (
        <div className="fmatch__sets">
          {sets.map((s, i) => (
            <span key={i} className="fmatch__set">
              {s[0]}–{s[1]}
            </span>
          ))}
        </div>
      )}
      {/* Drankje-inzet (#1004): de uitslagenfeed is precies waar de openstaande
          rekening thuishoort — wie er nog een pint moet halen leest hier terug,
          en na het afvinken staat er dat het ingelost is. */}
      {traktatie && <p className="fmatch__traktatie">{traktatie}</p>}
    </Link>
  );
}
