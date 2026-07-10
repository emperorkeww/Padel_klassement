import { useEffect, useMemo, useRef, useState } from "react";
import { ScoreStepper } from "../../components/ScoreStepper";
import { useToast } from "../../components/ToastProvider";
import { useAsync } from "../../lib/useAsync";
import { errorMessage } from "../../lib/errors";
import { celebrate } from "../../lib/confetti";
import { tap, winPulse } from "../../lib/haptics";
import { winChance } from "../../lib/elo";
import { inTeam } from "../../lib/results";
import {
  groupRivalries,
  rivalryForMatch,
  rivalryHeadline,
  standAfter,
} from "../../lib/rivalry";
import { getPlayerRatings } from "../standings/ratingsApi";
import { displayName } from "../profiles/api";
import type { Match, Profile, Team } from "../../lib/types";
import {
  deleteMatch,
  emptySet,
  setMatchResult,
  teamLabel,
  toSetScores,
  updatePlannedMatchTime,
  type SetPair,
} from "./api";
import { MatchCalendarButton } from "./MatchCalendarButton";
import { SetScoresInput } from "./SetScoresInput";
import { TeamSide } from "./MatchList";
import "./PlannedMatchCard.css";

const UNDO_MS = 6000;

/** ISO-tijdstip -> waarde voor een <input type="datetime-local"> ("" = geen). */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

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
  history,
  onSaved,
  onDeleted,
}: {
  match: Match;
  teams: Record<string, Team>;
  profiles: Record<string, Profile>;
  /** Speler vanuit wiens oogpunt gevierd wordt (confetti bij eigen winst). */
  perspectiveId?: string;
  /** Eerdere matches waaruit de onderlinge rivaliteit wordt afgeleid; zonder
   *  deze prop toont de kaart geen head-to-head-balans. */
  history?: Match[];
  onSaved?: () => void;
  /** Aangeroepen nadat de match echt verwijderd is (bv. terugnavigeren op de
   *  detailpagina). Zonder deze prop valt het terug op onSaved. */
  onDeleted?: () => void;
}) {
  const toast = useToast();
  const [sa, setSa] = useState("");
  const [sb, setSb] = useState("");
  const [saved, setSaved] = useState<{
    a: number;
    b: number;
    /** Bijgewerkte onderlinge stand, bevroren op het moment van opslaan
     *  (daarna telt de match zelf mee in `history`). */
    rivalryLine?: string;
  } | null>(null);

  // Optionele per-set invoer (uitklapbaar).
  const [showSets, setShowSets] = useState(false);
  const [sets, setSets] = useState<SetPair[]>([emptySet()]);

  // Tijd wijzigen (uitklapbaar).
  const [editingTime, setEditingTime] = useState(false);
  const [timeVal, setTimeVal] = useState(() => toLocalInput(m.played_at));
  const [busyTime, setBusyTime] = useState(false);

  // Verwijderen met undo: we wachten UNDO_MS vóór de server-call, zodat de
  // gebruiker het ongedaan kan maken zonder dat er iets hersteld hoeft te worden.
  const [pendingDelete, setPendingDelete] = useState(false);
  const deleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (deleteTimer.current) clearTimeout(deleteTimer.current);
    },
    [],
  );

  // Spannendste rivaliteit tussen de vier tegenover-elkaar-paren, afgeleid
  // uit de meegegeven historiek (alleen afgeronde matches tellen mee).
  const rivalry = useMemo(() => {
    if (!history?.length) return null;
    return rivalryForMatch(m, teams, groupRivalries(history, teams));
  }, [history, teams, m]);
  const nameOf = (id: string) => displayName(profiles[id]);

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
  // Alleen de aanmaker mag verplaatsen/verwijderen (de server dwingt dit ook af);
  // toon die knoppen dus niet aan anderen om een voorspelbare fout te vermijden.
  const canManage = !!perspectiveId && m.created_by === perspectiveId;

  async function save() {
    if (!valid || saved) return;
    const a = saNum!;
    const b = sbNum!;
    const setScores = toSetScores(sets);

    // Rivaliteitsmoment: wie van het rivalenpaar won dit duel (null = gelijk),
    // en hoe staat het daarna? Vastleggen vóór de herlaadde data binnenkomt.
    const winnerTeam = a === b ? null : teams[a > b ? m.team_a_id : m.team_b_id];
    const rivalWinner =
      rivalry === null
        ? null
        : winnerTeam === null
          ? null
          : inTeam(winnerTeam, rivalry.a)
            ? rivalry.a
            : rivalry.b;
    const rivalryLine = rivalry
      ? (() => {
          const after = standAfter(rivalry, rivalWinner);
          return `${nameOf(rivalry.a)} ${after.winsA}–${after.winsB} ${nameOf(rivalry.b)}`;
        })()
      : undefined;

    setSaved({ a, b, rivalryLine }); // optimistisch: meteen als uitslag tonen
    try {
      await setMatchResult({
        matchId: m.id,
        winnerTeamId: a === b ? null : a > b ? m.team_a_id : m.team_b_id,
        scoreA: a,
        scoreB: b,
        setScores: setScores.length > 0 ? setScores : null,
      });
      const iWon =
        !!perspectiveId &&
        !!winnerTeam &&
        (winnerTeam.player1_id === perspectiveId ||
          winnerTeam.player2_id === perspectiveId);
      if (iWon) {
        celebrate();
        winPulse();
      } else {
        tap();
      }
      if (rivalry) {
        toast.success(`🔥 ${rivalryHeadline(rivalry, rivalWinner, nameOf)}`);
      } else {
        toast.success("Resultaat opgeslagen.");
      }
      onSaved?.();
    } catch (err) {
      setSaved(null); // terugdraaien; de kaart is weer invulbaar
      toast.error(errorMessage(err));
    }
  }

  async function saveTime() {
    setBusyTime(true);
    try {
      await updatePlannedMatchTime({
        matchId: m.id,
        playedAt: timeVal ? new Date(timeVal).toISOString() : null,
      });
      tap();
      toast.success("Tijdstip bijgewerkt.");
      setEditingTime(false);
      onSaved?.();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusyTime(false);
    }
  }

  function startDelete() {
    setPendingDelete(true);
    deleteTimer.current = setTimeout(async () => {
      try {
        await deleteMatch(m.id);
        tap();
        (onDeleted ?? onSaved)?.();
      } catch (err) {
        setPendingDelete(false); // terug tevoorschijn; niets verwijderd
        toast.error(errorMessage(err));
      }
    }, UNDO_MS);
  }

  function undoDelete() {
    if (deleteTimer.current) clearTimeout(deleteTimer.current);
    deleteTimer.current = null;
    setPendingDelete(false);
  }

  // Undo-strook zolang de verwijdering nog kan worden teruggedraaid.
  if (pendingDelete) {
    return (
      <div className="planned-card__undo" role="status">
        <span>Match verwijderd.</span>
        <button className="btn btn--sm" onClick={undoDelete}>
          Ongedaan maken
        </button>
      </div>
    );
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
            {saved.rivalryLine ? ` · 🔥 ${saved.rivalryLine}` : ""}
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

      {rivalry && (
        <p className="planned-card__rivalry">
          🔥 Onderling: {nameOf(rivalry.a)}{" "}
          <strong>
            {rivalry.winsA}–{rivalry.winsB}
          </strong>{" "}
          {nameOf(rivalry.b)}
          {rivalry.draws > 0 ? ` (${rivalry.draws} gelijk)` : ""}
        </p>
      )}

      <div className="planned-card__sets">
        <button
          type="button"
          className="planned-card__sets-toggle"
          aria-expanded={showSets}
          onClick={() => setShowSets((s) => !s)}
        >
          {showSets ? "− Sets verbergen" : "+ Sets per set invoeren (optioneel)"}
        </button>
        {showSets && (
          <div className="mt-4">
            <SetScoresInput
              sets={sets}
              onChange={setSets}
              labelA={teamLabel(teams[m.team_a_id], profiles)}
              labelB={teamLabel(teams[m.team_b_id], profiles)}
            />
          </div>
        )}
      </div>

      {canManage && editingTime && (
        <div className="planned-card__time">
          <input
            className="input"
            type="datetime-local"
            value={timeVal}
            onChange={(e) => setTimeVal(e.target.value)}
            aria-label="Nieuw tijdstip"
          />
          <button
            className="btn btn--sm"
            onClick={() => setEditingTime(false)}
            disabled={busyTime}
          >
            Annuleren
          </button>
          <button
            className="btn btn--primary btn--sm"
            onClick={saveTime}
            disabled={busyTime}
          >
            {busyTime ? "Opslaan…" : "Tijd opslaan"}
          </button>
        </div>
      )}

      <div className="planned-card__foot planned-card__actions">
        <span className="match-card__meta">
          {m.round_number != null ? `ronde ${m.round_number} · gepland` : "gepland"}
        </span>
        <MatchCalendarButton match={m} teams={teams} profiles={profiles} />
        {canManage && (
          <button
            className="btn btn--sm"
            onClick={() => setEditingTime((t) => !t)}
          >
            Tijd wijzigen
          </button>
        )}
        {canManage && (
          <button className="btn btn--sm btn--danger" onClick={startDelete}>
            Verwijderen
          </button>
        )}
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
