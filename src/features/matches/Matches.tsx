import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthProvider";
import { useAsync } from "@/lib/hooks/useAsync";
import { useRealtime } from "@/lib/hooks/useRealtime";
import { EmptyState } from "@/ui/EmptyState";
import { CoachAvatar } from "@/features/coach/components/CoachAvatar";
import { coachEmptyState } from "@/features/coach/coachMoments";
import { getRecentMatches, getTeamsMap } from "./api";
import { getRatingHistoriesForMatches } from "@/features/standings/ratingsApi";
import { upsetsByMatch } from "@/features/matches/upset";
import { getAllProfiles } from "@/features/profiles/api";
import { getMyFriendships, categorize, otherId } from "@/features/friends/api";
import { MatchHistory } from "@/features/matches/components/MatchHistory";
import { PlannedMatchCard } from "@/features/matches/components/PlannedMatchCard";
import { NewMatchSheet, type NewMatchMode } from "@/features/matches/components/NewMatchSheet";
import type { Profile } from "@/types";
import "./Matches.css";

export function Matches() {
  const { user } = useAuth();
  const myId = user?.id ?? "";
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<NewMatchMode>("score");

  function openSheet(mode: NewMatchMode) {
    setSheetMode(mode);
    setSheetOpen(true);
  }

  // Vanuit de Spelen-hub: "/matches?log=1" opent meteen de log-sheet (#106).
  const [params, setParams] = useSearchParams();
  useEffect(() => {
    if (params.has("log")) {
      openSheet("score");
      const next = new URLSearchParams(params);
      next.delete("log");
      setParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const matches = useAsync(() => getRecentMatches(100), []);
  const teams = useAsync(getTeamsMap, []);
  const profiles = useAsync(getAllProfiles, []);
  const friendships = useAsync(getMyFriendships, []);
  // Upsets rekenen met de échte pre-match ratings van precies deze matches
  // (#731): het gedeelde historie-venster is per speler en dekt een oudere
  // match in deze lijst niet gegarandeerd.
  const matchIds = useMemo(
    () =>
      (matches.data ?? [])
        .filter((m) => m.status === "completed")
        .map((m) => m.id),
    [matches.data],
  );
  const matchKey = matchIds.join(",");
  const histories = useAsync(
    () => getRatingHistoriesForMatches(matchIds),
    [matchKey],
  );

  const pmap = Object.fromEntries((profiles.data ?? []).map((p) => [p.id, p]));
  const tmap = useMemo(() => teams.data ?? {}, [teams.data]);
  // Upsets per match-id (#85), één keer berekend voor alle kaarten.
  const upsets = useMemo(
    () => upsetsByMatch(matches.data ?? [], tmap, histories.data ?? {}),
    [matches.data, tmap, histories.data],
  );

  // Kiesbaar in de wizard: jezelf, je geaccepteerde vrienden en je eigen
  // gastspelers (naamloze deelnemers zonder account, door jou aangemaakt).
  const { accepted } = categorize(friendships.data ?? [], myId);
  const myGuests = (profiles.data ?? []).filter(
    (p) => p.is_guest && p.owner_id === myId,
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

  // De recente-lijst toont alles behalve mijn eigen geplande matches — die
  // staan al bovenaan onder "Te spelen".
  const recent = useMemo(
    () => (matches.data ?? []).filter((m) => !plannedIds.has(m.id)),
    [matches.data, plannedIds],
  );

  return (
    <div>
      <header className="page-head">
        <div className="row-between">
          <div>
            <h1 className="page-title">Matches</h1>
            <p className="page-subtitle">
              Alle veldslagen uit het verleden en de toekomst op één plek.
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
                history={matches.data ?? []}
                onSaved={reloadAll}
              />
            ))}
          </div>
        </section>
      )}

      <MatchHistory
        matches={recent}
        teams={tmap}
        profiles={pmap}
        myId={myId}
        upsets={upsets}
        onChanged={reloadAll}
        loading={matches.loading}
        error={matches.error}
        emptyAll={
          <EmptyState
            icon={<CoachAvatar size={40} mood="portret" />}
            title={
              pmap[myId]
                ? coachEmptyState({
                    type: "matches",
                    seed: `${myId}-matches-empty`,
                    ctx: {
                      intensiteit: pmap[myId]?.roast_intensiteit ?? "gemeen",
                      schild: pmap[myId]?.roast_schild ?? false,
                    },
                  })
                : "Je racket is nog ongebruikt."
            }
            action={
              <button
                className="btn btn--primary"
                onClick={() => openSheet("score")}
              >
                + Log je eerste match
              </button>
            }
          >
            {pmap[myId]
              ? "Speel je eerste wedstrijd en kickstart je ranking en statistieken!"
              : "Vul je eerste wedstrijdscore in en kickstart direct je ranking en statistieken!"}
          </EmptyState>
        }
      />

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

export default Matches;
