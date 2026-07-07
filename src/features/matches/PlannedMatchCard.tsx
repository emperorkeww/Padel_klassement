import { useState } from "react";
import { ScoreStepper } from "../../components/ScoreStepper";
import { useToast } from "../../components/ToastProvider";
import { useAsync } from "../../lib/useAsync";
import { errorMessage } from "../../lib/errors";
import { celebrate } from "../../lib/confetti";
import { tap, winPulse } from "../../lib/haptics";
import { winChance } from "../../lib/elo";
import { downloadIcs, icsEvent, localDate, localTime } from "../../lib/ics";
import { getPlayerRatings } from "../standings/ratingsApi";
import { useClub } from "../availability/club";
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
  const club = useClub();
  const [sa, setSa] = useState("");
  const [sb, setSb] = useState("");
  const [saved, setSaved] = useState<{ a: number; b: number } | null>(null);

  // Verwachte winstkans uit de (gecachte) ratings — zelfde Elo als de databank.
  const ratings = useAsync(getPlayerRatings, []);
  const chance =
    ratings.data && teams[m.team_a_id] && teams[m.team_b_id]
      ? winChance(teams[m.team_a_id], teams[m.team_b_id], ratings.data)
      : null;
  const pctA = chance != null ? Math.round(chance * 100) : null;

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
      const winner = a === b ? null : teams[a > b ? m.team_a_id : m.team_b_id];
      const iWon =
        !!perspectiveId &&
        !!winner &&
        (winner.player1_id === perspectiveId ||
          winner.player2_id === perspectiveId);
      if (iWon) {
        celebrate();
        winPulse();
      } else {
        tap();
      }
      toast.success("Resultaat opgeslagen.");
      onSaved?.();
    } catch (err) {
      setSaved(null); // terugdraaien; de kaart is weer invulbaar
      toast.error(errorMessage(err));
    }
  }

  /** ICS-download voor deze match: getimed als er een tijdstip gepland is,
   *  anders een event voor de hele (plan)dag. */
  function addToCalendar() {
    const when = new Date(m.played_at ?? m.created_at);
    const date = localDate(when);
    downloadIcs(
      `padel-${date}.ics`,
      icsEvent({
        title: `Padel: ${teamLabel(teams[m.team_a_id], profiles)} vs ${teamLabel(teams[m.team_b_id], profiles)}`,
        description:
          m.round_number != null ? `Ronde ${m.round_number}` : undefined,
        location: club.name,
        date,
        startTime: m.played_at ? localTime(when) : undefined,
        uid: `match-${m.id}@vamos-padel`,
      }),
    );
    tap();
  }

  if (saved) {
    const aWon = saved.a > saved.b;
    const bWon = saved.b > saved.a;
    return (
      <div className="match-card">
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

  // Scorebord-layout: per rij een team met zijn eigen stepper. De verwachte
  // winstkans staat als pil ín de rij van het team waar hij bij hoort.
  return (
    <div className="planned-card">
      <div className="planned-card__row">
        <TeamSide team={teams[m.team_a_id]} profiles={profiles} won={false} />
        {pctA != null && (
          <WinChip
            pct={pctA}
            favorite={pctA >= 50}
            teamName={teamLabel(teams[m.team_a_id], profiles)}
          />
        )}
        <ScoreStepper
          value={sa}
          onChange={setSa}
          label={`Score ${teamLabel(teams[m.team_a_id], profiles)}`}
        />
      </div>

      <div className="planned-card__row">
        <TeamSide team={teams[m.team_b_id]} profiles={profiles} won={false} />
        {pctA != null && (
          <WinChip
            pct={100 - pctA}
            favorite={100 - pctA >= 50}
            teamName={teamLabel(teams[m.team_b_id], profiles)}
          />
        )}
        <ScoreStepper
          value={sb}
          onChange={setSb}
          label={`Score ${teamLabel(teams[m.team_b_id], profiles)}`}
        />
      </div>

      <div className="planned-card__foot">
        <span className="match-card__meta">
          {m.round_number != null ? `ronde ${m.round_number} · gepland` : "gepland"}
        </span>
        <button className="agenda-btn" onClick={addToCalendar}>
          Zet in agenda
        </button>
        <button
          className="btn btn--primary btn--sm planned-card__save"
          disabled={!valid}
          onClick={save}
        >
          Opslaan
        </button>
      </div>
    </div>
  );
}

/** Pil met de verwachte winstkans van het team in dezelfde rij. */
function WinChip({
  pct,
  favorite,
  teamName,
}: {
  pct: number;
  favorite: boolean;
  teamName: string;
}) {
  return (
    <span
      className={`winchip ${favorite ? "winchip--fav" : ""}`}
      title={`Verwachte winstkans van ${teamName} op basis van de huidige ratings`}
    >
      <span className="winchip__label">winkans</span>
      {pct}%
    </span>
  );
}

export default PlannedMatchCard;
