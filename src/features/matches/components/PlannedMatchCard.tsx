import { useEffect, useMemo, useRef, useState } from "react";
import { ScoreStepper } from "@/ui/ScoreStepper";
import { Sheet } from "@/ui/Sheet";
import { useToast } from "@/ui/ToastProvider";
import { useAsync } from "@/lib/hooks/useAsync";
import { errorMessage } from "@/lib/utils/errors";
import { celebrate } from "@/lib/utils/confetti";
import { tap, winPulse } from "@/lib/utils/haptics";
import { winChance } from "@/features/rating/elo";
import { inTeam } from "@/features/rating/results";
import { CoachAvatar } from "@/features/coach/components/CoachAvatar";
import { coachPreMatch } from "@/features/coach/coachMoments";
import { verliesreeksTegen } from "@/features/coach/coachStats";
import {
  groupRivalries,
  rivalryForMatch,
  rivalryHeadline,
  standAfter,
} from "@/features/groups/rivalry";
import { getPlayerRatings } from "@/features/standings/ratingsApi";
import { displayName } from "@/features/profiles/api";
import { useAuth } from "@/features/auth/AuthProvider";
import { predictionPoints } from "@/features/matches/predictions";
import {
  clearPrediction,
  getMatchPredictions,
  setPrediction,
} from "@/features/matches/predictionsApi";
import type { Match, Profile, RoastIntensiteit, Team } from "@/types";
import {
  deleteMatch,
  emptySet,
  setMatchResult,
  teamLabel,
  toSetScores,
  updatePlannedMatchTime,
  type SetPair,
} from "@/features/matches/api";
import { serveerTeam } from "@/features/matches/serve";
import { LefTipBlock } from "@/features/matches/components/LefTipBlock";
import { MatchCalendarButton } from "@/features/matches/components/MatchCalendarButton";
import { SetScoresInput } from "@/features/matches/components/SetScoresInput";
import { TeamSide } from "@/features/matches/components/MatchList";
import "./PlannedMatchCard.css";

const UNDO_MS = 6000;

