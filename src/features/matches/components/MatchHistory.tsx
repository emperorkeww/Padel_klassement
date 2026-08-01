import { useMemo, useState, type ReactNode } from "react";
import { MatchListSkeleton } from "@/ui/Skeleton";
import { ErrorRetry } from "@/ui/ErrorRetry";
import { DeletableMatchCard } from "@/features/matches/components/MatchList";
import {
  applyFilter,
  groupByDay,
  EMPTY_BY_FILTER,
  FILTER_TABS,
  type Filter,
} from "@/features/matches/matchFilter";
import { lefKaartRegel } from "@/features/matches/stakes";
import { getStakesForMatches } from "@/features/matches/stakesApi";
import { displayName } from "@/features/profiles/api";
import { useAsync } from "@/lib/hooks/useAsync";
import { useCacheRevision } from "@/lib/hooks/useCacheRevision";
import { useClub } from "@/features/availability/club";
import type { Upset } from "@/features/matches/upset";
import type { Match, Profile, Team } from "@/types";
import "./MatchHistory.css";

/** De "Recente matches"-kaart: filter-tabs met tellers en een per-dag
 *  gegroepeerde lijst. Gedeeld door de globale Matches-pagina (#106) en de
 *  Historie-tab op de groepspagina (#342). De aanroeper levert de kandidatenlijst
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
  const club = useClub();

  // Sorteer op de dag die het dagkopje bepaalt (played_at, anders created_at)
  // vóór het groeperen, zodat matches met een afwijkende speeldatum niet over
  // meerdere losse dagkopjes verspreid raken.
  const groups = useMemo(() => {
    const sorted = [...applyFilter(matches, teams, myId, filter)].sort(
      (a, b) =>
        new Date(b.played_at ?? b.created_at).getTime() -
        new Date(a.played_at ?? a.created_at).getTime(),
    );
    return groupByDay(sorted, club.timezone);
  }, [matches, teams, myId, filter, club.timezone]);

  // Lef-regels op de kaarten (#981): één bulk-query over de getoonde lijst —
  // alleen groepsmatches, want daarbuiten bestaat er geen inzet. De query is
  // gecacht en in stukken gehakt, dus ook een lange historie blijft één ronde
  // vragen; de cache-revisie trekt de regels bij na een inzet elders (#907).
  const stakesRev = useCacheRevision("match-stakes");
  const stakeIds = useMemo(
    () =>
      matches
        .filter((m) => m.group_id != null)
        .map((m) => m.id)
        .join(","),
    [matches],
  );
  const stakes = useAsync(
    () => getStakesForMatches(stakeIds ? stakeIds.split(",") : []),
    [stakeIds, stakesRev],
  );

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
        {/* Filters, geen tabbladen: dezelfde groep-met-schakelknoppen als
            elders (#924). De rij had helemaal geen rol, dus was er ook geen
            ingedrukt-staat te horen. */}
        <div className="tabs" role="group" aria-label="Historie filteren">
          {FILTER_TABS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`tab ${filter === key ? "is-active" : ""}`}
              aria-pressed={filter === key}
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
      {/* `onChanged` is de herlaad-callback van de aanroeper; die dient hier
          ook als herstelactie bij een mislukte fetch (#910). */}
      {error && (
        <ErrorRetry
          melding={`De matches laden mislukte: ${error}`}
          onRetry={onChanged}
        />
      )}
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
                    lef={lefKaartRegel({
                      match: m,
                      stakes: stakes.data ?? [],
                      teams,
                      naam: (id) => displayName(profiles[id]),
                    })}
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
