import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../features/auth/AuthProvider";
import { useAsync } from "../lib/useAsync";
import {
  getGroup,
  getGroupMembers,
  addGroupMember,
  removeGroupMember,
  generateAmericanoRound,
} from "../features/groups/api";
import {
  getGroupMatches,
  getTeamsMap,
  setMatchResult,
  teamLabel,
} from "../features/matches/api";
import { getGroupPlayerStandings } from "../features/standings/api";
import { getProfilesMap, displayName } from "../features/profiles/api";
import {
  getMyFriendships,
  categorize,
  otherId,
} from "../features/friends/api";
import type { Match } from "../lib/types";

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

  const [msg, setMsg] = useState<{ type: "error" | "success"; text: string } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);

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
    setMsg(null);
    setBusy(true);
    try {
      await fn();
      setMsg({ type: "success", text: ok });
      members.reload();
      matches.reload();
      standings.reload();
      teams.reload();
    } catch (err) {
      setMsg({ type: "error", text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  }

  // matches per ronde (aflopend)
  const rounds = groupByRound(matches.data ?? []);

  if (group.loading) return <p className="empty">Laden…</p>;
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

      {msg && <p className={`msg msg--${msg.type}`}>{msg.text}</p>}

      <div className="grid grid--2">
        <section className="card">
          <h2 className="card__title">Leden</h2>
          <div className="stack">
            {memberList.map((m) => (
              <div key={m.player_id} className="row-between">
                <span>
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
                      <span>{displayName(pmap[pid])}</span>
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
                  <th className="num">Ptn</th>
                </tr>
              </thead>
              <tbody>
                {(standings.data ?? []).map((p) => (
                  <tr key={p.player_id} className={p.player_id === myId ? "is-me" : ""}>
                    <td>{displayName(p)}</td>
                    <td className="num">{p.played}</td>
                    <td className="num">{p.won}</td>
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
        <div className="row-between">
          <div>
            <h2 className="card__title" style={{ margin: 0 }}>
              Wedstrijdrondes
            </h2>
            <p className="page-subtitle" style={{ marginTop: "0.25rem" }}>
              Verdeelt de leden willekeurig in teams en wedstrijden.
            </p>
          </div>
          <button
            className="btn btn--primary"
            disabled={busy || memberList.length < 4}
            onClick={() =>
              act(async () => {
                const ids = await generateAmericanoRound(id);
                if (ids.length === 0) throw new Error("Geen wedstrijden gegenereerd.");
              }, "Nieuwe ronde gegenereerd.")
            }
          >
            Genereer ronde
          </button>
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
                {list.map((m) => (
                  <MatchRow
                    key={m.id}
                    match={m}
                    labelA={teamLabel(tmap[m.team_a_id], pmap)}
                    labelB={teamLabel(tmap[m.team_b_id], pmap)}
                    busy={busy}
                    onResult={(winner, sa, sb) =>
                      act(
                        () =>
                          setMatchResult({
                            matchId: m.id,
                            winnerTeamId: winner === "a" ? m.team_a_id : m.team_b_id,
                            scoreA: sa,
                            scoreB: sb,
                          }),
                        "Resultaat opgeslagen.",
                      )
                    }
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function MatchRow({
  match,
  labelA,
  labelB,
  busy,
  onResult,
}: {
  match: Match;
  labelA: string;
  labelB: string;
  busy: boolean;
  onResult: (winner: "a" | "b", scoreA: number | null, scoreB: number | null) => void;
}) {
  const [sa, setSa] = useState("");
  const [sb, setSb] = useState("");

  const done = match.status === "completed";
  const aWon = match.winner_team_id === match.team_a_id;
  const scored = match.score_a != null && match.score_b != null;

  // Winnaar volgt uit de score; gelijkspel kan niet.
  const saNum = sa === "" ? null : Number(sa);
  const sbNum = sb === "" ? null : Number(sb);
  const bothFilled = saNum !== null && sbNum !== null;
  const tie = bothFilled && saNum === sbNum;
  const valid = bothFilled && !tie;

  // Afgeronde match: klikbare rij naar de detailpagina.
  if (done) {
    return (
      <Link className="matchlist__item" to={`/matches/${match.id}`}>
        <span className="matchlist__teams">
          <span className={`matchlist__team ${aWon ? "is-win" : ""}`}>{labelA}</span>
          <span className="matchlist__vs">
            {scored ? `${match.score_a}–${match.score_b}` : "vs"}
          </span>
          <span className={`matchlist__team ${!aWon ? "is-win" : ""}`}>{labelB}</span>
        </span>
        <span className="matchlist__meta">
          <span className="badge">details →</span>
        </span>
      </Link>
    );
  }

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
        {tie && <span className="result-row__hint">Gelijkspel kan niet</span>}
        <button
          className="btn btn--primary btn--sm"
          disabled={busy || !valid}
          onClick={() => onResult(saNum! > sbNum! ? "a" : "b", saNum, sbNum)}
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