/** ISO-tijdstip -> waarde voor een <input type="datetime-local"> ("" = geen). */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Geplande match als kaart met inline score-invoer. Opbouw (#362): de
 *  team-rijen met steppers zijn de primaire actie, daaronder de sets-toggle,
 *  dan een rustige contextgroep (coach + rivaliteit), een inklapbare
 *  toto-samenvatting en een slanke voettekst (meta · agenda · ⋯ · Opslaan);
 *  beheeracties (tijd wijzigen, verwijderen) zitten achter de ⋯-sheet.
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
  intensiteit = "gemeen",
  onSaved,
  onDeleted,
}: {
  match: Match;
  teams: Record<string, Team>;
  profiles: Record<string, Profile>;
  /** Speler vanuit wiens oogpunt gevierd wordt (confetti bij eigen winst). */
  perspectiveId?: string;
  /** Roast-toon van de groep van deze match (#183), voor Coach Rudy's pre-match
   *  hype. Buiten groepscontext valt hij op `gemeen`. */
  intensiteit?: RoastIntensiteit;
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

  // Toto ingeklapt tot een samenvattingsregel (#362) — zelfde patroon als de
  // sets-toggle. Beheeracties (tijd/verwijderen) zitten achter de ⋯-sheet.
  const [totoOpen, setTotoOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);

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

  // Toto (#116): tips op deze match. Alleen groepsmatches zijn tipbaar; de
  // guard-trigger dwingt dat ook serverside af.
  const { user } = useAuth();
  const myId = user?.id ?? null;
  // Coach Rudy's pre-match hype (#213): kansinschatting vanuit jóuw team.
  const mijnTeam =
    myId && inTeam(teams[m.team_a_id], myId)
      ? "a"
      : myId && inTeam(teams[m.team_b_id], myId)
        ? "b"
        : null;
  const mijnKans =
    chance == null || mijnTeam == null
      ? null
      : mijnTeam === "a"
        ? chance
        : 1 - chance;
  // Head-to-head tegen de tegenstander (#581): leid het uit de al berekende
  // `rivalry` af, mits ík in het rivaliteitspaar zit; anders geen H2H-hook.
  const preH2H =
    rivalry && myId && (myId === rivalry.a || myId === rivalry.b)
      ? {
          rivaal: displayName(
            profiles[myId === rivalry.a ? rivalry.b : rivalry.a],
          ),
          mijnWins: myId === rivalry.a ? rivalry.winsA : rivalry.winsB,
          oppWins: myId === rivalry.a ? rivalry.winsB : rivalry.winsA,
          verliesreeks: verliesreeksTegen(
            history ?? [],
            teams,
            myId,
            myId === rivalry.a ? rivalry.b : rivalry.a,
            m,
          ),
        }
      : null;
  const coachPre =
    mijnKans != null && myId
      ? coachPreMatch(
          mijnKans,
          `${m.id}-${myId}`,
          {
            intensiteit,
            schild: profiles[myId]?.roast_schild ?? false,
          },
          preH2H,
        )
      : null;
  // Eerste opslag (#435): alleen relevant zolang de match nog gespeeld moet
  // worden; na afronding verdwijnt de chip.
  const serveKant = m.status === "scheduled" ? serveerTeam(m) : null;

  const isGroupMatch = m.group_id != null;
  const predictions = useAsync(
    () => (isGroupMatch ? getMatchPredictions(m.id) : Promise.resolve([])),
    [m.id, isGroupMatch],
  );
  const preds = predictions.data ?? [];
  const myPrediction = myId
    ? (preds.find((p) => p.player_id === myId) ?? null)
    : null;
  const tippingOpen =
    isGroupMatch &&
    m.status === "scheduled" &&
    (!m.played_at || new Date(m.played_at).getTime() > Date.now());
  const showTips = isGroupMatch && !!myId && (tippingOpen || preds.length > 0);
  const [busyTip, setBusyTip] = useState(false);

  // Samenvatting voor de ingeklapte toto-regel: eigen tip > uitnodiging >
  // gesloten (met teller zodra de tips geladen zijn — geen "0 tips"-flits).
  const mijnTipLabel = myPrediction
    ? teamLabel(teams[myPrediction.predicted_team_id], profiles)
    : null;
  const totoSummary = tippingOpen
    ? mijnTipLabel
      ? `jouw tip: ${mijnTipLabel}`
      : "Tip de winnaar"
    : mijnTipLabel
      ? `tippen gesloten · jouw tip: ${mijnTipLabel}`
      : predictions.data == null
        ? "tippen gesloten"
        : `tippen gesloten · ${preds.length} ${preds.length === 1 ? "tip" : "tips"}`;

  async function tip(teamId: string) {
    if (!myId || !m.group_id || busyTip || !tippingOpen) return;
    setBusyTip(true);
    try {
      if (myPrediction?.predicted_team_id === teamId) {
        await clearPrediction(m.id, myId);
        toast.success("Tip ingetrokken.");
      } else {
        await setPrediction({
          matchId: m.id,
          groupId: m.group_id,
          playerId: myId,
          predictedTeamId: teamId,
        });
        toast.success(`Tip geplaatst op ${teamLabel(teams[teamId], profiles)}.`);
      }
      tap();
      predictions.reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusyTip(false);
    }
  }

  /** Chip-gegevens per team: tippers, of het mijn tip is en de te winnen
   *  punten volgens de huidige winkans (de server bevriest de definitieve). */
  function tipChipFor(teamId: string, teamChance: number | null) {
    const tippers = preds.filter((p) => p.predicted_team_id === teamId);
    return {
      teamId,
      mine: myPrediction?.predicted_team_id === teamId,
      count: tippers.length,
      names: tippers.map((p) => displayName(profiles[p.player_id])),
      pts: teamChance != null ? predictionPoints(teamChance) : null,
    };
  }

  const saNum = sa === "" ? null : Number(sa);
  const sbNum = sb === "" ? null : Number(sb);
  const valid = saNum !== null && sbNum !== null && saNum >= 0 && sbNum >= 0;
  // Alleen de aanmaker mag verplaatsen/verwijderen (de server dwingt dit ook af);
  // toon die knoppen dus niet aan anderen om een voorspelbare fout te vermijden.
  const canManage = !!perspectiveId && m.created_by === perspectiveId;
  // De uitslag invullen mag door de aanmaker én de spelers zelf (RLS #413);
  // verberg de score-invoer voor anderen, die zouden op de server stuklopen.
  // Op basis van de ingelogde gebruiker (myId), niet perspectiveId: op een
  // profielpagina is dat de profieleigenaar, niet de kijker.
  const canScore =
    !!myId &&
    (m.created_by === myId ||
      [teams[m.team_a_id], teams[m.team_b_id]].some(
        (t) => t && (t.player1_id === myId || t.player2_id === myId),
      ));

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
        <TeamSide
          team={teams[m.team_a_id]}
          profiles={profiles}
          won={false}
          ratings={ratings.data ?? undefined}
        />
        {serveKant === "a" && (
          <ServeChip teamName={teamLabel(teams[m.team_a_id], profiles)} />
        )}
        {pctA != null && (
          <WinChip
            pct={pctA}
            favorite={pctA >= 50}
            teamName={teamLabel(teams[m.team_a_id], profiles)}
          />
        )}
        {canScore && (
          <ScoreStepper
            value={sa}
            onChange={setSa}
            label={`Score ${teamLabel(teams[m.team_a_id], profiles)}`}
          />
        )}
      </div>

      <div className="planned-card__row">
        <TeamSide
          team={teams[m.team_b_id]}
          profiles={profiles}
          won={false}
          ratings={ratings.data ?? undefined}
        />
        {serveKant === "b" && (
          <ServeChip teamName={teamLabel(teams[m.team_b_id], profiles)} />
        )}
        {pctA != null && (
          <WinChip
            pct={100 - pctA}
            favorite={100 - pctA >= 50}
            teamName={teamLabel(teams[m.team_b_id], profiles)}
          />
        )}
        {canScore && (
          <ScoreStepper
            value={sb}
            onChange={setSb}
            label={`Score ${teamLabel(teams[m.team_b_id], profiles)}`}
          />
        )}
      </div>

      {/* Sets horen bij de score-invoer: direct onder de team-rijen. */}
      {canScore && (
        <div className="planned-card__sets">
          <button
            type="button"
            className="planned-card__sets-toggle"
            aria-expanded={showSets}
            onClick={() => setShowSets((s) => !s)}
          >
            {showSets
              ? "− Sets verbergen"
              : "+ Sets per set invoeren (optioneel)"}
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
      )}

      {/* Coach en rivaliteit gegroepeerd als rustig tussenblok. */}
      {(coachPre || rivalry) && (
        <div className="planned-card__context">
          {coachPre && (
            <p className="planned-card__coach" role="note">
              <CoachAvatar size={24} className="planned-card__coach-face" />
              <span>{coachPre}</span>
            </p>
          )}
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
        </div>
      )}

      {/* Toto ingeklapt tot één regel; klapt uit naar de tip-opties. */}
      {showTips && (
        <div className="toto">
          <button
            type="button"
            className="toto__summary"
            aria-expanded={totoOpen}
            onClick={() => setTotoOpen((o) => !o)}
          >
            <span className="toto__title">🎯 Toto</span>
            <span className="toto__state">{totoSummary}</span>
            <span className="toto__chevron" aria-hidden="true">
              ▾
            </span>
          </button>
          {totoOpen && (
            <div className="toto__body">
              <div className="toto__options">
                <TipOption
                  {...tipChipFor(m.team_a_id, chance)}
                  teamName={teamLabel(teams[m.team_a_id], profiles)}
                  pct={pctA}
                  disabled={!tippingOpen || busyTip}
                  onClick={() => tip(m.team_a_id)}
                />
                <TipOption
                  {...tipChipFor(m.team_b_id, chance != null ? 1 - chance : null)}
                  teamName={teamLabel(teams[m.team_b_id], profiles)}
                  pct={pctA != null ? 100 - pctA : null}
                  disabled={!tippingOpen || busyTip}
                  onClick={() => tip(m.team_b_id)}
                />
              </div>
              {tippingOpen && (
                <p className="toto__legend">
                  {myPrediction
                    ? "Je kunt je tip nog wijzigen tot de starttijd."
                    : "Kies wie er wint. Hoe kleiner de winkans van je team, hoe meer punten een juiste tip oplevert (+1 tot +4). Tippen kan tot de starttijd."}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Lef-tip (#804): dubbel-of-niets voor de spelers zelf, naast de toto
          voor de toeschouwers. */}
      <LefTipBlock
        match={m}
        profiles={profiles}
        myId={myId}
        isDeelnemer={mijnTeam != null}
        mijnKans={mijnKans}
        games={(myId && ratings.data?.[myId]?.games) || 0}
      />

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
            type="button"
            className="btn btn--sm planned-card__more"
            aria-label="Meer acties"
            aria-haspopup="dialog"
            onClick={() => setManageOpen(true)}
          >
            ⋯
          </button>
        )}
        {canScore && (
          <button
            className="btn btn--primary btn--sm planned-card__save"
            disabled={!valid}
            onClick={save}
          >
            Opslaan
          </button>
        )}
      </div>

      {/* Beheeracties (alleen de aanmaker) in een compacte sheet achter ⋯. */}
      {canManage && (
        <Sheet
          open={manageOpen}
          onClose={() => setManageOpen(false)}
          title="Matchbeheer"
          compact
        >
          <div className="planned-card__manage">
            <button
              className="btn"
              onClick={() => {
                setManageOpen(false);
                setEditingTime(true);
              }}
            >
              Tijd wijzigen
            </button>
            <button
              className="btn btn--danger"
              onClick={() => {
                setManageOpen(false);
                startDelete();
              }}
            >
              Verwijderen
            </button>
          </div>
        </Sheet>
      )}
    </div>
  );
}

/** Risico-etiket bij een winkans: de underdog levert de meeste toto-punten. */
function tipTier(pct: number | null): string | null {
  if (pct == null) return null;
  if (pct >= 60) return "favoriet";
  if (pct <= 40) return "underdog";
  return "fifty-fifty";
}

/** Grote, tapbare tip-keuze per team: teamnaam, de te winnen punten met hun
 *  risico-etiket (favoriet/underdog), en hoeveel groepsleden dit team tippen.
 *  Nogmaals tikken op je eigen keuze trekt de tip in. */
function TipOption({
  teamName,
  mine,
  count,
  names,
  pts,
  pct,
  disabled,
  onClick,
}: {
  teamName: string;
  mine: boolean;
  count: number;
  names: string[];
  pts: number | null;
  pct: number | null;
  disabled: boolean;
  onClick: () => void;
}) {
  const tier = tipTier(pct);
  return (
    <button
      type="button"
      className={`toto-opt ${mine ? "toto-opt--mine" : ""}`}
      disabled={disabled}
      aria-pressed={mine}
      aria-label={`Tip ${teamName}`}
      onClick={onClick}
      title={
        count > 0
          ? `Getipt door ${names.join(", ")}`
          : `Tip ${teamName} als winnaar`
      }
    >
      <span className="toto-opt__top">
        <span className="toto-opt__team">{teamName}</span>
        {mine && <span className="toto-opt__mine-flag">jouw tip ✓</span>}
      </span>
      <span className="toto-opt__reward">
        {pts != null && (
          <span className="toto-opt__pts">
            +{pts}
            <span className="toto-opt__pts-unit"> pt</span>
          </span>
        )}
        {tier && <span className="toto-opt__tier">{tier}</span>}
      </span>
      <span className="toto-opt__count">
        {count > 0 ? `${count}× getipt` : "nog niemand"}
      </span>
    </button>
  );
}

/** Pil die markeert welk team de eerste opslag heeft (#435). Op team-niveau:
 *  het team kiest op de baan zelf wie van de twee serveert. */
function ServeChip({ teamName }: { teamName: string }) {
  return (
    <span
      className="servechip"
      role="img"
      title={`${teamName} begint met opslaan`}
      aria-label={`${teamName} begint met opslaan`}
    >
      <span aria-hidden="true">🎾</span>
      <span className="servechip__label">begint</span>
    </span>
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
