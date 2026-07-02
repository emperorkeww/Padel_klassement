import { useState } from "react";
import { useToast } from "../../components/ToastProvider";
import { errorMessage } from "../../lib/errors";
import type { Match, Profile, Team } from "../../lib/types";
import { setMatchResult, teamLabel } from "./api";
import { TeamSide } from "./MatchList";

/** Geplande match als kaart met inline score-invoer — dezelfde opbouw als een
 *  MatchCard (teams links/rechts), maar met invoervelden in het midden.
 *  De winnaar volgt automatisch uit de score; gelijke score = gelijkspel. */
export function PlannedMatchCard({
  match: m,
  teams,
  profiles,
  onSaved,
}: {
  match: Match;
  teams: Record<string, Team>;
  profiles: Record<string, Profile>;
  onSaved?: () => void;
}) {
  const toast = useToast();
  const [sa, setSa] = useState("");
  const [sb, setSb] = useState("");
  const [busy, setBusy] = useState(false);

  const saNum = sa === "" ? null : Number(sa);
  const sbNum = sb === "" ? null : Number(sb);
  const valid = saNum !== null && sbNum !== null && saNum >= 0 && sbNum >= 0;

  async function save() {
    if (!valid) return;
    setBusy(true);
    try {
      await setMatchResult({
        matchId: m.id,
        winnerTeamId:
          saNum === sbNum ? null : saNum! > sbNum! ? m.team_a_id : m.team_b_id,
        scoreA: saNum,
        scoreB: sbNum,
      });
      toast.success("Resultaat opgeslagen.");
      onSaved?.();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="match-card match-card--planned">
      <TeamSide team={teams[m.team_a_id]} profiles={profiles} won={false} />
      <span className="match-card__mid">
        <span className="planned-score">
          <input
            className="input input--score"
            type="number"
            min="0"
            inputMode="numeric"
            placeholder="0"
            aria-label={`Score ${teamLabel(teams[m.team_a_id], profiles)}`}
            value={sa}
            onChange={(e) => setSa(e.target.value)}
          />
          <span className="planned-score__dash">–</span>
          <input
            className="input input--score"
            type="number"
            min="0"
            inputMode="numeric"
            placeholder="0"
            aria-label={`Score ${teamLabel(teams[m.team_b_id], profiles)}`}
            value={sb}
            onChange={(e) => setSb(e.target.value)}
          />
        </span>
        <button
          className="btn btn--primary btn--sm"
          disabled={busy || !valid}
          onClick={save}
        >
          {busy ? "Opslaan…" : "Opslaan"}
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
