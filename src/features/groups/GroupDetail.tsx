import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { useAsync } from "../../lib/useAsync";
import { useRealtime } from "../../lib/useRealtime";
import { useToast } from "../../components/ToastProvider";
import { MatchListSkeleton, Skeleton } from "../../components/Skeleton";
import {
  getGroup,
  getGroupMembers,
  addGroupMembers,
  removeGroupMember,
  renameGroup,
  deleteGroup,
  leaveGroup,
  createGroupInvite,
  createFairRound,
  generateMexicanoRound,
} from "./api";
import {
  americanoRound,
  applyRound,
  historyFromMatches,
} from "../../lib/americano";
import { getGroupMatches, getTeamsMap, createGuestPlayer } from "../matches/api";
import { getGroupPlayerStandings } from "../standings/api";
import { getPlayerRatings, getAllRatingHistories } from "../standings/ratingsApi";
import { Sparkline } from "../../components/Sparkline";
import { groupRatingStandings, playedInGroup } from "./groupRating";
import { getProfilesMap, displayName } from "../profiles/api";
import { getMyFriendships, categorize, otherId } from "../friends/api";
import { Avatar } from "../../components/Avatar";
import { DeletableMatchCard } from "../matches/MatchList";
import { PlannedMatchCard } from "../matches/PlannedMatchCard";
import { NewMatchSheet, type NewMatchMode } from "../matches/NewMatchSheet";
import { PollSection } from "./PlanPoll";
import { SuggestionsCard } from "./SuggestionsCard";
import { Tonight } from "./Tonight";
import { ShareEvening } from "./ShareEvening";
import { ShareChampion } from "../standings/ShareChampion";
import { computePlayerStandings, matchesInSeason } from "../../lib/standings";
import {
  isSeasonClosed,
  listSeasons,
  seasonFromId,
} from "../../lib/seasons";
import { errorMessage } from "../../lib/errors";
import type { Match, PlayerStanding, Profile } from "../../lib/types";
import "./GroupDetail.css";

type View = "rondes" | "plannen" | "stand" | "leden";

