import { useCallback, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { useAsync } from "../../lib/useAsync";
import { useRealtime } from "../../lib/useRealtime";
import { MatchListSkeleton } from "../../components/Skeleton";
import { outcomeFor } from "../../lib/results";
import { getRecentMatches, getTeamsMap } from "./api";
import { getAllProfiles } from "../profiles/api";
import { getMyFriendships, categorize, otherId } from "../friends/api";
import { MatchCard } from "./MatchList";
import { PlannedMatchCard } from "./PlannedMatchCard";
import { NewMatchSheet } from "./NewMatchSheet";
import type { Match, Profile, Team } from "../../lib/types";
import "./Matches.css";

type Filter = "all" | "mine" | "won" | "lost";

export function Matches() {
  const { user } = useAuth();
  const myId = user?.id ?? "";
  const [filter, setFilter] = useState<Filter>("all");
  const [sheetOpen, setSheetOpen] = useState(false);

  const matches = useAsync(() => getRecentMatches(100), []);
  const teams = useAsync(getTeamsMap, []);
  const profiles = useAsync(getAllProfiles, []);
  const friendships = useAsync(getMyFriendships, []);

  const pmap = Object.fromEntries((profiles.data ?? []).map((p) => [p.id, p]));
  const tmap = useMemo(() => teams.data ?? {}, [teams.data]);

  // Alleen jezelf en je geaccepteerde vrienden zijn kiesbaar in de wizard.
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

  // Geplande matches waarin ik meedoe: bovenaan met inline score-invoer.
  const plannedMine = useMemo(
    () =>
      (matches.data ?? []).filter(
        (m) =>
          m.status !== "completed" &&
          [tmap[m.team_a_id], tmap[m.team_b_id]].some(
            (t) => t && (t.player1_id === myId || t.player2_id === myId),
          ),
      ),
    [matches.data, tmap, myId],
  );
  const plannedIds = useMemo(
    () => new Set(plannedMine.map((m) => m.id)),
    [plannedMine],
  );

  const filtered = useMemo(
    () =>
      applyFilter(matches.data ?? [], tmap, myId, filter).filter(
        (m) => !plannedIds.has(m.id),
      ),
    [matches.data, tmap, myId, filter, plannedIds],
  );
  const groups = useMemo(() => groupByDay(filtered), [filtered]);

  return (
    <div>
      <header className="page-head">
        <div className="row-between">
          <div>
            <h1 className="page-title">Matches</h1>
            <p className="page-subtitle">
              Log een uitslag of bekijk recente wedstrijden.
            </p>
          </div>
          <button
            className="btn btn--primary"
            onClick={() => setSheetOpen(true)}
          >
            + Match loggen
          </button>
        </div>
      </header>

      {plannedMine.length > 0 && (
        <section className="card">
          <div className="card__head">
            <h2 className="card__title">Te spelen</h2>
            <span className="badge badge--accent">{plannedMine.length}</span>
          </div>
          <div className="stack">
            {plannedMine.map((m) => (
              <PlannedMatchCard
                key={m.id}
                match={m}
                teams={tmap}
                profiles={pmap}
                perspectiveId={myId}
                onSaved={reloadAll}
              />
            ))}
          </div>
        </section>
      )}

      <section className="card">
        <div className="card__head">
          <h2 className="card__title">Recente matches</h2>
          <div className="tabs">
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

        {matches.loading && <MatchListSkeleton count={4} />}
        {matches.error && <p className="msg msg--error">{matches.error}</p>}
        {!matches.loading && groups.length === 0 && (
          <div className="empty-state">
            <p className="empty-state__title">
              {filter === "all"
                ? "Nog geen matches."
                : "Geen matches voor dit filter."}
            </p>
            {filter === "all" && (
              <button
                className="btn btn--primary btn--sm"
                onClick={() => setSheetOpen(true)}
              >
                + Log je eerste match
              </button>
            )}
          </div>
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

      <NewMatchSheet
        open={sheetOpen}
        players={selectablePlayers}
        onClose={() => setSheetOpen(false)}
        onCreated={reloadAll}
      />
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

export default Matches;
