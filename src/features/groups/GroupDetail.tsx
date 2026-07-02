import { useCallback, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { useAsync } from "../../lib/useAsync";
import { useRealtime } from "../../lib/useRealtime";
import { useToast } from "../../components/ToastProvider";
import { Skeleton } from "../../components/Skeleton";
import {
  getGroup,
  getGroupMembers,
  addGroupMember,
  removeGroupMember,
  generateAmericanoRound,
  generateMexicanoRound,
} from "./api";
import {
  getGroupMatches,
  getTeamsMap,
  setMatchResult,
  teamLabel,
} from "../matches/api";
import { getGroupPlayerStandings } from "../standings/api";
import { getProfilesMap, displayName } from "../profiles/api";
import {
  getMyFriendships,
  categorize,
  otherId,
} from "../friends/api";
import { Avatar } from "../../components/Avatar";
import { MatchCard } from "../matches/MatchList";
import { errorMessage } from "../../lib/errors";
import type { Match } from "../../lib/types";

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
  useRealtime("matches", onMatches);
  useRealtime("group_members", members.reload);

  const toast = useToast();
  const [busy, setBusy] = useState(false);
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

  if (group.loading)
    return (
      <div className="card">
        <Skeleton rows={4} />
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

      <div className="grid grid--2">
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
                      act(() => removeGroupMember(id, m.player_id), "Lid verwijderd.")
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
              <h3 className="card__title" style={{ marginTop: "1.25rem" }}>
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
                {(standings.data ?? []).map((p) => (
                  <tr key={p.player_id} className={p.player_id === myId ? "is-me" : ""}>
                    <td>
                      <span className="cell-player">
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
      </div>

      <section className="card">
        <h2 className="card__title" style={{ marginBottom: "0.25rem" }}>
          Wedstrijdrondes
        </h2>
        <p className="page-subtitle" style={{ marginBottom: "1rem" }}>
          {mode === "americano"
            ? "Americano: verdeelt de leden willekeurig in teams en wedstrijden."
            : "Mexicano: paart op basis van de stand — sterk speelt met zwak, tegen een gelijkwaardig duo."}
        </p>

        <SpelvormUitleg />

        <div className="row-between" style={{ marginTop: "1rem", flexWrap: "wrap", gap: "0.75rem" }}>
          <div className="tabs" style={{ marginBottom: 0 }}>
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
              disabled={busy || memberList.length < 4}
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
          <p className="empty">Minimaal 4 leden nodig om een ronde te genereren.</p>
        )}

        {rounds.length === 0 && (
          <p className="empty">Nog geen rondes. Genereer er hierboven een.</p>
        )}

        <div className="stack" style={{ marginTop: "1rem" }}>
          {rounds.map(({ round, list }) => (
            <div key={round}>
              <h3 className="card__title" style={{ marginBottom: "0.5rem" }}>
                Ronde {round}
              </h3>
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
                    <MatchRow
                      key={m.id}
                      labelA={teamLabel(tmap[m.team_a_id], pmap)}
                      labelB={teamLabel(tmap[m.team_b_id], pmap)}
                      busy={busy}
                      onResult={(winner, sa, sb) =>
                        act(
                          () =>
                            setMatchResult({
                              matchId: m.id,
                              winnerTeamId:
                                winner === "a"
                                  ? m.team_a_id
                                  : winner === "b"
                                    ? m.team_b_id
                                    : null,
                              scoreA: sa,
                              scoreB: sb,
                            }),
                          "Resultaat opgeslagen.",
                        )
                      }
                    />
                  ),
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
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
    <details className="explainer" style={{ marginBottom: 0 }}>
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

function MatchRow({
  labelA,
  labelB,
  busy,
  onResult,
}: {
  labelA: string;
  labelB: string;
  busy: boolean;
  onResult: (
    winner: "a" | "b" | "draw",
    scoreA: number | null,
    scoreB: number | null,
  ) => void;
}) {
  const [sa, setSa] = useState("");
  const [sb, setSb] = useState("");

  // Winnaar volgt uit de score; een gelijke score is een gelijkspel.
  const saNum = sa === "" ? null : Number(sa);
  const sbNum = sb === "" ? null : Number(sb);
  const valid = saNum !== null && sbNum !== null;

  // Geplande match: alleen de score invoeren, winnaar volgt automatisch.
  return (
    <div className="result-row">
      <span className="result-row__teams">
        {labelA} <span className="matchlist__vs">vs</span> {labelB}
      </span>
      <span className="result-row__form">
        <input
          className="input"
          style={{ width: 56 }}
          type="number"
          min="0"
          placeholder="A"
          aria-label={`Score ${labelA}`}
          value={sa}
          onChange={(e) => setSa(e.target.value)}
        />
        <span className="matchlist__vs">–</span>
        <input
          className="input"
          style={{ width: 56 }}
          type="number"
          min="0"
          placeholder="B"
          aria-label={`Score ${labelB}`}
          value={sb}
          onChange={(e) => setSb(e.target.value)}
        />
        <button
          className="btn btn--primary btn--sm"
          disabled={busy || !valid}
          onClick={() =>
            onResult(
              saNum === sbNum ? "draw" : saNum! > sbNum! ? "a" : "b",
              saNum,
              sbNum,
            )
          }
        >
          Opslaan
        </button>
      </span>
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