export function GroupDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const myId = user?.id ?? "";

  const group = useAsync(() => getGroup(id), [id]);
  const members = useAsync(() => getGroupMembers(id), [id]);
  const matches = useAsync(() => getGroupMatches(id), [id]);
  const standings = useAsync(() => getGroupPlayerStandings(id), [id]);
  const profiles = useAsync(getProfilesMap, []);
  const teams = useAsync(getTeamsMap, []);
  const friendships = useAsync(getMyFriendships, []);

  // Voor het rating-klassement op de Stand-tab (#52).
  const ratings = useAsync(getPlayerRatings, []);
  const histories = useAsync(getAllRatingHistories, []);

  const onMatches = useCallback(() => {
    matches.reload();
    standings.reload();
    teams.reload();
    ratings.reload();
    histories.reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches.reload, standings.reload, teams.reload, ratings.reload, histories.reload]);
  // Alleen reageren op wijzigingen binnen déze groep, niet op elke match
  // die ergens anders wordt gelogd.
  useRealtime("matches", onMatches, `group_id=eq.${id}`);
  useRealtime("group_members", members.reload, `group_id=eq.${id}`);

  const toast = useToast();
  const [busy, setBusy] = useState(false);
  // De actieve tab leeft in de URL: refresh-bestendig en deelbaar
  // ("kijk even bij de stand").
  const [params, setParams] = useSearchParams();
  const rawTab = params.get("tab");
  const view: View =
    rawTab === "stand" || rawTab === "leden" || rawTab === "plannen"
      ? rawTab
      : "rondes";
  const setView = (v: View) => {
    const next = new URLSearchParams(params);
    if (v === "rondes") next.delete("tab");
    else next.set("tab", v);
    setParams(next, { replace: true });
  };
  const [mode, setMode] = useState<"americano" | "mexicano">("americano");
  const [roundsToGen, setRoundsToGen] = useState(1);
  // Losse match loggen/plannen binnen de groep (telt mee in stand + avondsamenvatting).
  const [logOpen, setLogOpen] = useState(false);
  const [logMode, setLogMode] = useState<NewMatchMode>("score");
  // Stand-tab: rating is de standaard (#52); de punten-weergave blijft als
  // toggle tot eendaagse tornooien (#124) die rol overnemen — dan kan hij weg.
  const [standMode, setStandMode] = useState<"rating" | "punten">("rating");
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

  const pmap = profiles.data ?? {};
  const tmap = teams.data ?? {};
  const memberList = members.data ?? [];
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

  // matches per ronde (aflopend)
  const rounds = groupByRound(matches.data ?? []);
  // Mexicano paart op de stand: pas mogelijk als de vorige ronde compleet is.
  const openRound = rounds.find(({ list }) =>
    list.some((m) => m.status !== "completed"),
  );
  const mexicanoBlocked = mode === "mexicano" && !!openRound;

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
          <Link className="btn btn--sm" to="/groepen">
            ← Alle groepen
          </Link>
        </div>
        <p className="page-subtitle">
          {memberList.length} leden{isOwner ? " · jij bent eigenaar" : ""}
        </p>
      </header>

      <div className="tabs">
        <button
          className={`tab ${view === "rondes" ? "is-active" : ""}`}
          onClick={() => setView("rondes")}
        >
          Rondes
          {rounds.length > 0 && (
            <span className="tab__count" aria-hidden="true">
              {rounds.length}
            </span>
          )}
        </button>
        <button
          className={`tab ${view === "plannen" ? "is-active" : ""}`}
          onClick={() => setView("plannen")}
        >
          Plannen
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
          {/* Suggesties (beste momenten komende week) vervangen de vroegere
              aanwezigheids-RSVP; "Vanavond" voedt de teamgenerator met de
              deelnemers van het speelvoorstel van vandaag. */}
          <SuggestionsCard groupId={id} myId={myId} matches={matches.data ?? []} />
          <Tonight
            groupId={id}
            members={memberList}
            profiles={pmap}
            myId={myId}
          />
        </>
      )}

      {view === "rondes" && (
        <section className="card">
          <div className="card__head">
            <h2 className="card__title card__title--tight">Wedstrijdrondes</h2>
            {/* Verschijnt zodra er vanavond een uitslag is: poster voor de groepschat. */}
            <ShareEvening
              groupName={group.data.name}
              matches={matches.data ?? []}
              teams={tmap}
              profiles={pmap}
            />
          </div>
          <p className="card__subtitle">
            {mode === "americano"
              ? "Americano: wisselt de teams elke ronde af, zodat je zo veel mogelijk met en tegen verschillende spelers speelt."
              : "Mexicano: paart op basis van de stand — sterk speelt met zwak, tegen een gelijkwaardig duo."}
          </p>

          <SpelvormUitleg />

          <div className="toolbar">
            <div className="tabs">
              <button
                className={`tab ${mode === "americano" ? "is-active" : ""}`}
                onClick={() => setMode("americano")}
              >
                Americano
              </button>
              <button
                className={`tab ${mode === "mexicano" ? "is-active" : ""}`}
                onClick={() => setMode("mexicano")}
              >
                Mexicano
              </button>
            </div>
            <div className="gen-controls">
              {mode === "americano" && (
                <label className="gen-controls__rounds">
                  <span>Rondes</span>
                  <select
                    className="select"
                    value={roundsToGen}
                    onChange={(e) => setRoundsToGen(Number(e.target.value))}
                  >
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <button
                className="btn btn--primary"
                disabled={busy || memberList.length < 4 || mexicanoBlocked}
                onClick={() =>
                  act(async () => {
                    let total = 0;
                    if (mode === "americano") {
                      // Geschiedenis-bewuste indeling: laat partners (en
                      // tegenstanders) zo veel mogelijk wisselen op basis van de
                      // eerdere rondes. Sequentieel zodat de rondenummers oplopen;
                      // elke nieuwe ronde telt meteen mee voor de volgende.
                      const history = historyFromMatches(matches.data ?? [], tmap);
                      const memberIds = memberList.map((m) => m.player_id);
                      for (let i = 0; i < roundsToGen; i++) {
                        const { courts } = americanoRound(memberIds, history);
                        if (courts.length === 0) break;
                        const ids = await createFairRound(id, courts);
                        total += ids.length;
                        applyRound(history, courts);
                      }
                    } else {
                      const ids = await generateMexicanoRound(id);
                      total = ids.length;
                    }
                    if (total === 0) throw new Error("Geen wedstrijden gegenereerd.");
                  }, generatedMessage(mode, roundsToGen))
                }
              >
                {mode === "americano"
                  ? roundsToGen === 1
                    ? "Genereer Americano-ronde"
                    : `Genereer ${roundsToGen} Americano-rondes`
                  : "Genereer Mexicano-ronde"}
              </button>
            </div>
          </div>

          <div className="group-log">
            <p className="group-log__hint">
              Zelf een partij gespeeld? Log 'm hier — hij telt mee in de
              groepsstand en de avondsamenvatting.
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

          {memberList.length < 4 && (
            <p className="msg msg--warn">
              Minimaal 4 leden nodig om een ronde te genereren.
            </p>
          )}
          {memberList.length >= 4 && mexicanoBlocked && (
            <p className="msg msg--warn">
              Vul eerst alle uitslagen van ronde {openRound!.round} in — Mexicano
              paart op basis van de volledige stand.
            </p>
          )}

          {rounds.length === 0 && (
            <p className="empty">Nog geen rondes. Genereer er hierboven een.</p>
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
                          onSaved={onMatches}
                        />
                      ),
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <NewMatchSheet
            open={logOpen}
            players={groupPlayers}
            mode={logMode}
            groupId={id}
            onClose={() => setLogOpen(false)}
            onCreated={onMatches}
            onGuestCreated={profiles.reload}
          />
        </section>
      )}

      {view === "plannen" && (
        <PollSection
          groupId={id}
          groupName={group.data.name}
          members={memberList}
          profiles={pmap}
          myId={myId}
          isOwner={isOwner}
        />
      )}

      {view === "stand" && (
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
                return (
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
                      {rows.map((r, i) => {
                        const hist = histories.data?.[r.playerId] ?? [];
                        const last = hist[hist.length - 1];
                        return (
                          <tr
                            key={r.playerId}
                            className={`${r.playerId === myId ? "is-me" : ""}${r.thin ? " rating-thin" : ""}`}
                          >
                            <td>
                              <span className="cell-player">
                                <span className={`rank rank--${i + 1}`}>{i + 1}</span>
                                <Avatar profile={pmap[r.playerId]} size={24} />
                                {displayName(pmap[r.playerId])}
                              </span>
                            </td>
                            <td className="num">
                              {r.rating != null ? (
                                <span className="rating-wrap">
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
                                <span className="rating-none">nog geen matches</span>
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
                );
              })()}
            </>
          )}

          {standMode === "punten" && seasons.length > 0 && (
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
                {shownStandings.map((p, i) => (
                  <tr
                    key={p.player_id}
                    className={p.player_id === myId ? "is-me" : ""}
                  >
                    <td>
                      <span className="cell-player">
                        <span className={`rank rank--${i + 1}`}>{i + 1}</span>
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
        </section>
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
              <div>
                <button
                  className="btn btn--danger btn--sm"
                  disabled={busy}
                  onClick={() => {
                    if (
                      !window.confirm(
                        "Deze groep en al zijn rondes verwijderen? Dit kan niet ongedaan worden gemaakt.",
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

function generatedMessage(mode: "americano" | "mexicano", rounds: number): string {
  if (mode === "mexicano") return "Nieuwe Mexicano-ronde gegenereerd.";
  return rounds === 1
    ? "Nieuwe Americano-ronde gegenereerd."
    : `${rounds} Americano-rondes gegenereerd.`;
}

function SpelvormUitleg() {
  return (
    <details className="explainer">
      <summary>Americano of Mexicano — wat is het verschil?</summary>
      <div className="explainer__body">
        <dl>
          <div>
            <dt>Americano</dt>
            <dd>
              Elke ronde krijg je een <strong>andere partner</strong> en andere
              tegenstanders: de indeling houdt rekening met eerdere rondes zodat
              je zo veel mogelijk met en tegen verschillende spelers speelt,
              ongeacht de stand. Gezellig en gelijk verdeeld — ideaal voor een
              ontspannen avond.
            </dd>
          </div>
          <div>
            <dt>Mexicano</dt>
            <dd>
              De volgende ronde wordt <strong>op basis van de stand</strong>{" "}
              gemaakt: spelers worden gerangschikt op punten (en saldo), en per
              baan speelt de <strong>1e met de 4e</strong> tegen de{" "}
              <strong>2e met de 3e</strong>. Zo blijven de wedstrijden spannend en
              in balans. Je kunt pas een nieuwe Mexicano-ronde genereren als{" "}
              <strong>alle uitslagen</strong> van de vorige ronde zijn ingevuld —
              anders zou er op een halve stand gepaird worden.
            </dd>
          </div>
        </dl>
      </div>
    </details>
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
