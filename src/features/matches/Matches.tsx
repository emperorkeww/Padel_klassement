import { useCallback, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { useAsync } from "../../lib/useAsync";
import { useRealtime } from "../../lib/useRealtime";
import { useToast } from "../../components/ToastProvider";
import { Skeleton } from "../../components/Skeleton";
import { outcomeFor } from "../../lib/results";
import { errorMessage } from "../../lib/errors";
import {
  getRecentMatches,
  getTeamsMap,
  createCompletedMatch,
} from "./api";
import { getAllProfiles, displayName } from "../profiles/api";
import { getMyFriendships, categorize, otherId } from "../friends/api";
import { MatchCard } from "./MatchList";
import type { Match, Profile, Team } from "../../lib/types";
import "./Matches.css";

type Filter = "all" | "mine" | "won" | "lost";

export function Matches() {
  const { user } = useAuth();
  const myId = user?.id ?? "";
  const [filter, setFilter] = useState<Filter>("all");

  const matches = useAsync(() => getRecentMatches(100), []);
  const teams = useAsync(getTeamsMap, []);
  const profiles = useAsync(getAllProfiles, []);
  const friendships = useAsync(getMyFriendships, []);

  const pmap = Object.fromEntries((profiles.data ?? []).map((p) => [p.id, p]));
  const tmap = useMemo(() => teams.data ?? {}, [teams.data]);

  // Alleen jezelf en je geaccepteerde vrienden zijn kiesbaar in het formulier.
  const { accepted } = categorize(friendships.data ?? [], myId);
  const selectablePlayers: Profile[] = [
    pmap[myId],
    ...accepted.map((f) => pmap[otherId(f, myId)]),
  ].filter(Boolean) as Profile[];

  const reloadAll = useCallback(() => {
    matches.reload();
    teams.reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches.reload, teams.reload]);
  useRealtime("matches", reloadAll);

  const filtered = useMemo(
    () => applyFilter(matches.data ?? [], tmap, myId, filter),
    [matches.data, tmap, myId, filter],
  );
  const groups = useMemo(() => groupByDay(filtered), [filtered]);

  return (
    <div>
      <header className="page-head">
        <h1 className="page-title">Matches</h1>
        <p className="page-subtitle">Log een uitslag of bekijk recente wedstrijden.</p>
      </header>

      <AddMatchForm players={selectablePlayers} onCreated={reloadAll} />

      <section className="card">
        <div className="row-between" style={{ marginBottom: "1rem" }}>
          <h2 className="card__title" style={{ margin: 0 }}>
            Recente matches
          </h2>
          <div className="tabs" style={{ marginBottom: 0 }}>
            {(
              [
                ["all", "Alles"],
                ["mine", "Met mij"],
                ["won", "Gewonnen"],
                ["lost", "Verloren"],
              ] as [Filter, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                className={`tab ${filter === key ? "is-active" : ""}`}
                onClick={() => setFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {matches.loading && <Skeleton rows={4} />}
        {matches.error && <p className="msg msg--error">{matches.error}</p>}
        {!matches.loading && groups.length === 0 && (
          <p className="empty">
            {filter === "all"
              ? "Nog geen matches."
              : "Geen matches voor dit filter."}
          </p>
        )}
        {!matches.loading &&
          groups.map(({ day, list }) => (
            <div key={day} className="match-day">
              <h3 className="match-day__title">{day}</h3>
              <ul className="matchlist">
                {list.map((m) => (
                  <li key={m.id}>
                    <MatchCard
                      match={m}
                      teams={tmap}
                      profiles={pmap}
                      perspectiveId={myId}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
      </section>
    </div>
  );
}

/* ---------- Filteren & groeperen ---------- */

function applyFilter(
  matches: Match[],
  teams: Record<string, Team>,
  myId: string,
  filter: Filter,
): Match[] {
  if (filter === "all") return matches;
  return matches.filter((m) => {
    const o = outcomeFor(m, teams, myId);
    if (filter === "mine") {
      // Ook geplande matches waarin ik meedoe.
      const mine =
        o !== null ||
        [teams[m.team_a_id], teams[m.team_b_id]].some(
          (t) => t && (t.player1_id === myId || t.player2_id === myId),
        );
      return mine;
    }
    if (filter === "won") return o === "W";
    return o === "L";
  });
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, today)) return "Vandaag";
  if (same(d, yesterday)) return "Gisteren";
  return d.toLocaleDateString("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function groupByDay(matches: Match[]): { day: string; list: Match[] }[] {
  const out: { day: string; list: Match[] }[] = [];
  for (const m of matches) {
    const day = dayLabel(m.played_at ?? m.created_at);
    const last = out[out.length - 1];
    if (last && last.day === day) last.list.push(m);
    else out.push({ day, list: [m] });
  }
  return out;
}

/* ---------- Formulier ---------- */

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
  const toast = useToast();

  const chosen = [a1, a2, b1, b2].filter(Boolean);
  const allChosen = chosen.length === 4;
  const distinct = new Set(chosen).size === chosen.length;

  const sa = scoreA === "" ? null : Number(scoreA);
  const sb = scoreB === "" ? null : Number(scoreB);
  const preview =
    sa !== null && sb !== null
      ? sa === sb
        ? "Gelijkspel — beide teams krijgen 1 punt."
        : `Team ${sa > sb ? "A" : "B"} wint en krijgt 3 punten.`
      : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!allChosen) return toast.error("Kies vier spelers.");
    if (!distinct)
      return toast.error("De vier spelers moeten verschillend zijn.");
    if (sa === null || sb === null) return toast.error("Vul de eindscore in.");

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
      toast.success("Match toegevoegd.");
      setA1("");
      setA2("");
      setB1("");
      setB2("");
      setScoreA("");
      setScoreB("");
      onCreated();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function swapTeams() {
    setA1(b1);
    setA2(b2);
    setB1(a1);
    setB2(a2);
    setScoreA(scoreB);
    setScoreB(scoreA);
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
      <form onSubmit={submit} className="stack match-form">
        <div className="match-teams">
          <div className="match-team">
            <span className="match-team__label">Team A</span>
            <PlayerSelect value={a1} onChange={setA1} options={opts([a2, b1, b2])} />
            <PlayerSelect value={a2} onChange={setA2} options={opts([a1, b1, b2])} />
          </div>
          <button
            type="button"
            className="btn btn--sm match-swap"
            onClick={swapTeams}
            title="Wissel team A en B"
            aria-label="Wissel team A en B"
          >
            ⇄
          </button>
          <div className="match-team">
            <span className="match-team__label">Team B</span>
            <PlayerSelect value={b1} onChange={setB1} options={opts([a1, a2, b2])} />
            <PlayerSelect value={b2} onChange={setB2} options={opts([a1, a2, b1])} />
          </div>
        </div>

        <label className="label">
          Eindscore
          <span className="match-score">
            <input
              className="input"
              type="number"
              min="0"
              placeholder="A"
              aria-label="Score team A"
              value={scoreA}
              onChange={(e) => setScoreA(e.target.value)}
            />
            <span className="matchlist__vs">–</span>
            <input
              className="input"
              type="number"
              min="0"
              placeholder="B"
              aria-label="Score team B"
              value={scoreB}
              onChange={(e) => setScoreB(e.target.value)}
            />
          </span>
          <span className="match-form__hint">
            {preview ??
              "De winnaar wordt bepaald door de hoogste score. Een gelijke score telt als gelijkspel."}
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