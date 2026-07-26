import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthProvider";
import { useAsync } from "@/lib/hooks/useAsync";
import { useToast } from "@/ui/ToastProvider";
import { useConfirm } from "@/ui/ConfirmDialog";
import {
  emptySet,
  getMatch,
  getPlayerMatches,
  getTeamsByIds,
  readSetScores,
  replaceMatchPlayer,
  setMatchGroup,
  teamLabel,
  toSetScores,
  updateMatchScore,
  type SetPair,
} from "./api";
import { SetScoresInput } from "@/features/matches/components/SetScoresInput";
import { PlannedMatchCard } from "@/features/matches/components/PlannedMatchCard";
import { getMatchPredictions } from "./predictionsApi";
import { getGroup, getGroupMembers, getMyGroups } from "@/features/groups/api";
import { getMyFriendships, categorize, otherId } from "@/features/friends/api";
import { getProfilesByIds, displayName } from "@/features/profiles/api";
import { formatDate } from "@/lib/utils/format";
import { tap } from "@/lib/utils/haptics";
import { Avatar } from "@/ui/Avatar";
import { Skeleton } from "@/ui/Skeleton";
import { ScoreStepper } from "@/ui/ScoreStepper";
import { ShareMatch } from "@/features/matches/components/ShareMatch";
import { SmoesjesMachine } from "@/features/matches/components/SmoesjesMachine";
import { Lineup } from "@/features/matches/components/Lineup";
import { CHEMIE_MATCH_LIMIT } from "@/features/matches/chemistry";
import { outcomeFor } from "@/features/rating/results";
import { roastCtx } from "@/features/coach/roastTone";
import { errorMessage } from "@/lib/utils/errors";
import {
  getRatingHistoriesForMatches,
  getRecentRatingHistories,
  mergeRatingHistories,
  getPlayerRatings,
} from "@/features/standings/ratingsApi";
import { getHuidigeDictator } from "@/features/standings/dictatorApi";
import { getPlayerStandings } from "@/features/standings/api";
import { spelerVanDeWeek } from "@/features/standings/spelerVanDeWeek";
import { getSeizoenskampioen } from "@/features/standings/kampioen";
import { getGlobalePias } from "@/features/standings/piasApi";
import { getGlobaleZwartePiet } from "@/features/groups/zwartePietApi";
import { currentPias } from "@/features/standings/pias";
import { onFireSpelers } from "@/features/standings/onFire";
import { iconKeyVoor, type EditieContext } from "@/features/standings/edities";
import { matchUpset, preMatchPoints } from "@/features/matches/upset";
import { matchDerby } from "@/features/matches/derby";
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
  // Rating-historie (gecacht, app-breed gedeeld) voor de In-Form/On-Fire-editie
  // en de sparkline-achtige cijfers op de kaart.
  const recentHistories = useAsync(getRecentRatingHistories, []);
  // Chemie van de duo's (#427): recente matches van één speler per team — de
  // gezamenlijke duo-matches zijn daar een subset van — plus de huidige
  // ratings als terugval voor de kaart-Elo bij een geplande match.
  const ratings = useAsync(getPlayerRatings, []);
  const spelerA = teams.data?.[match.data?.team_a_id ?? ""]?.player1_id;
  const spelerB = teams.data?.[match.data?.team_b_id ?? ""]?.player1_id;
  const matchesA = useAsync(
    () =>
      spelerA ? getPlayerMatches(spelerA, CHEMIE_MATCH_LIMIT) : Promise.resolve([]),
    [spelerA],
  );
  const matchesB = useAsync(
    () =>
      spelerB ? getPlayerMatches(spelerB, CHEMIE_MATCH_LIMIT) : Promise.resolve([]),
    [spelerB],
  );
  // Voor de pre-match winkans (#85) en de duo-chemie (#427) tellen de échte
  // punten van precies déze matches. Die kunnen ouder zijn dan het gedeelde
  // venster (#731), dus haal ze gericht op en leg ze over de recente historie.
  const puntIds = useMemo(
    () => [
      id,
      ...(matchesA.data ?? []).map((x) => x.id),
      ...(matchesB.data ?? []).map((x) => x.id),
    ],
    [id, matchesA.data, matchesB.data],
  );
  const puntKey = puntIds.join(",");
  const matchHistories = useAsync(
    () => getRatingHistoriesForMatches(puntIds),
    [puntKey],
  );
  const hmap = useMemo(
    () =>
      mergeRatingHistories(recentHistories.data ?? {}, matchHistories.data ?? {}),
    [recentHistories.data, matchHistories.data],
  );

  // Groepstoon (roast-intensiteit) voor Coach Rudy's stem in de smoesjesmachine.
  const groupId = match.data?.group_id ?? null;
  const group = useAsync(
    () => (groupId ? getGroup(groupId) : Promise.resolve(null)),
    [groupId],
  );
  // De Troon (#545): wie is de zittende dictator? Wordt doorgegeven aan Lineup
  // voor consistente tier-weergave (dictator-special alleen voor de troonhouder).
  const dictator = useAsync(getHuidigeDictator, []);
  // Speciale edities (#497) ook op het veld (#621/#625): dezelfde
  // editie-context als klassement en profiel — Icon, Kampioen en In-Form.
  // Alle bronnen gecacht en app-breed gedeeld; hooks vóór de vroege returns.
  const standings = useAsync(getPlayerStandings, []);
  const kampioen = useAsync(getSeizoenskampioen, []);
  // Pias-editie (#631): de globale pias van deze (of anders vorige) week.
  const globalePias = useAsync(getGlobalePias, []);
  // Piet-editie (#645): de globale Zwarte Piet over alle groepen heen.
  const globaleZwartePiet = useAsync(getGlobaleZwartePiet, []);
  const inForm = useMemo(
    () => spelerVanDeWeek(hmap),
    [hmap],
  );
  // On-Fire (#632): actieve winstreaks uit dezelfde gedeelde histories.
  const onFire = useMemo(
    () => onFireSpelers(hmap),
    [hmap],
  );
  const editieCtx: EditieContext = {
    dictatorId: dictator.data?.profileId ?? null,
    iconKey: iconKeyVoor(
      standings.data ?? [],
      ratings.data ?? {},
      dictator.data?.profileId ?? null,
    ),
    kampioen: kampioen.data ?? null,
    inForm,
    onFire,
    pias: currentPias(globalePias.data ?? []),
    piet: globaleZwartePiet.data ?? null,
  };
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
  const prePoints = done ? preMatchPoints(hmap, m.id) : null;
  const upset = done && !isDraw ? matchUpset(m, tmap, prePoints ?? undefined) : null;
  const scoreHi = done ? scoreHighlight(m) : null;
  // Derby (#169): alle spelers in dezelfde hoofddivisie. Afgerond meet aan de
  // pre-match ratings; gepland aan de huidige.
  const derby = matchDerby(m, tmap, (pid) =>
    done
      ? (prePoints?.get(pid)?.rating_before ?? null)
      : (ratings.data?.[pid]?.rating ?? null),
  );
  // Verloor de kijker deze match? → de smoesjesmachine mag verschijnen.
  const iLost = !!user && outcomeFor(m, tmap, user.id) === "L";
  // Enkel de aanmaker kan de score corrigeren (RLS dwingt dit ook af).
  const canEdit = done && !!user && m.created_by === user.id;
  // Per-set uitslag (optioneel), als paren zodat elke set zijn winnaar kan tonen.
  const setPairs = readSetScores(m);
  // Geplande match: dezelfde inline invoer als op de kaart, mits je meedoet of
  // hem hebt aangemaakt — precies de kring die de RLS-policy toestaat (#413).
  const amParticipant =
    !!user &&
    [teamA, teamB].some(
      (t) => t && (t.player1_id === user.id || t.player2_id === user.id),
    );
  const showPlanned =
    !done && (amParticipant || (!!user && m.created_by === user.id));
  // Gasten in deze match (#681). Alleen als er één is heeft de vervang-sectie
  // zin — zo betaalt een gewone match niet voor de extra queries daarin.
  const gastenInMatch = [teamA, teamB]
    .flatMap((t) => playersOf(t))
    .filter((pid) => pmap[pid]?.is_guest);

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
            {m.format === "1v1" && (
              <>
                <span className="md-meta__sep" aria-hidden="true">
                  ·
                </span>
                <span title="Singles">1v1</span>
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
              histories={hmap}
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
              histories={hmap}
              matchId={m.id}
            />
          </div>

          {/* Bijzondere momenten apart van de metaregel, zodat ze echt opvallen. */}
          {(isDraw || upset || scoreHi || derby) && (
            <div className="md-moments">
              {isDraw && <span className="md-moment md-moment--draw">Gelijkspel</span>}
              {derby && (
                <span
                  className="md-moment"
                  title={`Alle spelers zitten in dezelfde divisie (${derby.naam}) — hier staat divisie-eer op het spel.`}
                >
                  🏟️ Derby · {derby.emoji} {derby.naam}
                </span>
              )}
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

      <Lineup
        match={m}
        teams={tmap}
        profiles={pmap}
        histories={hmap}
        ratings={ratings.data ?? {}}
        matchesA={matchesA.data ?? []}
        matchesB={matchesB.data ?? []}
        edities={editieCtx}
      />

      {/* #648: losse match achteraf aan een groep koppelen (of verhangen/
          loskoppelen). key reset de lokale select-state na een geslaagde
          wijziging, wanneer de match herlaadt met de nieuwe group_id. */}
      {user && (
        <GroupLinkSection
          key={m.group_id ?? "los"}
          match={m}
          onSaved={() => match.reload()}
        />
      )}

      {done && user && gastenInMatch.length > 0 && (
        <GuestSwapSection
          match={m}
          guestIds={gastenInMatch}
          matchPlayerIds={playerIds}
          profiles={pmap}
          myId={user.id}
          onSaved={() => match.reload()}
        />
      )}

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
 * Gast vervangen (#681): één gastprofiel wordt in de praktijk soms voor
 * verschillende personen hergebruikt ("Gast 1"), en soms blijkt achteraf dat de
 * gast een speler mét account was. Hier corrigeer je per match wie er écht
 * speelde. Zichtbaar voor wie de match aanmaakte of de groep bezit — dezelfde
 * kring die replace_match_player afdwingt.
 *
 * De parent rendert dit alleen bij een afgeronde match mét gast, zodat een
 * gewone match niet voor de queries hieronder betaalt.
 */
function GuestSwapSection({
  match: m,
  guestIds,
  matchPlayerIds,
  profiles,
  myId,
  onSaved,
}: {
  match: Match;
  guestIds: string[];
  matchPlayerIds: string[];
  profiles: Record<string, Profile>;
  myId: string;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [confirm, confirmUi] = useConfirm();
  const [gastId, setGastId] = useState(guestIds.length === 1 ? guestIds[0] : "");
  const [naarId, setNaarId] = useState("");
  const [busy, setBusy] = useState(false);

  const members = useAsync(
    () => (m.group_id ? getGroupMembers(m.group_id) : Promise.resolve([])),
    [m.group_id],
  );
  const friendships = useAsync(getMyFriendships, []);

  // Kandidaten: groepsgenoten en vrienden die nog niet meespelen. Zelfde
  // populatie als _can_add_player, dus de UI biedt niets aan wat de RPC weigert.
  const kandidaatIds = [
    ...(members.data ?? []).map((x) => x.player_id),
    ...categorize(friendships.data ?? [], myId).accepted.map((f) =>
      otherId(f, myId),
    ),
    myId,
  ].filter(
    (pid, i, all) => all.indexOf(pid) === i && !matchPlayerIds.includes(pid),
  );
  const kandidaatKey = kandidaatIds.slice().sort().join(",");
  const kandidaatProfielen = useAsync(
    () => getProfilesByIds(kandidaatIds),
    [kandidaatKey],
  );

  const kmap = kandidaatProfielen.data ?? {};
  // Gasten van iemand anders vallen af: die zou de RPC toch weigeren.
  const kandidaten = kandidaatIds
    .filter((pid) => kmap[pid] && (!kmap[pid].is_guest || kmap[pid].owner_id === myId))
    .sort((a, b) => displayName(kmap[a]).localeCompare(displayName(kmap[b])));

  const magWijzigen =
    m.created_by === myId ||
    (members.data ?? []).some((x) => x.player_id === myId && x.role === "owner");
  if (!magWijzigen) return null;

  async function vervang() {
    if (!gastId || !naarId) return;
    if (
      !(await confirm({
        title: "Gast vervangen?",
        body: `${displayName(profiles[gastId])} wordt in deze match vervangen door ${displayName(kmap[naarId])}. De match komt op diens naam te staan en alle ratings worden opnieuw berekend. Dit kan niet ongedaan worden gemaakt.`,
        confirmLabel: "Vervangen",
      }))
    )
      return;
    setBusy(true);
    try {
      await replaceMatchPlayer(m.id, gastId, naarId);
      tap();
      toast.success("Deelnemer vervangen.");
      setNaarId("");
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <div className="card__head">
        <h2 className="card__title">Gast vervangen</h2>
      </div>
      <p className="card__subtitle">
        Speelde er iemand anders onder deze gastnaam? Zet de match op de juiste
        speler; de ratings worden daarna opnieuw berekend.
      </p>
      <div className="stack">
        {guestIds.length > 1 && (
          <div className="row-between">
            <span>Gast</span>
            <select
              className="select"
              aria-label="Welke gast"
              disabled={busy}
              value={gastId}
              onChange={(e) => setGastId(e.target.value)}
            >
              <option value="">Kies een gast…</option>
              {guestIds.map((pid) => (
                <option key={pid} value={pid}>
                  {displayName(profiles[pid])}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="row-between">
          <span>{guestIds.length > 1 ? "Vervangen door" : `${displayName(profiles[gastId])} was eigenlijk`}</span>
          <select
            className="select"
            aria-label="Vervangen door"
            disabled={busy || kandidaatProfielen.loading}
            value={naarId}
            onChange={(e) => setNaarId(e.target.value)}
          >
            <option value="">Kies een speler…</option>
            {kandidaten.map((pid) => (
              <option key={pid} value={pid}>
                {displayName(kmap[pid])}
              </option>
            ))}
          </select>
        </div>
        {!kandidaatProfielen.loading && kandidaten.length === 0 && (
          <p className="field-hint">
            Geen spelers om uit te kiezen. Voeg de speler eerst toe als vriend of
            als lid van de groep.
          </p>
        )}
        <div className="form-actions">
          <button
            className="btn btn--sm"
            disabled={busy || !gastId || !naarId}
            onClick={() => void vervang()}
          >
            {busy ? "Bezig…" : "Vervang deelnemer"}
          </button>
        </div>
      </div>
      {confirmUi}
    </section>
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

/**
 * Groep koppelen (#648): een losse match alsnog aan een groep hangen, of een
 * groepsmatch verhangen/loskoppelen. Zichtbaar voor elk lid van de doelgroep
 * (losse match: iedereen met minstens één eigen groep; groepsmatch: alleen
 * leden van de huidige groep). De RPC set_match_group dwingt dit ook af.
 */
function GroupLinkSection({
  match: m,
  onSaved,
}: {
  match: Match;
  onSaved: () => void;
}) {
  const toast = useToast();
  const myGroups = useAsync(getMyGroups, []);
  const [picked, setPicked] = useState(m.group_id ?? "");
  const [busy, setBusy] = useState(false);

  const groups = myGroups.data ?? [];
  const isLos = m.group_id == null;
  // Verhangen/loskoppelen kan alleen als lid van de huidige groep; de eigen
  // groepenlijst is daarvoor meteen de lidmaatschapscheck.
  const magWijzigen = !isLos && groups.some((g) => g.id === m.group_id);
  if (myGroups.loading || (isLos ? groups.length === 0 : !magWijzigen))
    return null;

  const unchanged = picked === (m.group_id ?? "");

  async function save() {
    setBusy(true);
    try {
      await setMatchGroup(m.id, picked || null);
      tap();
      toast.success(picked ? "Match aan groep gekoppeld." : "Match losgekoppeld.");
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <div className="card__head">
        <h2 className="card__title">Groep</h2>
      </div>
      <p className="md-toto__note">
        {isLos
          ? "Losse match — telt nergens mee. Koppel hem aan een groep zodat hij meetelt voor de groepsstand."
          : "Verhang deze match naar een andere groep, of maak er weer een losse match van."}
      </p>
      <label className="label">
        {isLos ? "Koppel aan groep" : "Groep"}
        <select
          className="select"
          value={picked}
          onChange={(e) => setPicked(e.target.value)}
        >
          <option value="">Losse match — geen groep</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </label>
      <div className="md-editor__buttons">
        <button
          className="btn btn--primary btn--sm"
          onClick={save}
          disabled={busy || unchanged}
        >
          {busy ? "Opslaan…" : "Groep opslaan"}
        </button>
      </div>
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