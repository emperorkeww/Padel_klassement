import { useCallback, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { useAsync } from "../../lib/useAsync";
import { useRealtime } from "../../lib/useRealtime";
import { useToast } from "../../components/ToastProvider";
import { MatchListSkeleton, Skeleton } from "../../components/Skeleton";
import {
  getGroup,
  getGroupMembers,
  addGroupMember,
  removeGroupMember,
  generateAmericanoRound,
  generateMexicanoRound,
} from "./api";
import { getGroupMatches, getTeamsMap } from "../matches/api";
import { getGroupPlayerStandings } from "../standings/api";
import { getProfilesMap, displayName } from "../profiles/api";
import { getMyFriendships, categorize, otherId } from "../friends/api";
import { Avatar } from "../../components/Avatar";
import { MatchCard } from "../matches/MatchList";
import { PlannedMatchCard } from "../matches/PlannedMatchCard";
import { AttendanceCard } from "./AttendanceCard";
import { ShareEvening } from "./ShareEvening";
import { errorMessage } from "../../lib/errors";
import type { Match } from "../../lib/types";
import "./GroupDetail.css";

type View = "rondes" | "stand" | "leden";

export function GroupDetail() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const myId = user?.id ?? "";

  const group = useAsync(() => getGroup(id), [id]);
  const members = useAsync(() => getGroupMembers(id), [id]);
  const matches = useAsync(() => getGroupMatches(id), [id]);
  const standings = useAsync(() => getGroupPlayerStandings(id), [id]);
  const profiles = useAsync(getProfilesMap, []);
  const teams = useAsync(getTeamsMap, []);
  const friendships = useAsync(getMyFriendships, []);

  const onMatches = useCallback(() => {
    matches.reload();
    standings.reload();
    teams.reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches.reload, standings.reload, teams.reload]);
  // Alleen reageren op wijzigingen binnen déze groep, niet op elke match
  // die ergens anders wordt gelogd.
  useRealtime("matches", onMatches, `group_id=eq.${id}`);
  useRealtime("group_members", members.reload, `group_id=eq.${id}`);

  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<View>("rondes");
  const [mode, setMode] = useState<"americano" | "mexicano">("americano");
  const [roundsToGen, setRoundsToGen] = useState(1);

  const pmap = profiles.data ?? {};
  const tmap = teams.data ?? {};
  const memberList = members.data ?? [];
  const isOwner = group.data?.created_by === myId;

  const memberIds = new Set(memberList.map((m) => m.player_id));
  const { accepted } = categorize(friendships.data ?? [], myId);
  const addableFriendIds = accepted
    .map((f) => otherId(f, myId))
    .filter((pid) => !memberIds.has(pid));

  async function act(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      members.reload();
      matches.reload();
      standings.reload();
      teams.reload();
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
        </button>
      </div>

      {view === "rondes" && (
        <AttendanceCard
          groupId={id}
          members={memberList}
          profiles={pmap}
          myId={myId}
        />
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
              ? "Americano: verdeelt de leden willekeurig in teams en wedstrijden."
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
                      // Meerdere rondes in één keer: elke ronde krijgt een verse
                      // willekeurige indeling. Sequentieel zodat de rondenummers
                      // netjes oplopen.
                      for (let i = 0; i < roundsToGen; i++) {
                        const ids = await generateAmericanoRound(id);
                        total += ids.length;
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
          {memberList.length < 4 && (
            <p className="empty">
              Minimaal 4 leden nodig om een ronde te genereren.
            </p>
          )}
          {memberList.length >= 4 && mexicanoBlocked && (
            <p className="empty">
              Vul eerst alle uitslagen van ronde {openRound!.round} in — Mexicano
              paart op basis van de volledige stand.
            </p>
          )}

          {rounds.length === 0 && (
            <p className="empty">Nog geen rondes. Genereer er hierboven een.</p>
          )}

          <div className="stack">
            {rounds.map(({ round, list }) => {
              const done = list.filter((m) => m.status === "completed").length;
              return (
                <div key={round}>
                  <div className="round-head">
                    <h3 className="card__title card__title--compact">
                      Ronde {round}
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
                        <MatchCard
                          key={m.id}
                          match={m}
                          teams={tmap}
                          profiles={pmap}
                          perspectiveId={myId}
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
        </section>
      )}

      {view === "stand" && (
        <section className="card">
          <h2 className="card__title">Groepsklassement</h2>
          {(standings.data ?? []).length === 0 ? (
            <p className="empty">Nog geen afgeronde matches in deze groep.</p>
          ) : (
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
                {(standings.data ?? []).map((p, i) => (
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
          <div className="stack">
            {memberList.map((m) => (
              <div key={m.player_id} className="row-between">
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
                Vriend toevoegen
              </h3>
              {addableFriendIds.length === 0 ? (
                <p className="empty">
                  Geen vrienden om toe te voegen. Voeg eerst vrienden toe.
                </p>
              ) : (
                <div className="stack">
                  {addableFriendIds.map((pid) => (
                    <div key={pid} className="row-between">
                      <span className="cell-player">
                        <Avatar profile={pmap[pid]} size={28} />
                        {displayName(pmap[pid])}
                      </span>
                      <button
                        className="btn btn--sm"
                        disabled={busy}
                        onClick={() =>
                          act(() => addGroupMember(id, pid), "Lid toegevoegd.")
                        }
                      >
                        Toevoegen
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
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
              De leden worden <strong>willekeurig</strong> in teams en
              wedstrijden verdeeld. Elke ronde wisselt van partner, ongeacht de
              stand. Gezellig en gelijk verdeeld — ideaal voor een ontspannen
              avond.
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
