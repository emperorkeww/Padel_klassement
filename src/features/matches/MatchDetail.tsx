import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthProvider";
import { useAsync } from "@/lib/hooks/useAsync";
import { useToast } from "@/ui/ToastProvider";
import {
  emptySet,
  getMatch,
  getTeamsByIds,
  readSetScores,
  teamLabel,
  toSetScores,
  updateMatchScore,
  type SetPair,
} from "./api";
import { SetScoresInput } from "@/features/matches/components/SetScoresInput";
import { PlannedMatchCard } from "@/features/matches/components/PlannedMatchCard";
import { getMatchPredictions } from "./predictionsApi";
import { getGroup } from "@/features/groups/api";
import { getProfilesByIds, displayName } from "@/features/profiles/api";
import { formatDate } from "@/lib/utils/format";
import { tap } from "@/lib/utils/haptics";
import { Avatar } from "@/ui/Avatar";
import { Skeleton } from "@/ui/Skeleton";
import { ScoreStepper } from "@/ui/ScoreStepper";
import { ShareMatch } from "@/features/matches/components/ShareMatch";
import { SmoesjesMachine } from "@/features/matches/components/SmoesjesMachine";
import { outcomeFor } from "@/features/rating/results";
import { roastCtx } from "@/features/coach/roastTone";
import { errorMessage } from "@/lib/utils/errors";
import { getAllRatingHistories } from "@/features/standings/ratingsApi";
import { matchUpset, preMatchPoints } from "@/features/matches/upset";
import { playersOf } from "@/features/rating/results";
import { TierBadge } from "@/features/rating/components/TierBadge";
import { tierChange } from "@/features/rating/tiers";
import { scoreHighlight } from "@/features/feed/feedLogic";
import type { Match, Profile, Team, RatingPoint } from "@/types";
import "./MatchDetail.css";

