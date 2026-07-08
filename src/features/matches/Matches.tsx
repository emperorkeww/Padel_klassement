import { useCallback, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { useAsync } from "../../lib/useAsync";
import { useRealtime } from "../../lib/useRealtime";
import { MatchListSkeleton } from "../../components/Skeleton";
import { EmptyState } from "../../components/EmptyState";
import { outcomeFor } from "../../lib/results";
import { getRecentMatches, getTeamsMap } from "./api";
import { getAllProfiles } from "../profiles/api";
import { getMyFriendships, categorize, otherId } from "../friends/api";
import { DeletableMatchCard } from "./MatchList";
import { PlannedMatchCard } from "./PlannedMatchCard";
import { NewMatchSheet, type NewMatchMode } from "./NewMatchSheet";
import type { Match, Profile, Team } from "../../lib/types";
import "./Matches.css";

type Filter = "all" | "mine" | "won" | "lost";

export function Matches() {
  const { user } = useAuth();
  const myId = user?.id ?? "";
  const [filter, setFilter] = useState<Filter>("all");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<NewMatchMode>("score");

  function openSheet(mode: NewMatchMode) {
    setSheetMode(mode);
    setSheetOpen(true);
  }

  const matches = useAsync(() => getRecentMatches(100), []);
  const teams = useAsync(getTeamsMap, []);
  const profiles = useAsync(getAllProfiles, []);
  const friendships = useAsync(getMyFriendships, []);

  const pmap = Object.fromEntries((profiles.data ?? []).map((p) => [p.id, p]));
  const tmap = useMemo(() => teams.data ?? {}, [teams.data]);

  // Kiesbaar in de wizard: jezelf, je geaccepteerde vrienden en je eigen
  // gastspelers (naamloze deelnemers zonder account, door jou aangemaakt).
  const { accepted } = categorize(friendships.data ?? [], myId);
  const myGuests = (profiles.data ?? []).filter(
    (p) => (p as { is_guest?: boolean }).is_guest &&
      (p as { owner_id?: string }).owner_id === myId,
  );
  const selectablePlayers: Profile[] = [
    pmap[myId],
    ...accepted.map((f) => pmap[otherId(f, myId)]),
    ...myGuests,
  ].filter(Boolean) as Profile[];

  const reloadAll = useCallback(() => {
    matches.reload();
    teams.reload();
    profiles.reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches.reload, teams.reload, profiles.reload]);
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
  // Sorteer op de dag die het dagkopje bepaalt (played_at, anders created_at)
  // vóór het groeperen. De lijst zelf komt op created_at binnen, dus zonder deze
  // sortering raken afgeronde matches met een afwijkende speeldatum verspreid
  // over meerdere losse dagkopjes.
  const groups = useMemo(() => {
    const sorted = [...filtered].sort(
      (a, b) =>
        new Date(b.played_at ?? b.created_at).getTime() -
        new Date(a.played_at ?? a.created_at).getTime(),
    );
    return groupByDay(sorted);
  }, [filtered]);

  // Tellers per filtertab, zodat je zonder klikken ziet wat elk filter oplevert.
  const counts = useMemo(() => {
    const list = matches.data ?? [];
    const count = (f: Filter) =>
      applyFilter(list, tmap, myId, f).filter((m) => !plannedIds.has(m.id))
        .length;
    return { all: count("all"), mine: count("mine"), won: count("won"), lost: count("lost") };
  }, [matches.data, tmap, myId, plannedIds]);

  return (
    <div>
      <header className="page-head">
        <div className="row-between">
          <div>
            <h1 className="page-title">Matches</h1>
            <p className="page-subtitle">
              Plan een match, log een uitslag of bekijk recente wedstrijden.
            </p>
          </div>
          <div className="btn-row">
            <button className="btn" onClick={() => openSheet("plan")}>
              Match plannen
            </button>
            <button
              className="btn btn--primary"
              onClick={() => openSheet("score")}
            >
              + Match loggen
            </button>
          </div>
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
                {!matches.loading && (
                  <span className="tab__count" aria-hidden="true">
                    {counts[key]}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {matches.loading && <MatchListSkeleton count={4} />}
        {matches.error && <p className="msg msg--error">{matches.error}</p>}
        {!matches.loading &&
          groups.length === 0 &&
          (filter === "all" ? (
            <EmptyState
              icon="🎾"
              title="Nog geen matches."
              action={
                <button
                  className="btn btn--primary"
                  onClick={() => openSheet("score")}
                >
                  + Log je eerste match
                </button>
              }
            >
              Log je eerste uitslag en zie meteen je punten en rating groeien.
            </EmptyState>
          ) : (
            <p className="empty">{EMPTY_BY_FILTER[filter]}</p>
          ))}
        {!matches.loading &&
          groups.map(({ day, list }) => (
            <div key={day} className="match-day">
              <h3 className="match-day__title">
                {day}
                <span className="match-day__count" aria-hidden="true">
                  {list.length}
                </span>
              </h3>
              <ul className="matchlist">
                {list.map((m) => (
                  <li key={m.id}>
                    <DeletableMatchCard
                      match={m}
                      teams={tmap}
                      profiles={pmap}
                      perspectiveId={myId}
                      onDeleted={reloadAll}
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
        mode={sheetMode}
        onClose={() => setSheetOpen(false)}
        onCreated={reloadAll}
        onGuestCreated={profiles.reload}
      />
    </div>
  );
}

/* ---------- Filteren & groeperen ---------- */

/** Lege staat per filter: zeg wát er leeg is in plaats van een generiek zinnetje. */
const EMPTY_BY_FILTER: Record<Filter, string> = {
  all: "Nog geen matches.",
  mine: "Geen matches met jou erin — log er eentje via de knop hierboven.",
  won: "Nog geen gewonnen matches voor dit filter. De volgende pak je!",
  lost: "Geen verloren matches voor dit filter. Lekker bezig!",
};

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
