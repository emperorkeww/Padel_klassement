import { useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { useAsync } from "../../lib/useAsync";
import {
  getRecentMatches,
  getTeamsMap,
  createCompletedMatch,
} from "./api";
import { getAllProfiles, displayName } from "../profiles/api";
import { getMyFriendships, categorize, otherId } from "../friends/api";
import { MatchList } from "./MatchList";
import type { Profile } from "../../lib/types";

export function Matches() {
  const { user } = useAuth();
  const myId = user?.id ?? "";

  const matches = useAsync(getRecentMatches, []);
  const teams = useAsync(getTeamsMap, []);
  const profiles = useAsync(getAllProfiles, []);
  const friendships = useAsync(getMyFriendships, []);

  const pmap = Object.fromEntries((profiles.data ?? []).map((p) => [p.id, p]));
  const tmap = teams.data ?? {};

  // Alleen jezelf en je geaccepteerde vrienden zijn kiesbaar in het formulier.
  const { accepted } = categorize(friendships.data ?? [], myId);
  const selectablePlayers: Profile[] = [
    pmap[myId],
    ...accepted.map((f) => pmap[otherId(f, myId)]),
  ].filter(Boolean) as Profile[];

  function reloadAll() {
    matches.reload();
    teams.reload();
  }

  return (
    <div>
      <header className="page-head">
        <h1 className="page-title">Matches</h1>
        <p className="page-subtitle">Log een uitslag of bekijk recente wedstrijden.</p>
      </header>

      <AddMatchForm players={selectablePlayers} onCreated={reloadAll} />

      <section className="card">
        <h2 className="card__title">Recente matches</h2>
        {matches.loading && <p className="empty">Laden…</p>}
        {matches.error && <p className="msg msg--error">{matches.error}</p>}
        {!matches.loading && (
          <MatchList matches={matches.data ?? []} teams={tmap} profiles={pmap} />
        )}
      </section>
    </div>
  );
}

function AddMatchForm({
  players,
  onCreated,
}: {
  players: Profile[];
  onCreated: () => void;
}) {
  const [a1, setA1] = useState("");
  const [a2, setA2] = useState("");
  const [b1, setB1] = useState("");
  const [b2, setB2] = useState("");
  const [scoreA, setScoreA] = useState("");
  const [scoreB, setScoreB] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "error" | "success"; text: string } | null>(
    null,
  );

  const chosen = [a1, a2, b1, b2].filter(Boolean);
  const allChosen = chosen.length === 4;
  const distinct = new Set(chosen).size === chosen.length;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!allChosen) return setMsg({ type: "error", text: "Kies vier spelers." });
    if (!distinct)
      return setMsg({ type: "error", text: "De vier spelers moeten verschillend zijn." });

    const sa = scoreA === "" ? null : Number(scoreA);
    const sb = scoreB === "" ? null : Number(scoreB);
    if (sa === null || sb === null)
      return setMsg({ type: "error", text: "Vul de eindscore in." });

    // Winnaar volgt uit de score; een gelijke score is een gelijkspel.
    const winner: "a" | "b" | "draw" = sa === sb ? "draw" : sa > sb ? "a" : "b";

    setBusy(true);
    try {
      await createCompletedMatch({
        a1,
        a2,
        b1,
        b2,
        winner,
        scoreA: sa,
        scoreB: sb,
      });
      setMsg({ type: "success", text: "Match toegevoegd." });
      setA1("");
      setA2("");
      setB1("");
      setB2("");
      setScoreA("");
      setScoreB("");
      onCreated();
    } catch (err) {
      setMsg({ type: "error", text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  }

  const opts = (exclude: string[]) =>
    players
      .filter((p) => !exclude.includes(p.id))
      .map((p) => (
        <option key={p.id} value={p.id}>
          {displayName(p)}
        </option>
      ));

  return (
    <section className="card">
      <h2 className="card__title">Match toevoegen</h2>
      {players.length < 4 && (
        <p className="empty">
          Je kunt alleen jezelf en je vrienden toevoegen. Voeg eerst meer
          vrienden toe om een volledige match (4 spelers) te loggen.
        </p>
      )}
      {msg && <p className={`msg msg--${msg.type}`}>{msg.text}</p>}
      <form onSubmit={submit} className="stack">
        <div className="grid grid--2">
          <div className="stack">
            <strong>Team A</strong>
            <PlayerSelect value={a1} onChange={setA1} options={opts([a2, b1, b2])} />
            <PlayerSelect value={a2} onChange={setA2} options={opts([a1, b1, b2])} />
          </div>
          <div className="stack">
            <strong>Team B</strong>
            <PlayerSelect value={b1} onChange={setB1} options={opts([a1, a2, b2])} />
            <PlayerSelect value={b2} onChange={setB2} options={opts([a1, a2, b1])} />
          </div>
        </div>

        <label className="label">
          Eindscore
          <span style={{ display: "flex", gap: "0.5rem", alignItems: "center", maxWidth: 240 }}>
            <input
              className="input"
              type="number"
              min="0"
              placeholder="Team A"
              aria-label="Score team A"
              value={scoreA}
              onChange={(e) => setScoreA(e.target.value)}
            />
            <span className="matchlist__vs">–</span>
            <input
              className="input"
              type="number"
              min="0"
              placeholder="Team B"
              aria-label="Score team B"
              value={scoreB}
              onChange={(e) => setScoreB(e.target.value)}
            />
          </span>
          <span className="page-subtitle" style={{ fontSize: "0.8rem" }}>
            De winnaar wordt bepaald door de hoogste score. Een gelijke score
            telt als gelijkspel.
          </span>
        </label>

        <div>
          <button className="btn btn--primary" disabled={busy}>
            {busy ? "Opslaan…" : "Match opslaan"}
          </button>
        </div>
      </form>
    </section>
  );
}

function PlayerSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: React.ReactNode;
}) {
  return (
    <select
      className="select"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">— kies speler —</option>
      {options}
    </select>
  );
}

export default Matches;
