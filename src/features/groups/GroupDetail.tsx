import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { useAsync } from "@/lib/hooks/useAsync";
import { useRealtime } from "@/lib/hooks/useRealtime";
import { useToast } from "@/ui/ToastProvider";
import { MatchListSkeleton, Skeleton } from "@/ui/Skeleton";
import {
  getGroup,
  getGroupMembers,
  addGroupMembers,
  removeGroupMember,
  renameGroup,
  setRoastIntensiteit,
  deleteGroup,
  leaveGroup,
  createGroupInvite,
} from "./api";
import { getGroupMatches, getTeamsMap, createGuestPlayer } from "../matches/api";
import { dateInZone } from "@/lib/utils/time";
import { useClub } from "../availability/club";
import { getGroupPlayerStandings } from "../standings/api";
import { getPlayerRatings, getAllRatingHistories } from "../standings/ratingsApi";
import { Sparkline } from "@/features/rating/components/Sparkline";
import { Podium } from "@/features/standings/components/Podium";
import { TierBadge } from "@/features/rating/components/TierBadge";
import { groupRatingStandings, playedInGroup } from "./groupRating";
import { getProfilesMap, displayName } from "../profiles/api";
import { getZwartePiet } from "./zwartePietApi";
import { ZwartePietCard } from "@/features/groups/components/ZwartePietCard";
import { getMyFriendships, categorize, otherId } from "../friends/api";
import { Avatar } from "@/ui/Avatar";
import { DeletableMatchCard } from "@/features/matches/components/MatchList";
import { MatchHistory } from "@/features/matches/components/MatchHistory";
import { PlannedMatchCard } from "@/features/matches/components/PlannedMatchCard";
import { RivalryCard } from "@/features/groups/components/RivalryCard";
import { PiasCard } from "@/features/groups/components/PiasCard";
import { buildMatchRatings } from "@/features/groups/maandpias";
import { NewMatchSheet, type NewMatchMode } from "@/features/matches/components/NewMatchSheet";
import { PollSection } from "@/features/groups/components/PlanPoll";
import { SuggestionsCard } from "@/features/groups/components/SuggestionsCard";
import { DayStats } from "@/features/groups/components/DayStats";
import { MakeTeams } from "@/features/groups/components/MakeTeams";
import { ShareEvening } from "@/features/groups/components/ShareEvening";
import { ShareChampion } from "@/features/standings/components/ShareChampion";
import { computePlayerStandings, matchesInSeason } from "@/features/rating/standings";
import { upsetsByMatch } from "@/features/matches/upset";
import { computePredictionStandings } from "@/features/matches/predictions";
import {
  getGroupPredictions,
  getGroupPredictionStandings,
} from "../matches/predictionsApi";
import {
  isSeasonClosed,
  listSeasons,
  seasonFromId,
} from "@/features/rating/seasons";
import { errorMessage } from "@/lib/utils/errors";
import type {
  Match,
  PlayerStanding,
  Profile,
  RoastIntensiteit,
} from "@/types";
import "./GroupDetail.css";

type View = "rondes" | "plannen" | "spelen" | "matches" | "stand" | "leden";

