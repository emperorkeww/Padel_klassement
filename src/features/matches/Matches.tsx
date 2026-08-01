import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthProvider";
import { useAsync } from "@/lib/hooks/useAsync";
import { useRealtime } from "@/lib/hooks/useRealtime";
import { EmptyState } from "@/ui/EmptyState";
import { MatchListSkeleton } from "@/ui/Skeleton";
import { usePageTitle } from "@/lib/hooks/usePageTitle";
import { useVerbergBijScrollen } from "@/lib/hooks/useVerbergBijScrollen";
import { CoachAvatar } from "@/features/coach/components/CoachAvatar";
import { coachEmptyState } from "@/features/coach/coachMoments";
import { getRecentMatches, getTeamsMap } from "./api";
import { getMyGroups } from "@/features/groups/api";
import { useClub } from "@/features/availability/club";
import { MatchFilters } from "@/features/matches/components/MatchFilters";
import {
  filterOpGroep,
  filterOpPeriode,
  periodeFromParam,
  type Periode,
} from "@/features/matches/matchFilter";
import { getRatingHistoriesForMatches } from "@/features/standings/ratingsApi";
import { upsetsByMatch } from "@/features/matches/upset";
import { getAllProfiles } from "@/features/profiles/api";
import { getMyFriendships, categorize, otherId } from "@/features/friends/api";
import { MatchHistory } from "@/features/matches/components/MatchHistory";
import { PlannedMatchCard } from "@/features/matches/components/PlannedMatchCard";
import { NewMatchSheet, type NewMatchMode } from "@/features/matches/components/NewMatchSheet";
import type { Profile } from "@/types";
import "./Matches.css";

/** Hoeveel matches per keer geladen worden; "toon oudere" telt er zoveel bij. */
const PAGINA = 100;

export function Matches() {
  usePageTitle("Matches");
  const { user } = useAuth();
  const myId = user?.id ?? "";
  const club = useClub();
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

  // Oudere matches bereikbaar (#914): 100 was een hard plafond zonder "meer
  // laden" en zonder melding dat de lijst afgekapt was — alles daarvoor viel
  // vanaf deze pagina buiten bereik.
  const [limiet, setLimiet] = useState(PAGINA);
  // De zwevende logknop wijkt bij vooruitscrollen (#942).
  const fabVerborgen = useVerbergBijScrollen();
  const matches = useAsync(() => getRecentMatches(limiet), [limiet]);
  // Kreeg de server precies de limiet terug, dan zit er waarschijnlijk meer
  // achter. Minder betekent: dit is alles.
  const afgekapt = (matches.data?.length ?? 0) >= limiet;
  const teams = useAsync(getTeamsMap, []);
  const groups = useAsync(getMyGroups, []);
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

  // Groep en periode uit de URL (#914): deelbaar en refresh-bestendig, net als
  // de filters elders in de app.
  const groupFilter = params.get("groep") ?? "";
  const periode = periodeFromParam(params.get("periode"));
  const patchParam = (sleutel: string, waarde: string) => {
    const next = new URLSearchParams(params);
    if (waarde) next.set(sleutel, waarde);
    else next.delete(sleutel);
    setParams(next, { replace: true });
  };
  const wisFilters = () => {
    const next = new URLSearchParams(params);
    next.delete("groep");
    next.delete("periode");
    setParams(next, { replace: true });
  };

  // De recente-lijst toont alles behalve mijn eigen geplande matches — die
  // staan al bovenaan onder "Te spelen" — en daarna gefilterd op groep en
  // periode. Dat filteren gebeurt op de geladen lijst, dus wie ver terug zoekt
  // laadt eerst bij; de melding onder de historie zegt dat ook.
  const recent = useMemo(
    () =>
      filterOpPeriode(
        filterOpGroep(
          (matches.data ?? []).filter((m) => !plannedIds.has(m.id)),
          groupFilter,
        ),
        periode,
        club.timezone,
      ),
    [matches.data, plannedIds, groupFilter, periode, club.timezone],
  );

  return (
    <div className="heeft-zwevende-actie">
      <header className="page-head">
        <div className="row-between">
          <div>
            <h1 className="page-title">Matches</h1>
            <p className="page-subtitle">
              Alle veldslagen uit het verleden en de toekomst op één plek.
            </p>
          </div>
          {/* Loggen is naar de zwevende knop onderaan verhuisd (#914): twee
              knoppen naast elkaar concurreerden, en op telefoonbreedte was niet
              te zien welke de hoofdactie was. */}
          <button className="btn" onClick={() => openSheet("plan")}>
            Match plannen
          </button>
        </div>
      </header>

      <MatchFilters
        groups={groups.data ?? []}
        groupId={groupFilter}
        onGroup={(id) => patchParam("groep", id)}
        periode={periode}
        onPeriode={(p: Periode) => patchParam("periode", p)}
        onWis={wisFilters}
      />

      {/* "Te spelen" verscheen zonder placeholder en duwde de historie omlaag
          zodra de data binnenviel (#914). */}
      {matches.loading ? (
        <section className="card" aria-hidden="true">
          <div className="card__head">
            <h2 className="card__title">Te spelen</h2>
          </div>
          <MatchListSkeleton count={1} />
        </section>
      ) : (
        plannedMine.length > 0 && (
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
        )
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
                      intensiteit: pmap[myId]?.roast_intensiteit ?? "radioactief",
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

      {/* Afkapping expliciet melden (#914): zonder dit leek de lijst compleet,
          terwijl alles ouder dan de limiet simpelweg niet geladen was. Ook het
          antwoord op de filter-valkuil — filteren gebeurt op wat er geladen is. */}
      {!matches.loading && !matches.error && afgekapt && (
        <div className="matches__meer">
          <p className="matches__meer-note">
            Alleen de laatste {limiet} matches zijn geladen. Zoek je iets ouders
            of filter je op een groep? Laad er dan eerst meer bij.
          </p>
          <button
            type="button"
            className="btn"
            onClick={() => setLimiet((l) => l + PAGINA)}
          >
            Toon oudere matches
          </button>
        </div>
      )}

      {/* Eén primaire actie op de pagina (#914): loggen is het meest gebruikte
          pad en blijft ook onderaan een lange lijst bereikbaar. Hij wijkt bij
          vooruitscrollen (#942) — anders ligt hij over de steppers en de
          Opslaan-knop van de kaart eronder. */}
      <button
        type="button"
        className={`btn btn--primary matches__fab zwevende-actie${
          fabVerborgen ? " is-verborgen" : ""
        }`}
        onClick={() => openSheet("score")}
      >
        <span className="matches__fab-plus" aria-hidden="true">
          +
        </span>
        <span className="matches__fab-label">Match loggen</span>
      </button>

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