export function MatchDetail() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const match = useAsync(() => getMatch(id), [id]);
  // Alleen de twee teams en vier spelers van déze match ophalen, niet de
  // volledige teams- en profielentabellen.
  const teamIds = match.data ? [match.data.team_a_id, match.data.team_b_id] : [];
  const teamKey = teamIds.join(",");
  const teams = useAsync(() => getTeamsByIds(teamIds), [teamKey]);
  const playerIds = teamIds.flatMap((tid) => playersOf(teams.data?.[tid]));
  const playerKey = playerIds.join(",");
  const profiles = useAsync(() => getProfilesByIds(playerIds), [playerKey]);
  // Rating-historie (gecacht, app-breed gedeeld) om de pre-match winkans en dus
  // een eventuele upset te bepalen (#85).
  const histories = useAsync(getAllRatingHistories, []);
  // Groepstoon (roast-intensiteit) voor Coach Rudy's stem in de smoesjesmachine.
  const groupId = match.data?.group_id ?? null;
  const group = useAsync(
    () => (groupId ? getGroup(groupId) : Promise.resolve(null)),
    [groupId],
  );
  const [editing, setEditing] = useState(false);

  if (match.loading)
    return (
      // Speelt het scorebord na: twee teamvakken met de score in het midden.
      <div className="card md-board" aria-hidden="true">
        <div className="md-hero">
          <div className="md-meta">
            <span className="sk sk--pill" />
            <span className="sk sk--pill" />
          </div>
          <div className="md-versus">
            <div className="md-team">
              <Skeleton rows={2} />
            </div>
            <div className="md-score">
              <span className="sk sk--line" style={{ width: 72, height: 36 }} />
            </div>
            <div className="md-team">
              <Skeleton rows={2} />
            </div>
          </div>
        </div>
      </div>
    );
  if (!match.data) return <p className="msg msg--error">Match niet gevonden.</p>;

  const m = match.data;
  const tmap = teams.data ?? {};
  const pmap = profiles.data ?? {};
  const teamA = tmap[m.team_a_id];
  const teamB = tmap[m.team_b_id];
  const done = m.status === "completed";
  const aWon = m.winner_team_id === m.team_a_id;
  const bWon = m.winner_team_id === m.team_b_id;
  const isDraw = done && m.winner_team_id === null;
  // Upset: won de underdog? (winkans vooraf < 35%, uit de echte pre-match ratings)
  const upset =
    done && !isDraw
      ? matchUpset(m, tmap, preMatchPoints(histories.data ?? {}, m.id))
      : null;
  const scoreHi = done ? scoreHighlight(m) : null;
  // Verloor de kijker deze match? → de smoesjesmachine mag verschijnen.
  const iLost = !!user && outcomeFor(m, tmap, user.id) === "L";
  // Enkel de aanmaker kan de score corrigeren (RLS dwingt dit ook af).
  const canEdit = done && !!user && m.created_by === user.id;
  // Per-set uitslag (optioneel), als paren zodat elke set zijn winnaar kan tonen.
  const setPairs = readSetScores(m);
  // Geplande match: dezelfde inline invoer als op de kaart, mits je meedoet of
  // hem hebt aangemaakt (de server dwingt de rechten sowieso af).
  const amParticipant =
    !!user &&
    [teamA, teamB].some(
      (t) => t && (t.player1_id === user.id || t.player2_id === user.id),
    );
  const showPlanned =
    !done && (amParticipant || (!!user && m.created_by === user.id));

  return (
    <div>
      <header className="page-head">
        {/* Het scorebord ís de kop; voor screenreaders en de outline toch een h1. */}
        <h1 className="sr-only">Matchdetail</h1>
        <div className="row-between">
          <button className="btn btn--sm" onClick={() => navigate(-1)}>
            ← Terug
          </button>
          {done && <ShareMatch match={m} teams={tmap} profiles={pmap} />}
        </div>
      </header>

      <section className="card md-board">
        <div className="md-hero">
          {/* Kalme metaregel: status · datum · ronde · groep. */}
          <div className="md-meta">
            <span className={`md-meta__status ${done ? "" : "is-open"}`}>
              {done ? "Afgerond" : "Gepland"}
            </span>
            <span className="md-meta__sep" aria-hidden="true">
              ·
            </span>
            <span>{formatDate(m.played_at ?? m.created_at) || "—"}</span>
            {m.round_number != null && (
              <>
                <span className="md-meta__sep" aria-hidden="true">
                  ·
                </span>
                <span>Ronde {m.round_number}</span>
              </>
            )}
            <GroupBadge groupId={m.group_id} />
          </div>

          <div className="md-versus">
            <TeamBlock
              team={teamA}
              side="a"
              label={teamLabel(teamA, pmap)}
              profiles={pmap}
              won={done && aWon}
              histories={histories.data ?? undefined}
              matchId={m.id}
            />
            <div className="md-score">
              {m.score_a != null && m.score_b != null ? (
                <span className="md-score__num">
                  {/* Het winnende cijfer kleurt mee: wie won zie je in de score zelf. */}
                  <span className={done && aWon ? "is-winside" : ""}>{m.score_a}</span>
                  <span className="md-score__dash">–</span>
                  <span className={done && bWon ? "is-winside" : ""}>{m.score_b}</span>
                </span>
              ) : (
                <span className="md-score__vs">vs</span>
              )}
              {done && !isDraw && m.score_a != null && m.score_b != null && (
                <span className="md-score__note">eindstand</span>
              )}
            </div>
            <TeamBlock
              team={teamB}
              side="b"
              label={teamLabel(teamB, pmap)}
              profiles={pmap}
              won={done && bWon}
              histories={histories.data ?? undefined}
              matchId={m.id}
            />
          </div>

          {/* Bijzondere momenten apart van de metaregel, zodat ze echt opvallen. */}
          {(isDraw || upset || scoreHi) && (
            <div className="md-moments">
              {isDraw && <span className="md-moment md-moment--draw">Gelijkspel</span>}
              {upset && (
                <span
                  className="md-moment"
                  title="De underdog won: winkans vooraf lager dan 35%."
                >
                  🎯 Upset · {Math.round(upset.chance * 100)}% kans
                </span>
              )}
              {scoreHi && scoreHi.type === "score" && (
                <span className="md-moment">
                  {scoreHi.label === "bagel"
                    ? "🥯 6-0 Droog"
                    : scoreHi.label === "monsterzege"
                      ? "🦖 Monsterzege"
                      : "😬 Nagelbijter"}
                </span>
              )}
            </div>
          )}

          {setPairs && (
            <div className="md-sets">
              <span className="md-sets__label">Sets</span>
              {setPairs.map(([a, b], i) => (
                <span key={i} className="md-sets__chip">
                  <span className={a > b ? "is-winside" : ""}>{a}</span>-
                  <span className={b > a ? "is-winside" : ""}>{b}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        {canEdit && (
          <div className="md-board__foot">
            {!editing && (
              <div className="md-edit-actions">
                <button className="btn btn--sm" onClick={() => setEditing(true)}>
                  {m.score_a != null ? "Score aanpassen" : "Score invoeren"}
                </button>
              </div>
            )}
            {editing && (
              <ScoreEditor
                match={m}
                labelA={teamLabel(teamA, pmap)}
                labelB={teamLabel(teamB, pmap)}
                onClose={() => setEditing(false)}
                onSaved={() => {
                  setEditing(false);
                  match.reload();
                }}
              />
            )}
          </div>
        )}
      </section>

      {iLost && (
        <SmoesjesMachine
          matchId={m.id}
          ctx={roastCtx(group.data, user ? pmap[user.id] : null)}
          groupId={m.group_id}
          playerId={user?.id}
        />
      )}

      {m.group_id != null && (
        <TotoSection match={m} teams={tmap} teamProfiles={pmap} />
      )}

      {showPlanned && (
        <section className="card">
          <div className="card__head">
            <h2 className="card__title">Uitslag invullen</h2>
          </div>
          {/* Dezelfde inline invoer als bij "Te spelen": score/sets opslaan,
              agenda, tijd wijzigen en verwijderen. Rechten worden serverzijdig
              afgedwongen. Na verwijderen navigeren we terug. */}
          <PlannedMatchCard
            match={m}
            teams={tmap}
            profiles={pmap}
            perspectiveId={user?.id}
            onSaved={() => match.reload()}
            onDeleted={() => navigate(-1)}
          />
        </section>
      )}
    </div>
  );
}

/**
 * Toto (#116): wie tipte welk team, en na de uitslag wie er juist zat en
 * hoeveel punten dat opleverde. Verbergt zichzelf zolang er geen tips zijn.
 */
function TotoSection({
  match: m,
  teams,
  teamProfiles,
}: {
  match: Match;
  teams: Record<string, Team>;
  /** Profielen van de vier spelers (voor de teamlabels). */
  teamProfiles: Record<string, Profile>;
}) {
  const predictions = useAsync(() => getMatchPredictions(m.id), [m.id]);
  const preds = predictions.data ?? [];
  // Tippers kunnen ook groepsleden buiten de match zijn: hun profielen apart.
  const tipperIds = preds.map((p) => p.player_id);
  const tipperKey = tipperIds.join(",");
  const tippers = useAsync(() => getProfilesByIds(tipperIds), [tipperKey]);
  if (preds.length === 0) return null;

  const pmap = tippers.data ?? {};
  const done = m.status === "completed";
  const isDraw = done && m.winner_team_id === null;
  // Juiste tips (meeste punten) bovenaan; daarna op naam.
  const sorted = [...preds].sort(
    (a, b) =>
      (b.points ?? -1) - (a.points ?? -1) ||
      displayName(pmap[a.player_id]).localeCompare(displayName(pmap[b.player_id])),
  );

  return (
    <section className="card">
      <div className="card__head">
        <h2 className="card__title">🎯 Toto</h2>
      </div>
      {isDraw && (
        <p className="md-toto__note">Gelijkspel — niemand krijgt punten.</p>
      )}
      <ul className="md-toto">
        {sorted.map((p) => {
          const profile = pmap[p.player_id];
          const correct = p.points != null && p.points > 0;
          return (
            <li key={p.player_id} className="md-toto__row">
              <Avatar profile={profile} size={24} />
              {profile ? (
                <Link className="profile-link" to={`/spelers/${p.player_id}`}>
                  {displayName(profile)}
                </Link>
              ) : (
                <span>Onbekend</span>
              )}
              <span className="md-toto__pick">
                tipte {teamLabel(teams[p.predicted_team_id], teamProfiles)}
              </span>
              {p.points != null && (
                <span className={`badge ${correct ? "badge--win" : ""}`}>
                  {correct ? `juist · +${p.points} pt` : "mis · 0 pt"}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {!done && (
        <p className="md-toto__note">
          Tippen kan tot de starttijd; punten volgen na de uitslag.
        </p>
      )}
    </section>
  );
}

/** Inline correctie van de eindscore; de winnaar volgt automatisch uit de score. */
function ScoreEditor({
  match,
  labelA,
  labelB,
  onClose,
  onSaved,
}: {
  match: Match;
  labelA: string;
  labelB: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [sa, setSa] = useState(match.score_a != null ? String(match.score_a) : "");
  const [sb, setSb] = useState(match.score_b != null ? String(match.score_b) : "");
  // Sets zijn hier óók te corrigeren — zelfde invoer als bij het loggen
  // (#106: één uitslag-patroon), voorgevuld met de bestaande set-stand.
  const [sets, setSets] = useState<SetPair[]>(() => {
    const existing = readSetScores(match);
    return existing && existing.length > 0
      ? existing.map(([a, b]) => ({ a: String(a), b: String(b) }))
      : [emptySet()];
  });
  const [busy, setBusy] = useState(false);

  const saNum = sa === "" ? null : Number(sa);
  const sbNum = sb === "" ? null : Number(sb);
  const valid =
    saNum !== null && sbNum !== null && saNum >= 0 && sbNum >= 0;
  const preview =
    valid
      ? saNum === sbNum
        ? "Gelijkspel — beide teams krijgen 1 punt."
        : `${saNum > sbNum ? labelA : labelB} wint.`
      : null;

  async function save() {
    if (!valid) return toast.error("Vul beide scores in (0 of hoger).");
    setBusy(true);
    try {
      const setScores = toSetScores(sets);
      await updateMatchScore({
        matchId: match.id,
        winnerTeamId:
          saNum === sbNum
            ? null
            : saNum! > sbNum!
              ? match.team_a_id
              : match.team_b_id,
        scoreA: saNum!,
        scoreB: sbNum!,
        // Alle set-rijen leeg = sets bewust wissen; anders de nieuwe stand.
        setScores: setScores.length > 0 ? setScores : null,
      });
      tap();
      toast.success("Score bijgewerkt.");
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="md-editor">
      <div className="md-editor__inputs">
        {/* Geen <label>-wrapper: die zou kliks naar de eerste stepper-knop
            sturen; het aria-label op het veld dekt de toegankelijkheid. */}
        <div className="md-editor__field">
          <span>{labelA}</span>
          <ScoreStepper value={sa} onChange={setSa} label={`Score ${labelA}`} />
        </div>
        <span className="md-editor__dash">–</span>
        <div className="md-editor__field">
          <span>{labelB}</span>
          <ScoreStepper value={sb} onChange={setSb} label={`Score ${labelB}`} />
        </div>
      </div>
      {preview && <p className="md-editor__preview">{preview}</p>}
      <SetScoresInput
        sets={sets}
        onChange={setSets}
        labelA={labelA}
        labelB={labelB}
      />
      <div className="md-editor__buttons">
        <button className="btn btn--sm" onClick={onClose} disabled={busy}>
          Annuleren
        </button>
        <button
          className="btn btn--primary btn--sm"
          onClick={save}
          disabled={busy || !valid}
        >
          {busy ? "Opslaan…" : "Opslaan"}
        </button>
      </div>
    </div>
  );
}

function TeamBlock({
  team,
  side,
  label,
  profiles,
  won,
  histories,
  matchId,
}: {
  team: Team | undefined;
  /** Kant van het bord: A kleurt smaragd, B lime (zoals bij teams kiezen). */
  side: "a" | "b";
  label: string;
  profiles: Record<string, Profile>;
  won: boolean;
  histories: Record<string, RatingPoint[]> | undefined;
  matchId: string;
}) {
  // Singles (1v1) toont één speler; "Onbekend" blijft enkel voor spelers
  // van wie het profiel (nog) niet geladen is.
  const players = playersOf(team).map((pid) => profiles[pid]);
  return (
    <div className={`md-team md-team--${side} ${won ? "is-win" : ""}`}>
      <div className="md-team__name">
        {label}
        {won && <span className="badge badge--win">Winnaar</span>}
      </div>
      <ul className="md-team__players">
        {players.map((p, i) => {
          if (!p) return <li key={i}>Onbekend</li>;
          const playerHistory = histories?.[p.id];
          const point = playerHistory?.find((h) => h.match_id === matchId);
          const delta = point?.delta;
          const ratingAfter = point?.rating_after;
          const ratingBefore = point?.rating_before;
          const wissel = tierChange(ratingBefore ?? null, ratingAfter ?? null);

          return (
            <li key={p.id} className="md-player">
              <div className="md-player__identity">
                <Avatar profile={p} size={24} />
                <Link className="profile-link" to={`/spelers/${p.id}`}>
                  {displayName(p)}
                </Link>
              </div>
              {point && (
                <div className="md-player__stats">
                  <span className="md-player__rating">{ratingAfter} ELO</span>
                  {delta != null && delta !== 0 && (
                    <span className={`stat__delta ${delta > 0 ? "is-up" : "is-down"}`}>
                      {delta > 0 ? "▲" : "▼"}{Math.abs(delta)}
                    </span>
                  )}
                  <TierBadge rating={ratingAfter ?? null} size="sm" />
                  {wissel && (
                    <span className={`badge ${wissel.richting === "promotie" ? "badge--win" : "badge--danger"}`}>
                      {wissel.richting === "promotie" ? "⬆️ Promotie" : "⬇️ Degradatie"}
                    </span>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function GroupBadge({ groupId }: { groupId: string | null }) {
  const group = useAsync(() => (groupId ? getGroup(groupId) : Promise.resolve(null)), [
    groupId,
  ]);
  if (!groupId) return null;
  // Klikbaar: de badge is meteen de weg terug naar de groep (en zijn stand).
  return (
    <Link className="badge badge--link" to={`/groepen/${groupId}`}>
      {group.data?.name ?? "Groep"} →
    </Link>
  );
}

export default MatchDetail;