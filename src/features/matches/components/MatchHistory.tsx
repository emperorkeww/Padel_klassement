import { useMemo, useState, type ReactNode } from "react";
import { MatchListSkeleton } from "@/ui/Skeleton";
import { DeletableMatchCard } from "@/features/matches/components/MatchList";
import {
  applyFilter,
  groupByDay,
  EMPTY_BY_FILTER,
  FILTER_TABS,
  type Filter,
} from "@/features/matches/matchFilter";
import type { Upset } from "@/features/matches/upset";
import type { Match, Profile, Team } from "@/types";

/** De "Recente matches"-kaart: filter-tabs met tellers en een per-dag
 *  gegroepeerde lijst. Gedeeld door de globale Matches-pagina (#106) en de
 *  Matches-tab op de groepspagina (#342). De aanroeper levert de kandidatenlijst
 *  (en sluit zelf uit wat elders al getoond wordt, bv. "Te spelen"). */
export function MatchHistory({
  matches,
  teams,
  profiles,
  myId,
  upsets,
  onChanged,
  canManage = false,
  title = "Recente matches",
  loading = false,
  error = null,
  emptyAll,
}: {
  matches: Match[];
  teams: Record<string, Team>;
  profiles: Record<string, Profile>;
  myId: string;
  upsets: Map<string, Upset>;
  onChanged: () => void;
  /** True voor de groepseigenaar: mag ook matches van anderen verwijderen. */
  canManage?: boolean;
  title?: string;
  loading?: boolean;
  error?: string | null;
  /** Eigen lege staat voor het "Alles"-filter (bv. een EmptyState met CTA);
   *  zonder dit valt de kaart terug op de standaardtekst. */
  emptyAll?: ReactNode;
}) {
  const [filter, setFilter] = useState<Filter>("all");

  // Sorteer op de dag die het dagkopje bepaalt (played_at, anders created_at)
  // vóór het groeperen, zodat matches met een afwijkende speeldatum niet over
  // meerdere losse dagkopjes verspreid raken.
  const groups = useMemo(() => {
    const sorted = [...applyFilter(matches, teams, myId, filter)].sort(
      (a, b) =>
        new Date(b.played_at ?? b.created_at).getTime() -
        new Date(a.played_at ?? a.created_at).getTime(),
    );
    return groupByDay(sorted);
  }, [matches, teams, myId, filter]);

  // Tellers per filtertab, zodat je zonder klikken ziet wat elk filter oplevert.
  const counts = useMemo(() => {
    const count = (f: Filter) => applyFilter(matches, teams, myId, f).length;
    return {
      all: count("all"),
      mine: count("mine"),
      won: count("won"),
      lost: count("lost"),
    };
  }, [matches, teams, myId]);

  return (
    <section className="card">
      <div className="card__head">
        <h2 className="card__title">{title}</h2>
        <div className="tabs">
          {FILTER_TABS.map(([key, label]) => (
            <button
              key={key}
              className={`tab ${filter === key ? "is-active" : ""}`}
              onClick={() => setFilter(key)}
            >
              {label}
              {!loading && (
                <span className="tab__count" aria-hidden="true">
                  {counts[key]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {loading && <MatchListSkeleton count={4} />}
      {error && <p className="msg msg--error">{error}</p>}
      {!loading &&
        groups.length === 0 &&
        (filter === "all" && emptyAll ? (
          emptyAll
        ) : (
          <p className="empty">{EMPTY_BY_FILTER[filter]}</p>
        ))}
      {!loading &&
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
                    teams={teams}
                    profiles={profiles}
                    perspectiveId={myId}
                    upset={upsets.get(m.id) ?? null}
                    canManage={canManage}
                    onDeleted={onChanged}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}
    </section>
  );
}

export default MatchHistory;