export function GroupDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const myId = user?.id ?? "";

  const group = useAsync(() => getGroup(id), [id]);
  const members = useAsync(() => getGroupMembers(id), [id]);
  const matches = useAsync(() => getGroupMatches(id), [id]);
  const standings = useAsync(() => getGroupPlayerStandings(id), [id]);
  const piet = useAsync(getZwartePiet, []);
  const profiles = useAsync(getProfilesMap, []);
  const teams = useAsync(getTeamsMap, []);
  const friendships = useAsync(getMyFriendships, []);

  // Voor het rating-klassement op de Stand-tab (#52).
  const ratings = useAsync(getPlayerRatings, []);
  const histories = useAsync(getAllRatingHistories, []);

  // Toto (#116): tips + voorspellersklassement van deze groep.
  const predictions = useAsync(() => getGroupPredictions(id), [id]);
  const predictionStandings = useAsync(
    () => getGroupPredictionStandings(id),
    [id],
  );

  const onPredictions = useCallback(() => {
    predictions.reload();
    predictionStandings.reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [predictions.reload, predictionStandings.reload]);

  const onMatches = useCallback(() => {
    matches.reload();
    standings.reload();
    teams.reload();
    ratings.reload();
    histories.reload();
    // De Zwarte Piet verhuist ook bij een uitslag/correctie (#185).
    piet.reload();
    // Een uitslag of correctie beoordeelt ook de tips (grading-trigger).
    onPredictions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches.reload, standings.reload, teams.reload, ratings.reload, histories.reload, piet.reload, onPredictions]);
  // Alleen reageren op wijzigingen binnen déze groep, niet op elke match
  // die ergens anders wordt gelogd.
  useRealtime("matches", onMatches, `group_id=eq.${id}`);
  useRealtime("group_members", members.reload, `group_id=eq.${id}`);
  useRealtime("match_predictions", onPredictions, `group_id=eq.${id}`);

  const toast = useToast();
  const [busy, setBusy] = useState(false);
  // De actieve tab leeft in de URL: refresh-bestendig en deelbaar
  // ("kijk even bij de stand").
  const [params, setParams] = useSearchParams();
  const rawTab = params.get("tab");
  const view: View =
    rawTab === "stand" ||
    rawTab === "leden" ||
    rawTab === "plannen" ||
    rawTab === "spelen" ||
    rawTab === "matches"
      ? rawTab
      : "rondes";
  const setView = (v: View) => {
    const next = new URLSearchParams(params);
    if (v === "rondes") next.delete("tab");
    else next.set("tab", v);
    setParams(next, { replace: true });
  };
  // Losse match loggen/plannen binnen de groep (telt mee in stand + avondsamenvatting).
  const [logOpen, setLogOpen] = useState(false);
  const [logMode, setLogMode] = useState<NewMatchMode>("score");
  // Stand-tab: rating is de standaard (#52); de punten-weergave blijft als
  // toggle tot eendaagse tornooien (#124) die rol overnemen — dan kan hij weg.
  // "toto" = het voorspellersklassement (#116).
  const [standMode, setStandMode] = useState<"rating" | "punten" | "toto">(
    "rating",
  );
  // Meervoudige selectie voor "voeg vrienden toe" + deelbare uitnodigingslink.
  const [selectedToAdd, setSelectedToAdd] = useState<Set<string>>(new Set());
  const [guestName, setGuestName] = useState("");
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);
  // Hernoem-veld volgt de geladen groepsnaam.
  const [renameValue, setRenameValue] = useState("");
  useEffect(() => {
    if (group.data) setRenameValue(group.data.name);
  }, [group.data]);

  const pmap = useMemo(() => profiles.data ?? {}, [profiles.data]);
  const tmap = useMemo(() => teams.data ?? {}, [teams.data]);
  // Upsets per match-id (#85) uit de al geladen rating-historie.
  const upsets = useMemo(
    () => upsetsByMatch(matches.data ?? [], tmap, histories.data ?? {}),
    [matches.data, tmap, histories.data],
  );
  const memberList = members.data ?? [];
  // De huidige Zwarte Piet-drager van déze groep (#185), of null als de Piet vrij is.
  const zwartePiet = piet.data?.[id] ?? null;
  const isOwner = group.data?.created_by === myId;
  // Groepsleden als profielen — de kiesbare spelers bij het loggen van een match.
  const groupPlayers = memberList
    .map((m) => pmap[m.player_id])
    .filter(Boolean) as Profile[];

  const memberIds = new Set(memberList.map((m) => m.player_id));
  const { accepted } = categorize(friendships.data ?? [], myId);
  const addableFriendIds = accepted
    .map((f) => otherId(f, myId))
    .filter((pid) => !memberIds.has(pid));

  // Groepsseizoenen (kwartalen) voor de stand — dezelfde logica als het globale
  // klassement, maar client-side berekend uit de matches van deze groep.
  const season = seasonFromId(params.get("seizoen") ?? "");
  const setSeasonId = (sid: string) => {
    const next = new URLSearchParams(params);
    if (sid) next.set("seizoen", sid);
    else next.delete("seizoen");
    setParams(next, { replace: true });
  };
  const completedMatches = (matches.data ?? []).filter(
    (m) => m.status === "completed",
  );
  // Pre-match ratings voor de choke-detectie van de pias van de maand.
  const piasRatings = useMemo(
    () => buildMatchRatings(histories.data ?? {}),
    [histories.data],
  );
  const firstMatchDate = completedMatches.reduce<string | null>((min, m) => {
    const d = m.played_at ?? m.created_at;
    return min === null || d < min ? d : min;
  }, null);
  const seasons = firstMatchDate ? listSeasons(new Date(firstMatchDate)) : [];
  const seasonStandings: PlayerStanding[] | null = season
    ? computePlayerStandings(
        matchesInSeason(completedMatches, season),
        tmap,
        pmap,
      )
    : null;
  const shownStandings = season ? (seasonStandings ?? []) : (standings.data ?? []);
  const champion =
    season && isSeasonClosed(season) && shownStandings.length > 0
      ? shownStandings[0]
      : null;

  // Voorspellersklassement: all-time uit de view; per seizoen client-side uit
  // de tips van de matches in dat kwartaal — zelfde hybride als de punten.
  const shownPredictionStandings = (() => {
    if (!season) return predictionStandings.data ?? [];
    const inSeason = new Set(
      matchesInSeason(completedMatches, season).map((m) => m.id),
    );
    return computePredictionStandings(
      (predictions.data ?? []).filter((p) => inSeason.has(p.match_id)),
      pmap,
    );
  })();

  function toggleSelected(pid: string) {
    setSelectedToAdd((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid);
      else next.add(pid);
      return next;
    });
  }

  async function makeInvite() {
    setInviteBusy(true);
    try {
      const token = await createGroupInvite(id);
      const url = `${window.location.origin}/groepen/join/${token}`;
      setInviteUrl(url);
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Uitnodigingslink gekopieerd.");
      } catch {
        toast.success("Uitnodigingslink klaar — kopieer 'm hieronder.");
      }
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setInviteBusy(false);
    }
  }

  async function act(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      members.reload();
      matches.reload();
      standings.reload();
      teams.reload();
      profiles.reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  // Reis-CTA: alles van vandaag gespeeld → door naar de stand (#106).
  const club = useClub();
  const today = dateInZone(club.timezone);
  const todaysMatches = (matches.data ?? []).filter(
    (m) => (m.played_at ?? m.created_at).slice(0, 10) === today,
  );
  const dayDone =
    todaysMatches.length > 0 &&
    todaysMatches.every((m) => m.status === "completed");

  // De Vandaag-tab toont enkel de rondes van vandaag; de volledige historie
  // staat op de Matches-tab (#342).
  const rounds = groupByRound(todaysMatches);
  // Ronde met openstaande uitslagen (blokkeert Mexicano in MakeTeams).
  const openRound = rounds.find(({ list }) =>
    list.some((m) => m.status !== "completed"),
  );

  if (group.loading)
    return (
      <div className="card">
        <Skeleton rows={2} />
        <MatchListSkeleton count={2} />
      </div>
    );
  if (!group.data)
    return (
      <p className="msg msg--error">Groep niet gevonden of geen toegang.</p>
    );

  return (
    <div>
      <header className="page-head">
        <div className="row-between">
          <h1 className="page-title">{group.data.name}</h1>
          <Link className="btn btn--sm" to="/spelen?hub=1">
            ← Spelen
          </Link>
        </div>
        <p className="page-subtitle">
          {memberList.length} leden{isOwner ? " · jij bent eigenaar" : ""}
        </p>
      </header>

      {/* Tabs in reis-volgorde (#106): plannen → spelen → stand. */}
      <div className="tabs">
        <button
          className={`tab ${view === "plannen" ? "is-active" : ""}`}
          onClick={() => setView("plannen")}
        >
          Plannen
        </button>
        <button
          className={`tab ${view === "rondes" ? "is-active" : ""}`}
          onClick={() => setView("rondes")}
        >
          Vandaag
          {rounds.length > 0 && (
            <span className="tab__count" aria-hidden="true">
              {rounds.length}
            </span>
          )}
        </button>
        <button
          className={`tab ${view === "spelen" ? "is-active" : ""}`}
          onClick={() => setView("spelen")}
        >
          Spelen
        </button>
        <button
          className={`tab ${view === "matches" ? "is-active" : ""}`}
          onClick={() => setView("matches")}
        >
          Matches
          {completedMatches.length > 0 && (
            <span className="tab__count" aria-hidden="true">
              {completedMatches.length}
            </span>
          )}
        </button>
        <button
          className={`tab ${view === "stand" ? "is-active" : ""}`}
          onClick={() => setView("stand")}
        >
          Stand
        </button>
        <button
          className={`tab ${view === "leden" ? "is-active" : ""}`}
          onClick={() => setView("leden")}
        >
          Leden
          {memberList.length > 0 && (
            <span className="tab__count" aria-hidden="true">
              {memberList.length}
            </span>
          )}
        </button>
      </div>

      {view === "rondes" && (
        <>
          {/* Dagoverzicht: telling + highlights van vandaag (#342). */}
          <DayStats
            matches={matches.data ?? []}
            teams={tmap}
            profiles={pmap}
            histories={histories.data ?? {}}
            zwartePiet={zwartePiet}
            today={today}
          />
          {/* Reis-CTA: alle uitslagen van vandaag binnen → door naar de stand. */}
          {dayDone && (
            <div className="card flow-next" role="status">
              <span>
                🏁 Alle uitslagen van vandaag staan erin — mooi gespeeld!
              </span>
              <button
                className="btn btn--sm btn--primary"
                onClick={() => setView("stand")}
              >
                Bekijk de stand →
              </button>
            </div>
          )}
        </>
      )}

      {view === "rondes" && (
        <section className="card">
          <div className="card__head">
            <h2 className="card__title card__title--tight">Wedstrijden</h2>
            {/* Verschijnt zodra er vanavond een uitslag is: poster voor de groepschat. */}
            <ShareEvening
              groupName={group.data.name}
              matches={matches.data ?? []}
              teams={tmap}
              profiles={pmap}
              histories={histories.data ?? undefined}
            />
          </div>
          <p className="card__subtitle">
            De wedstrijden en gelogde partijen van vandaag — vul de uitslagen in en
            de stand rekent live mee.
          </p>

          {rounds.length === 0 && (
            <div className="empty">
              <p>Nog niets gespeeld vandaag.</p>
              <button
                type="button"
                className="btn btn--sm btn--primary"
                onClick={() => setView("spelen")}
              >
                Genereer teams of log een partij →
              </button>
            </div>
          )}

          <div className="rounds">
            {rounds.map(({ round, list }) => {
              const done = list.filter((m) => m.status === "completed").length;
              return (
                <div key={round} className="round">
                  <div className="round-head">
                    <h3 className="card__title card__title--compact">
                      {round === 0 ? "Losse matches" : `Ronde ${round}`}
                    </h3>
                    <span
                      className={`badge ${
                        done === list.length ? "badge--win" : "badge--accent"
                      }`}
                    >
                      {done === list.length
                        ? "Afgerond"
                        : `${done}/${list.length} uitslagen`}
                    </span>
                  </div>
                  <div className="stack">
                    {list.map((m) =>
                      m.status === "completed" ? (
                        <DeletableMatchCard
                          key={m.id}
                          match={m}
                          teams={tmap}
                          profiles={pmap}
                          perspectiveId={myId}
                          upset={upsets.get(m.id) ?? null}
                          canManage={isOwner}
                          onDeleted={onMatches}
                        />
                      ) : (
                        <PlannedMatchCard
                          key={m.id}
                          match={m}
                          teams={tmap}
                          profiles={pmap}
                          perspectiveId={myId}
                          history={matches.data ?? []}
                          intensiteit={group.data?.roast_intensiteit ?? "gemeen"}
                          onSaved={onMatches}
                        />
                      ),
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {view === "spelen" && (
        <>
          {/* Eén teamgenerator: deelnemers uit de poll van vandaag +
              formaatkeuze (eerlijk/americano/mexicano). */}
          <MakeTeams
            groupId={id}
            members={memberList}
            profiles={pmap}
            myId={myId}
            matches={matches.data ?? []}
            teams={tmap}
            openRound={openRound ?? null}
            onGenerated={onMatches}
          />

          <section className="card">
            <div className="card__head">
              <h2 className="card__title card__title--tight">Losse partij</h2>
            </div>
            <div className="group-log">
              <p className="group-log__hint">
                Zelf een partij gespeeld of er eentje inplannen? Log 'm hier — hij
                telt mee in de groepsstand en de avondsamenvatting.
              </p>
              <div className="group-log__actions">
                <button
                  className="btn btn--sm"
                  disabled={busy}
                  onClick={() => {
                    setLogMode("score");
                    setLogOpen(true);
                  }}
                >
                  + Log match
                </button>
                <button
                  className="btn btn--sm"
                  disabled={busy}
                  onClick={() => {
                    setLogMode("plan");
                    setLogOpen(true);
                  }}
                >
                  Plan match
                </button>
              </div>
            </div>
          </section>

          <NewMatchSheet
            open={logOpen}
            players={groupPlayers}
            mode={logMode}
            groupId={id}
            onClose={() => setLogOpen(false)}
            onCreated={onMatches}
            onGuestCreated={profiles.reload}
          />
        </>
      )}

      {view === "plannen" && (
        <>
          {/* Suggesties leiden de plan-flow in: wie kan/moet er spelen? →
              plan de speeldag via de poll eronder (#342). */}
          <SuggestionsCard groupId={id} myId={myId} matches={matches.data ?? []} />
          <PollSection
            groupId={id}
            groupName={group.data.name}
            members={memberList}
            profiles={pmap}
            myId={myId}
            isOwner={isOwner}
          />
        </>
      )}

      {view === "matches" && (
        <MatchHistory
          title="Gespeelde matches"
          matches={completedMatches}
          teams={tmap}
          profiles={pmap}
          myId={myId}
          upsets={upsets}
          canManage={isOwner}
          onChanged={onMatches}
          loading={matches.loading}
          error={matches.error}
          emptyAll={
            <p className="empty">
              Nog geen gespeelde matches in deze groep — log er een op de
              Vandaag-tab.
            </p>
          }
        />
      )}

      {view === "stand" && (
        <>
        {/* Klassementtabel eerst; de roast/rivaliteit-kaarten staan eronder
            zodat de eigenlijke stand niet wegzakt onder gamification (#276). */}
        <section className="card">
          <div className="card__head">
            <h2 className="card__title card__title--tight">Groepsklassement</h2>
            <div className="tabs tabs--head" role="group" aria-label="Klassement-weergave">
              <button
                className={`tab ${standMode === "rating" ? "is-active" : ""}`}
                onClick={() => setStandMode("rating")}
              >
                Rating
              </button>
              <button
                className={`tab ${standMode === "punten" ? "is-active" : ""}`}
                onClick={() => setStandMode("punten")}
              >
                Punten
              </button>
              <button
                className={`tab ${standMode === "toto" ? "is-active" : ""}`}
                onClick={() => setStandMode("toto")}
              >
                Toto
              </button>
            </div>
          </div>

          {standMode === "rating" && (
            <>
              <p className="card__subtitle">
                Gesorteerd op rating — hoe vaak iemand speelt telt niet mee.
                Gedimde ratings zijn op minder dan 3 matches gebouwd.
              </p>
              {(() => {
                const played = playedInGroup(matches.data ?? [], tmap);
                const rows = groupRatingStandings(
                  memberList.map((m) => m.player_id),
                  ratings.data ?? {},
                  played,
                  (pid) => displayName(pmap[pid]),
                );
                const lastDelta = (pid: string) => {
                  const hist = histories.data?.[pid] ?? [];
                  return hist[hist.length - 1]?.delta ?? null;
                };
                // Top 3 met rating op het podium; de tabel begint vanaf #4.
                const podium = rows.filter((r) => r.rating != null).slice(0, 3);
                const rest = rows.slice(podium.length);
                return (
                  <>
                    <Podium
                      entries={podium.map((r) => ({
                        key: r.playerId,
                        name: displayName(pmap[r.playerId]),
                        profile: pmap[r.playerId] ?? null,
                        link: `/spelers/${r.playerId}`,
                        isMe: r.playerId === myId,
                        rating: r.rating,
                        delta: lastDelta(r.playerId),
                        dimmed: r.thin,
                        tier: true,
                        sub: `${r.playedInGroup}× in deze groep`,
                      }))}
                    />
                    {rest.length > 0 && (
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Speler</th>
                            <th className="num">Rating</th>
                            <th className="num">Δ</th>
                            <th className="num">G</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rest.map((r, i) => {
                            const rank = i + 1 + podium.length;
                            const hist = histories.data?.[r.playerId] ?? [];
                            const last = hist[hist.length - 1];
                            return (
                              <tr
                                key={r.playerId}
                                className={`${r.playerId === myId ? "is-me" : ""}${r.thin ? " rating-thin" : ""}`}
                              >
                                <td>
                                  <span className="cell-player">
                                    <span className={`rank rank--${rank}`}>
                                      {rank}
                                    </span>
                                    <Avatar profile={pmap[r.playerId]} size={24} />
                                    {displayName(pmap[r.playerId])}
                                  </span>
                                </td>
                                <td className="num">
                                  {r.rating != null ? (
                                    <span className="rating-wrap">
                                      <TierBadge
                                        rating={r.rating}
                                        dimmed={r.thin}
                                        size="sm"
                                      />
                                      <span className="rating-cell">
                                        <strong>{r.rating}</strong>
                                      </span>
                                      {hist.length > 0 && (
                                        <Sparkline
                                          history={hist}
                                          name={displayName(pmap[r.playerId])}
                                        />
                                      )}
                                    </span>
                                  ) : (
                                    <span className="rating-none">
                                      nog geen matches
                                    </span>
                                  )}
                                </td>
                                <td className="num">
                                  {last && last.delta !== 0 && (
                                    <span
                                      className={`stat__delta ${last.delta > 0 ? "is-up" : "is-down"}`}
                                    >
                                      {last.delta > 0 ? "▲" : "▼"}
                                      {Math.abs(last.delta)}
                                    </span>
                                  )}
                                </td>
                                <td className="num">{r.playedInGroup}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </>
                );
              })()}
            </>
          )}

          {standMode !== "rating" && seasons.length > 0 && (
            <div className="stand-season">
              <select
                className="select select--filter"
                aria-label="Seizoen"
                value={season?.id ?? ""}
                onChange={(e) => setSeasonId(e.target.value)}
              >
                <option value="">Alle tijden</option>
                {season && !seasons.some((s) => s.id === season.id) && (
                  <option value={season.id}>{season.label}</option>
                )}
                {seasons.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {standMode === "punten" && champion && season && (
            <p className="champion-banner" role="status">
              <span className="champion-banner__cup" aria-hidden="true">
                🏆
              </span>
              <span>
                Kampioen {season.label}:{" "}
                <strong>{displayName(champion)}</strong>
              </span>
              <ShareChampion
                seasonLabel={season.label}
                rows={shownStandings.map((p) => ({
                  name: displayName(p),
                  points: p.points,
                }))}
              />
            </p>
          )}

          {standMode === "punten" && shownStandings.length === 0 && (
            <p className="empty">
              {season
                ? "Geen matches in dit seizoen."
                : "Nog geen afgeronde matches in deze groep."}
            </p>
          )}
          {standMode === "punten" && shownStandings.length > 0 && (
            <Podium
              entries={shownStandings.slice(0, 3).map((p) => ({
                key: p.player_id,
                name: displayName(p),
                profile: pmap[p.player_id] ?? p,
                link: `/spelers/${p.player_id}`,
                isMe: p.player_id === myId,
                rating: ratings.data?.[p.player_id]?.rating ?? null,
                dimmed:
                  (ratings.data?.[p.player_id]?.games ?? 0) > 0 &&
                  (ratings.data?.[p.player_id]?.games ?? 0) < 3,
                sub: `${p.points} ptn`,
                record: `${p.won}W · ${p.drawn ?? 0}G · ${p.lost}V`,
              }))}
            />
          )}
          {standMode === "punten" && shownStandings.length > 3 && (
            <table className="table">
              <thead>
                <tr>
                  <th>Speler</th>
                  <th className="num">G</th>
                  <th className="num">W</th>
                  <th className="num">Saldo</th>
                  <th className="num">Ptn</th>
                </tr>
              </thead>
              <tbody>
                {shownStandings.slice(3).map((p, i) => (
                  <tr
                    key={p.player_id}
                    className={p.player_id === myId ? "is-me" : ""}
                  >
                    <td>
                      <span className="cell-player">
                        <span className={`rank rank--${i + 4}`}>{i + 4}</span>
                        <Avatar profile={pmap[p.player_id] ?? p} size={24} />
                        {displayName(p)}
                      </span>
                    </td>
                    <td className="num">{p.played}</td>
                    <td className="num">{p.won}</td>
                    <td className="num">
                      {p.goal_diff > 0 ? `+${p.goal_diff}` : p.goal_diff}
                    </td>
                    <td className="num">
                      <strong>{p.points}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {standMode === "toto" && (
            <>
              <p className="card__subtitle">
                Wie tipt de meeste winnaars? Een juiste tip levert 1–4 punten
                op — hoe kleiner de winkans, hoe meer punten.
              </p>
              {shownPredictionStandings.length === 0 && (
                <p className="empty">
                  {season
                    ? "Geen beoordeelde tips in dit seizoen."
                    : "Nog geen tips in deze groep. Tip de winnaar op een geplande match!"}
                </p>
              )}
              {shownPredictionStandings.length > 0 && (
                <Podium
                  entries={shownPredictionStandings.slice(0, 3).map((p) => ({
                    key: p.player_id,
                    name: displayName(p),
                    profile: pmap[p.player_id] ?? p,
                    link: `/spelers/${p.player_id}`,
                    isMe: p.player_id === myId,
                    rating: p.points,
                    sub: `${p.correct}/${p.predicted} juist`,
                  }))}
                />
              )}
              {shownPredictionStandings.length > 3 && (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Speler</th>
                      <th className="num">Getipt</th>
                      <th className="num">Juist</th>
                      <th className="num">Ptn</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shownPredictionStandings.slice(3).map((p, i) => (
                      <tr
                        key={p.player_id}
                        className={p.player_id === myId ? "is-me" : ""}
                      >
                        <td>
                          <span className="cell-player">
                            <span className={`rank rank--${i + 4}`}>{i + 4}</span>
                            <Avatar profile={pmap[p.player_id] ?? p} size={24} />
                            {displayName(p)}
                          </span>
                        </td>
                        <td className="num">{p.predicted}</td>
                        <td className="num">{p.correct}</td>
                        <td className="num">
                          <strong>{p.points}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </section>

        <RivalryCard
          matches={matches.data ?? []}
          teams={tmap}
          profiles={pmap}
        />
        <PiasCard
          matches={completedMatches}
          teams={tmap}
          profiles={pmap}
          ratingsByMatch={piasRatings}
          intensiteit={group.data?.roast_intensiteit ?? "gemeen"}
        />
        {zwartePiet && (
          <ZwartePietCard piet={zwartePiet} group={group.data} profiles={pmap} />
        )}
        </>
      )}

      {view === "leden" && (
        <section className="card">
          <h2 className="card__title">Leden</h2>
          <div className="person-list">
            {memberList.map((m) => (
              <div key={m.player_id} className="person-row">
                <span className="cell-player">
                  <Avatar profile={pmap[m.player_id]} size={28} />
                  {displayName(pmap[m.player_id])}{" "}
                  {m.role === "owner" && (
                    <span className="badge badge--accent">eigenaar</span>
                  )}
                  {zwartePiet?.holderId === m.player_id && (
                    <span className="badge badge--loss" title="Draagt de Zwarte Piet">
                      🃏
                    </span>
                  )}
                </span>
                {isOwner && m.player_id !== myId && (
                  <button
                    className="btn btn--danger btn--sm"
                    disabled={busy}
                    onClick={() =>
                      act(
                        () => removeGroupMember(id, m.player_id),
                        "Lid verwijderd.",
                      )
                    }
                  >
                    Verwijderen
                  </button>
                )}
              </div>
            ))}
          </div>

          {isOwner && (
            <>
              <h3 className="card__title card__title--section">
                Vrienden toevoegen
              </h3>
              {addableFriendIds.length === 0 ? (
                <p className="empty">
                  Geen vrienden om toe te voegen. Voeg eerst vrienden toe.
                </p>
              ) : (
                <>
                  <div className="person-list">
                    {addableFriendIds.map((pid) => (
                      <label key={pid} className="person-row person-row--pick">
                        <span className="cell-player">
                          <input
                            type="checkbox"
                            className="member-check"
                            checked={selectedToAdd.has(pid)}
                            onChange={() => toggleSelected(pid)}
                          />
                          <Avatar profile={pmap[pid]} size={28} />
                          {displayName(pmap[pid])}
                        </span>
                      </label>
                    ))}
                  </div>
                  <div className="form-actions">
                    <button
                      className="btn btn--primary btn--sm"
                      disabled={busy || selectedToAdd.size === 0}
                      onClick={() =>
                        act(async () => {
                          await addGroupMembers(id, [...selectedToAdd]);
                          setSelectedToAdd(new Set());
                        }, "Leden toegevoegd.")
                      }
                    >
                      {selectedToAdd.size <= 1
                        ? "Voeg toe"
                        : `Voeg ${selectedToAdd.size} toe`}
                    </button>
                  </div>
                </>
              )}

              <h3 className="card__title card__title--section">
                Gast toevoegen
              </h3>
              <p className="card__subtitle">
                Speelt er iemand zonder account mee? Voeg 'm als gast toe met een
                naam; hij telt mee in gegenereerde rondes.
              </p>
              <div className="guest-add">
                <input
                  className="input guest-add__input"
                  type="text"
                  placeholder="Naam van de gast…"
                  aria-label="Naam van een gastspeler"
                  value={guestName}
                  maxLength={40}
                  disabled={busy}
                  onChange={(e) => setGuestName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && guestName.trim()) {
                      e.preventDefault();
                      const naam = guestName.trim();
                      void act(async () => {
                        const gid = await createGuestPlayer(naam);
                        await addGroupMembers(id, [gid]);
                        setGuestName("");
                      }, "Gast toegevoegd.");
                    }
                  }}
                />
                <button
                  className="btn btn--primary btn--sm"
                  disabled={busy || !guestName.trim()}
                  onClick={() => {
                    const naam = guestName.trim();
                    void act(async () => {
                      const gid = await createGuestPlayer(naam);
                      await addGroupMembers(id, [gid]);
                      setGuestName("");
                    }, "Gast toegevoegd.");
                  }}
                >
                  + Gast
                </button>
              </div>

              <h3 className="card__title card__title--section">
                Uitnodigingslink
              </h3>
              <p className="card__subtitle">
                Deel deze link; wie 'm opent en ingelogd is, wordt automatisch
                lid — ook zonder vriendschap.
              </p>
              <div className="form-actions">
                <button
                  className="btn btn--sm"
                  disabled={inviteBusy}
                  onClick={makeInvite}
                >
                  {inviteBusy ? "Bezig…" : "Maak uitnodigingslink"}
                </button>
              </div>
              {inviteUrl && (
                <input
                  className="input invite-url"
                  readOnly
                  value={inviteUrl}
                  onFocus={(e) => e.currentTarget.select()}
                />
              )}
            </>
          )}

          <h3 className="card__title card__title--section">Groep beheren</h3>
          {isOwner ? (
            <div className="stack">
              <form
                className="row-between"
                onSubmit={(e) => {
                  e.preventDefault();
                  const name = renameValue.trim();
                  if (!name || name === group.data!.name) return;
                  act(() => renameGroup(id, name), "Groepsnaam bijgewerkt.");
                }}
              >
                <input
                  className="input"
                  aria-label="Groepsnaam"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                />
                <button
                  className="btn btn--sm"
                  disabled={
                    busy ||
                    !renameValue.trim() ||
                    renameValue.trim() === group.data!.name
                  }
                >
                  Hernoemen
                </button>
              </form>
              <div className="stack">
                <div className="row-between">
                  <span>Roast-intensiteit 🎙️</span>
                  <select
                    className="select"
                    aria-label="Roast-intensiteit"
                    disabled={busy}
                    value={group.data!.roast_intensiteit ?? "gemeen"}
                    onChange={(e) => {
                      const val = e.target.value as RoastIntensiteit;
                      act(async () => {
                        await setRoastIntensiteit(id, val);
                        group.reload();
                      }, "Roast-intensiteit bijgewerkt.");
                    }}
                  >
                    <option value="mild">Mild — zachte por</option>
                    <option value="gemeen">Gemeen — standaard</option>
                    <option value="radioactief">Geen genade — meedogenloos</option>
                  </select>
                </div>
                <p className="field-hint">
                  Hoe hard het systeem de leden van deze groep roast. Spelers met
                  een roast-schild blijven altijd gespaard.
                </p>
              </div>
              <div>
                <button
                  className="btn btn--danger btn--sm"
                  disabled={busy}
                  onClick={() => {
                    if (
                      !window.confirm(
                        "Deze groep en al zijn wedstrijden verwijderen? Dit kan niet ongedaan worden gemaakt.",
                      )
                    )
                      return;
                    act(async () => {
                      await deleteGroup(id);
                      navigate("/groepen", { replace: true });
                    }, "Groep verwijderd.");
                  }}
                >
                  Groep verwijderen
                </button>
              </div>
            </div>
          ) : (
            <div>
              <button
                className="btn btn--danger btn--sm"
                disabled={busy}
                onClick={() => {
                  if (!window.confirm("Weet je zeker dat je deze groep wilt verlaten?"))
                    return;
                  act(async () => {
                    await leaveGroup(id, myId);
                    navigate("/groepen", { replace: true });
                  }, "Je hebt de groep verlaten.");
                }}
              >
                Groep verlaten
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}



function groupByRound(matches: Match[]): { round: number; list: Match[] }[] {
  const map = new Map<number, Match[]>();
  for (const m of matches) {
    const r = m.round_number ?? 0;
    if (!map.has(r)) map.set(r, []);
    map.get(r)!.push(m);
  }
  return [...map.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([round, list]) => ({ round, list }));
}

export default GroupDetail;
