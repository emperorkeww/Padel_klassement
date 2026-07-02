import { useState } from "react";
import { ScoreStepper } from "../../components/ScoreStepper";
import { useToast } from "../../components/ToastProvider";
import { useAsync } from "../../lib/useAsync";
import { errorMessage } from "../../lib/errors";
import { celebrate } from "../../lib/confetti";
import { winChance } from "../../lib/elo";
import { getPlayerRatings } from "../standings/ratingsApi";
import type { Match, Profile, Team } from "../../lib/types";
import { setMatchResult, teamLabel } from "./api";
import { TeamSide } from "./MatchList";

/** Geplande match als kaart met inline score-invoer — dezelfde opbouw als een
 *  MatchCard (teams links/rechts), maar met invoervelden in het midden.
 *  De winnaar volgt automatisch uit de score; gelijke score = gelijkspel.
 *
 *  Opslaan is optimistisch: de kaart klapt direct om naar de uitslag en wordt
 *  alleen teruggedraaid als de server weigert (bv. al door een ander ingevuld). */
export function PlannedMatchCard({
  match: m,
  teams,
  profiles,
  perspectiveId,
  onSaved,
}: {
  match: Match;
  teams: Record<string, Team>;
  profiles: Record<string, Profile>;
  /** Speler vanuit wiens oogpunt gevierd wordt (confetti bij eigen winst). */
  perspectiveId?: string;
  onSaved?: () => void;
}) {
  const toast = useToast();
  const [sa, setSa] = useState("");
  const [sb, setSb] = useState("");
  const [saved, setSaved] = useState<{ a: number; b: number } | null>(null);

  // Verwachte winstkans uit de (gecachte) ratings — zelfde Elo als de databank.
  const ratings = useAsync(getPlayerRatings, []);
  const chance =
    ratings.data && teams[m.team_a_id] && teams[m.team_b_id]
      ? winChance(teams[m.team_a_id], teams[m.team_b_id], ratings.data)
      : null;

  const saNum = sa === "" ? null : Number(sa);
  const sbNum = sb === "" ? null : Number(sb);
  const valid = saNum !== null && sbNum !== null && saNum >= 0 && sbNum >= 0;

  async function save() {
    if (!valid || saved) return;
    const a = saNum!;
    const b = sbNum!;
    setSaved({ a, b }); // optimistisch: meteen als uitslag tonen
    try {
      await setMatchResult({
        matchId: m.id,
        winnerTeamId: a === b ? null : a > b ? m.team_a_id : m.team_b_id,
        scoreA: a,
        scoreB: b,
      });
      if (perspectiveId && a !== b) {
        const winner = teams[a > b ? m.team_a_id : m.team_b_id];
        if (
          winner &&
          (winner.player1_id === perspectiveId ||
            winner.player2_id === perspectiveId)
        ) {
          celebrate();
        }
      }
      toast.success("Resultaat opgeslagen.");
      onSaved?.();
    } catch (err) {
      setSaved(null); // terugdraaien; de kaart is weer invulbaar
      toast.error(errorMessage(err));
    }
  }

  if (saved) {
    const aWon = saved.a > saved.b;
    const bWon = saved.b > saved.a;
    return (
      <div className="match-card match-card--planned">
        <TeamSide team={teams[m.team_a_id]} profiles={profiles} won={aWon} />
        <span className="match-card__mid">
          <span className="match-card__score">
            {saved.a}–{saved.b}
          </span>
          <span className="match-card__meta">
            {aWon || bWon ? "opgeslagen ✓" : "gelijkspel · opgeslagen ✓"}
          </span>
        </span>
        <TeamSide team={teams[m.team_b_id]} profiles={profiles} won={bWon} right />
      </div>
    );
  }

  return (
    <div className="match-card match-card--planned">
      <TeamSide team={teams[m.team_a_id]} profiles={profiles} won={false} />
      <span className="match-card__mid">
        {chance != null && (
          <span
            className="winchance"
            title="Verwachte winstkans op basis van de huidige ratings"
          >
            <span className="winchance__pct">{Math.round(chance * 100)}%</span>
            <span className="winchance__bar">
              <span
                className="winchance__fill"
                style={{ width: `${Math.round(chance * 100)}%` }}
              />
            </span>
            <span className="winchance__pct">
              {100 - Math.round(chance * 100)}%
            </span>
          </span>
        )}
        <span className="planned-score">
          <ScoreStepper
            value={sa}
            onChange={setSa}
            label={`Score ${teamLabel(teams[m.team_a_id], profiles)}`}
          />
          <span className="planned-score__dash">–</span>
          <ScoreStepper
            value={sb}
            onChange={setSb}
            label={`Score ${teamLabel(teams[m.team_b_id], profiles)}`}
          />
        </span>
        <button
          className="btn btn--primary btn--sm"
          disabled={!valid}
          onClick={save}
        >
          Opslaan
        </button>
        <span className="match-card__meta">
          {m.round_number != null ? `ronde ${m.round_number} · gepland` : "gepland"}
        </span>
      </span>
      <TeamSide team={teams[m.team_b_id]} profiles={profiles} won={false} right />
    </div>
  );
}

export default PlannedMatchCard;
