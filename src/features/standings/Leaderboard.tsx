import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthProvider";
import { useAsync } from "@/lib/hooks/useAsync";
import { useRealtime } from "@/lib/hooks/useRealtime";
import { StandingsSkeleton } from "@/ui/Skeleton";
import { EmptyState } from "@/ui/EmptyState";
import { Avatar } from "@/ui/Avatar";
import { recentForm, type Outcome } from "@/features/rating/results";
import { isSeasonClosed, listSeasons, seasonFromId } from "@/features/rating/seasons";
import {
  byRank,
  computePlayerStandings,
  computeTeamStandings,
  matchesInSeason,
  matchesUpTo,
} from "@/features/rating/standings";
import { rankShifts, type Shift } from "@/features/rating/rankShift";
import {
  getPlayerStandings,
  getTeamStandings,
  getGroupPlayerStandings,
} from "./api";
import { getMyGroups } from "@/features/groups/api";
import { getPlayerRatings, getAllRatingHistories } from "./ratingsApi";
import { getPiasWeeks } from "./piasApi";
import { currentPias } from "@/features/standings/pias";
import { roastCtx, roastSeed } from "@/features/coach/roastTone";
import { Podium } from "@/features/standings/components/Podium";
import { TierLegend } from "@/features/rating/components/TierLegend";
import { THIN_GAMES } from "@/features/groups/groupRating";
import {
  getCompletedMatchesBetween,
  getFirstMatchDate,
  getRecentMatches,
  getTeamsMap,
  teamLabel,
} from "@/features/matches/api";
import { getProfilesMap, displayName } from "@/features/profiles/api";
import { searchDiscoverableProfiles } from "@/features/friends/api";
import { ShareChampion } from "@/features/standings/components/ShareChampion";
import { ratingAsOf, type Row } from "./leaderboardHelpers";
import { TierProgressBanner } from "./components/TierProgressBanner";
import { PiasBanner } from "./components/PiasBanner";
import { TierDivisions } from "./components/TierDivisions";
import { KlassementUitleg } from "./components/KlassementUitleg";
import { StandingsTable } from "./components/StandingsTable";
import { RankList } from "./components/RankList";
import type { Match, Profile, RatingPoint } from "@/types";
import "./Leaderboard.css";

type Tab = "player" | "team" | "divisies";

export function Leaderboard() {
  const { user } = useAuth();
  const myId = user?.id ?? "";
  const [tab, setTab] = useState<Tab>("player");
  const [groupId, setGroupId] = useState<string>("");

  // Speler zoeken (#282): het zoekveld filtert de al geladen ranglijst live op
  // naam. Daarnaast zoeken we vindbare spelers die (nog) niet in de ranglijst
  // staan, zodat je ze via hun profiel toch vindt.
  const [q, setQ] = useState("");
  const [extraResults, setExtraResults] = useState<Profile[]>([]);
  const searchSeq = useRef(0);
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      searchSeq.current++;
      setExtraResults([]);
      return;
    }
    const seq = ++searchSeq.current;
    const t = setTimeout(async () => {
      try {
        const found = await searchDiscoverableProfiles(term, myId);
        if (seq === searchSeq.current) setExtraResults(found);
      } catch {
        if (seq === searchSeq.current) setExtraResults([]);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q, myId]);

  // Het gekozen seizoen (kwartaal) leeft in de URL (?seizoen=2026-q3):
  // deelbaar en refresh-bestendig. Ongeldige waarde → "Alle tijden".
  const [params, setParams] = useSearchParams();
  const season = seasonFromId(params.get("seizoen") ?? "");
  const setSeasonId = (id: string) => {
    const next = new URLSearchParams(params);
    if (id) {
      next.set("seizoen", id);
      next.delete("stand"); // seizoen en "stand op datum" sluiten elkaar uit
    } else next.delete("seizoen");
    setParams(next, { replace: true });
  };

  // "Stand op datum" (tijdmachine): de ranglijst zoals hij was t/m een datum,
  // met ieders punten cumulatief uit alle matches op of vóór die dag.
  const asof = params.get("stand") ?? ""; // YYYY-MM-DD; "" = uit
  const setAsof = (d: string) => {
    const next = new URLSearchParams(params);
    if (d) {
      next.set("stand", d);
      next.delete("seizoen");
    } else next.delete("stand");
    setParams(next, { replace: true });
  };
  // Minimaal aantal gespeelde matches om in de lijst te verschijnen (eerlijkheid).
  const minMatches = Math.max(0, Math.floor(Number(params.get("min") ?? "0")) || 0);
  const setMin = (n: number) => {
    const next = new URLSearchParams(params);
    if (n > 0) next.set("min", String(n));
    else next.delete("min");
    setParams(next, { replace: true });
  };

  // Kiezeropties: alle kwartalen sinds de allereerste match.
  const firstMatch = useAsync(getFirstMatchDate, []);
  const seasons = useMemo(
    () => (firstMatch.data ? listSeasons(new Date(firstMatch.data)) : []),
    [firstMatch.data],
  );

  const groups = useAsync(getMyGroups, []);
  const players = useAsync(
    () => (groupId ? getGroupPlayerStandings(groupId) : getPlayerStandings()),
    [groupId],
  );
  const teams = useAsync(getTeamStandings, []);
  const teamsMap = useAsync(getTeamsMap, []);
  const profilesMap = useAsync(getProfilesMap, []);
  // Voor de vorm-kolom: recente matches client-side per speler samengevat.
  const recent = useAsync(() => getRecentMatches(250), []);
  const ratings = useAsync(getPlayerRatings, []);
  // Voor de sparkline-kolom: historie van alle spelers in één batch.
  const histories = useAsync(getAllRatingHistories, []);
  // Pias van de week per groep (serverside aangeduid); de banner + voetnoot
  // tonen de pias van de geselecteerde groep.
  const piasWeeks = useAsync(getPiasWeeks, []);
  // Kwartaalstand: één matches-query per seizoenswissel (gecachet); de stand
  // zelf wordt client-side berekend met dezelfde logica als de views.
  const seasonMatches = useAsync<Match[] | null>(
    () =>
      season
        ? getCompletedMatchesBetween(
            season.start.toISOString(),
            season.end.toISOString(),
          )
        : Promise.resolve(null),
    [season?.id],
  );
  // Alle afgeronde matches, voor de tijdmachine. Vast bereik → de cache blijft
  // staan terwijl je de datum verschuift (alleen de eerste keer een query).
  const allCompleted = useAsync<Match[] | null>(
    () =>
      asof
        ? getCompletedMatchesBetween(
            "2000-01-01T00:00:00Z",
            "2100-01-01T00:00:00Z",
          )
        : Promise.resolve(null),
    [asof ? "on" : "off"],
  );

  // Live bijwerken bij nieuwe/aangepaste matches.
  const refresh = useCallback(() => {
    players.reload();
    teams.reload();
    teamsMap.reload();
    recent.reload();
    ratings.reload();
    histories.reload();
    seasonMatches.reload();
    allCompleted.reload();
    piasWeeks.reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players.reload, teams.reload, teamsMap.reload, recent.reload, ratings.reload, histories.reload, seasonMatches.reload, allCompleted.reload, piasWeeks.reload]);
  useRealtime("matches", refresh);

  const pmap = profilesMap.data ?? {};
  // Stabiele referentie: tmap voedt de useMemo van de rangverschuivingen.
  const tmap = useMemo(() => teamsMap.data ?? {}, [teamsMap.data]);
  const rmap = ratings.data ?? {};
  const hmap = histories.data ?? {};

  // Pias van de week voor de gekozen groep (niets bij "Alle groepen"). De
  // commentator-sneer (#183) volgt de roast-intensiteit van die groep en het
  // roast-schild van de pias zelf.
  const groupPias = useMemo(() => {
    if (!groupId) return null;
    const rows = piasWeeks.data?.[groupId];
    const pias = rows ? currentPias(rows) : null;
    if (!pias) return null;
    const profile = (profilesMap.data ?? {})[pias.playerId];
    const groep = (groups.data ?? []).find((g) => g.id === groupId);
    const ctx = roastCtx(
      { roast_intensiteit: groep?.roast_intensiteit ?? "gemeen" },
      profile,
    );
    return {
      naam: displayName(profile),
      winChance: pias.winChance,
      beschermd: profile?.roast_schild ?? false,
      // Coach Rudy spreekt nu als geattribueerde spreker (#287): geef de
      // context + seed door i.p.v. een kant-en-klare 🎙️-string.
      ctx,
      seed: roastSeed(pias.playerId, pias.weekStart),
    };
  }, [groupId, piasWeeks.data, profilesMap.data, groups.data]);

  // Gescopete matches (seizoen óf "stand op datum"), met groepsfilter. Beide
  // rekenen client-side met dezelfde logica als de server-views.
  const usingScope = !!(season || asof);
  const scopedSource = season
    ? seasonMatches.data
      ? matchesInSeason(seasonMatches.data, season)
      : null
    : asof
      ? allCompleted.data
        ? matchesUpTo(allCompleted.data, asof)
        : null
      : null;
  const scoped = scopedSource
    ? scopedSource.filter((m) => !groupId || m.group_id === groupId)
    : null;
  const playerStandings = usingScope
    ? scoped
      ? computePlayerStandings(scoped, tmap, pmap)
      : []
    : (players.data ?? []);
  const teamStandings = usingScope
    ? scoped
      ? computeTeamStandings(scoped, tmap)
      : []
    : (teams.data ?? []);

  // Vorm: binnen een scope alleen de matches van die scope tonen.
  const formSource = usingScope ? (scoped ?? []) : (recent.data ?? []);
  const formFor = (playerId: string): Outcome[] =>
    recentForm(formSource, tmap, playerId, 5);

  // Verschuiving t.o.v. vóór de laatste speeldag (▲2 / ▼1 / nieuw) — alleen
  // in "Alle tijden": een seizoensarchief beweegt niet meer.
  const shifts = useMemo(
    () => rankShifts(players.data ?? [], recent.data ?? [], tmap, groupId || null),
    [players.data, recent.data, tmap, groupId],
  );

  // Datum van mijn laatste afgeronde match — preset voor "stand op datum".
  const myLastMatchDay = useMemo(() => {
    let latest = "";
    for (const m of recent.data ?? []) {
      if (m.status !== "completed") continue;
      const a = tmap[m.team_a_id];
      const b = tmap[m.team_b_id];
      const mine =
        a?.player1_id === myId ||
        a?.player2_id === myId ||
        b?.player1_id === myId ||
        b?.player2_id === myId;
      if (!mine) continue;
      const d = (m.played_at ?? m.created_at).slice(0, 10);
      if (d > latest) latest = d;
    }
    return latest;
  }, [recent.data, tmap, myId]);

  const playerRows = playerStandings.map((p) => ({
    key: p.player_id,
    isMe: p.player_id === myId,
    name: displayName(p),
    profile: pmap[p.player_id] ?? p,
    link: `/spelers/${p.player_id}`,
    played: p.played,
    won: p.won,
    drawn: p.drawn ?? 0,
    lost: p.lost,
    points: p.points,
    goalDiff: p.goal_diff ?? 0,
    // Bij "stand op datum" de rating zoals die tóén was (uit de historie),
    // anders de huidige rating.
    rating: asof
      ? ratingAsOf(hmap[p.player_id], asof)
      : (rmap[p.player_id]?.rating ?? null),
    // Voor de tier-dimming (#127); bij "stand op datum" is dit de huidige
    // teller — kleine bekende onzuiverheid, de tier volgt wel de toenmalige rating.
    games: rmap[p.player_id]?.games ?? 0,
    history: hmap[p.player_id] ?? [],
    form: formFor(p.player_id),
    shift: usingScope ? undefined : shifts.get(p.player_id),
  }));

  const teamRows = teamStandings.map((t) => ({
    key: t.team_id,
    isMe: false,
    name: teamLabel(tmap[t.team_id], pmap),
    profile: null,
    link: undefined as string | undefined,
    played: t.played,
    won: t.won,
    drawn: t.drawn ?? 0,
    lost: t.lost,
    points: t.points,
    goalDiff: t.goal_diff ?? 0,
    rating: null,
    games: 0,
    history: [] as RatingPoint[],
    form: [] as Outcome[],
    shift: undefined as Shift | undefined,
  }));

  // Minimaal-aantal-matches: verberg spelers/teams onder de drempel (de
  // overgebleven lijst wordt opnieuw genummerd 1..k).
  const atLeastMin = <T extends { played: number }>(list: T[]): T[] =>
    minMatches > 0 ? list.filter((r) => r.played >= minMatches) : list;
  const shownPlayerRows = atLeastMin(playerRows);
  // Divisies gebruiken dezelfde spelerslijst als het speler-klassement.
  const rows = tab === "team" ? atLeastMin(teamRows) : shownPlayerRows;
  // Rating is de leidende volgorde voor spelers (#52) — speelfrequentie telt
  // niet; de klassieke punten-tie-break geldt bij gelijke/ontbrekende rating.
  const displayRows =
    tab === "team"
      ? rows
      : [...rows].sort(
          (a, b) =>
            (b.rating ?? -Infinity) - (a.rating ?? -Infinity) ||
            byRank(
              { points: a.points, goal_diff: a.goalDiff, won: a.won },
              { points: b.points, goal_diff: b.goalDiff, won: b.won },
            ),
        );
  // In seizoens-/datumweergave rekenen we zelf, dus wachten we op matches + lookups.
  const scopeAsync = season ? seasonMatches : allCompleted;
  const loading = usingScope
    ? scopeAsync.loading || teamsMap.loading || profilesMap.loading
    : tab === "team"
      ? teams.loading
      : players.loading;
  const error = usingScope
    ? scopeAsync.error
    : tab === "team"
      ? teams.error
      : players.error;
  const showPodium = tab === "player" && !loading && !error && rows.length >= 3;

  // Kampioensbanner: de nummer 1 van een volledig afgesloten kwartaal.
  const champion =
    season && isSeasonClosed(season) && !loading && !error && shownPlayerRows.length > 0
      ? shownPlayerRows[0]
      : null;

  // "Jouw positie": scrolt naar je eigen rij (tabel op desktop, lijst op mobiel).
  const meRowRef = useRef<HTMLTableRowElement | null>(null);
  const meItemRef = useRef<HTMLLIElement | null>(null);
  const myRankIdx =
    tab === "player" ? displayRows.findIndex((r) => r.isMe) : -1;
  const scrollToMe = () => {
    const el = [meItemRef.current, meRowRef.current].find(
      (e) => e && e.offsetParent !== null,
    );
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  // Naam-filter (#282): de echte rang blijft op elke rij staan, zodat filteren
  // de nummers niet hernummert. Alleen op de speler-/teamlijst (niet divisies).
  const nq = q.trim().toLowerCase();
  const searchable = tab !== "divisies";
  const rankedRows: Row[] = displayRows.map((r, i) => ({ ...r, rank: i + 1 }));
  const matchesName = (r: Row) =>
    r.name.toLowerCase().includes(nq) ||
    (r.profile?.username?.toLowerCase().includes(nq) ?? false);
  const visibleRows =
    nq && searchable ? rankedRows.filter(matchesName) : rankedRows;
  // Vindbare spelers die niet in de ranglijst staan (bv. nog geen matches).
  const rankedKeys = new Set(rows.map((r) => r.key));
  const extraProfiles =
    nq && tab === "player"
      ? extraResults.filter((p) => !rankedKeys.has(p.id))
      : [];

  // Aantal actieve filterkeuzes — als badge op de menuknop, zodat je ook met
  // een dichtgeklapt menu ziet dat er iets gefilterd wordt. (Zoeken staat los
  // zichtbaar en telt hier niet mee.)
  const activeFilters =
    (season ? 1 : 0) +
    (groupId ? 1 : 0) +
    (asof ? 1 : 0) +
    (minMatches > 0 ? 1 : 0);

  return (
    <div>
      <header className="page-head">
        <h1 className="page-title">Klassement</h1>
        <p className="page-subtitle">
          {tab === "player"
            ? "Wie is de koning en wie is het slofje? Puur gesorteerd op rating."
            : "Vaste duo's gesorteerd op pure puntenheerschappij."}
        </p>
      </header>

      <div className="lb-toolbar">
        <div className="tabs">
          <button
            className={`tab ${tab === "player" ? "is-active" : ""}`}
            onClick={() => setTab("player")}
          >
            Spelers
          </button>
          <button
            className={`tab ${tab === "team" ? "is-active" : ""}`}
            onClick={() => setTab("team")}
          >
            Teams
          </button>
          <button
            className={`tab ${tab === "divisies" ? "is-active" : ""}`}
            onClick={() => setTab("divisies")}
          >
            Divisies
          </button>
        </div>

        {/* Zoekbalk staat direct zichtbaar tussen de tabs en de filterknop. */}
        {searchable && (
          <div className="lb-search" role="search">
            <svg
              className="lb-search__icon"
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              className="lb-search__input"
              type="search"
              placeholder="Zoek een speler op naam…"
              aria-label="Zoek een speler"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            {q && (
              <button
                type="button"
                className="lb-search__clear"
                aria-label="Zoekterm wissen"
                onClick={() => setQ("")}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Alleen de filters (seizoen/groep/geavanceerd) zitten achter de
            menuknop; een telbadge toont hoeveel er actief zijn. */}
        <details className="lb-menu">
          <summary className="lb-menu__btn" aria-label="Filteren">
            <svg
              className="lb-menu__icon"
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
            <span className="lb-menu__label">Filter</span>
            {activeFilters > 0 && (
              <span className="lb-filters__count">{activeFilters}</span>
            )}
          </summary>
          <div className="lb-menu__panel">
            <div className="lb-menu__row">
              <label className="lb-filters__field">
                <span>Seizoen</span>
                <select
                  className="select select--filter"
                  aria-label="Seizoen"
                  value={season?.id ?? ""}
                  onChange={(e) => setSeasonId(e.target.value)}
                >
                  <option value="">Alle tijden</option>
                  {/* Gedeeld seizoen uit de URL dat (nog) niet in de lijst zit. */}
                  {season && !seasons.some((s) => s.id === season.id) && (
                    <option value={season.id}>{season.label}</option>
                  )}
                  {seasons.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>

              {tab !== "team" && (
                <label className="lb-filters__field">
                  <span>Groep</span>
                  <select
                    className="select select--filter"
                    aria-label="Groep"
                    value={groupId}
                    onChange={(e) => setGroupId(e.target.value)}
                  >
                    <option value="">Alle groepen</option>
                    {(groups.data ?? []).map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            {/* Geavanceerd: stand-op-datum en minimaal aantal matches (#71). */}
            <label className="lb-filters__field">
              <span>Stand op datum</span>
              <input
                className="input select--filter lb-date"
                type="date"
                aria-label="Stand op datum"
                title="Bekijk de stand zoals hij was t/m deze datum"
                value={asof}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setAsof(e.target.value)}
              />
            </label>
            {myLastMatchDay && (
              <button
                type="button"
                className={`tab lb-menu__preset ${asof === myLastMatchDay ? "is-active" : ""}`}
                onClick={() =>
                  setAsof(asof === myLastMatchDay ? "" : myLastMatchDay)
                }
              >
                Mijn laatste match
              </button>
            )}
            <label className="lb-filters__field">
              <span>Minimaal gespeeld</span>
              <select
                className="select select--filter"
                aria-label="Minimaal aantal matches"
                value={minMatches}
                onChange={(e) => setMin(Number(e.target.value))}
              >
                <option value={0}>Alle spelers</option>
                {[3, 5, 10, 20].map((n) => (
                  <option key={n} value={n}>
                    ≥ {n} matches
                  </option>
                ))}
              </select>
            </label>
          </div>
        </details>
      </div>

      {asof && (
        <p className="lb-asof-note" role="status">
          Stand zoals op <strong>{asof}</strong> — punten en saldo berekend uit
          alle matches t/m die dag.
        </p>
      )}

      {champion && season && (
        <p className="champion-banner" role="status">
          <span className="champion-banner__cup" aria-hidden="true">
            🏆
          </span>
          <span>
            Kampioen {season.label}: <strong>{champion.name}</strong>
          </span>
          <ShareChampion seasonLabel={season.label} rows={shownPlayerRows} />
        </p>
      )}

      {showPodium && !nq && (
        <Podium
          entries={displayRows
            .filter((r) => r.rating != null)
            .slice(0, 3)
            .map((r) => ({
              key: r.key,
              name: r.name,
              profile: r.profile,
              link: r.link,
              isMe: r.isMe,
              rating: r.rating,
              delta: r.history[r.history.length - 1]?.delta ?? null,
              dimmed: r.games > 0 && r.games < THIN_GAMES,
              tier: true,
              sub: `${r.points} ptn`,
              record: `${r.won}W · ${r.drawn}G · ${r.lost}V`,
            }))}
        />
      )}

      {tab === "divisies" && (
        <>
          <TierProgressBanner rating={rmap[myId]?.rating ?? null} />
          {groupPias && <PiasBanner pias={groupPias} />}
          <TierLegend pias={groupPias} />
        </>
      )}

      <div className="card">
        {loading ? (
          <StandingsSkeleton rows={6} />
        ) : error ? (
          <p className="msg msg--error">{error}</p>
        ) : rows.length === 0 ? (
          season ? (
            <p className="empty">Geen matches in dit seizoen.</p>
          ) : asof ? (
            <p className="empty">
              {minMatches > 0
                ? `Geen spelers met minstens ${minMatches} matches t/m ${asof}.`
                : `Nog geen matches t/m ${asof}.`}
            </p>
          ) : minMatches > 0 ? (
            <p className="empty">
              Geen spelers met minstens {minMatches} gespeelde matches.
            </p>
          ) : (
            <EmptyState
              icon="🏆"
              title="De trofeeënkast staat nog leeg."
              action={
                <Link className="btn btn--primary" to="/matches">
                  Naar matches
                </Link>
              }
            >
              Zodra de eerste wedstrijdscore binnenrolt, barst de strijd om de topposities los!
            </EmptyState>
          )
        ) : tab === "divisies" ? (
          <TierDivisions rows={displayRows} />
        ) : visibleRows.length === 0 ? (
          <p className="empty">
            Geen speler in de ranglijst gevonden voor “{q.trim()}”.
          </p>
        ) : (
          <div className="standings-switch">
            <StandingsTable
              rows={visibleRows}
              showForm={tab === "player"}
              meRef={meRowRef}
            />
            <RankList
              rows={visibleRows}
              meRef={meItemRef}
              lead={tab === "player" ? "rating" : "points"}
            />
          </div>
        )}
      </div>

      {/* Ook gevonden buiten de ranglijst (#282): vindbare spelers die (nog)
          niet meespelen — met een link naar hun profiel. */}
      {extraProfiles.length > 0 && (
        <section className="card lb-extra">
          <h2 className="card__title card__title--tight">Ook gevonden</h2>
          <p className="lb-extra__sub">
            Deze spelers staan (nog) niet in het klassement.
          </p>
          <ul className="lb-extra__list">
            {extraProfiles.map((p) => (
              <li key={p.id}>
                <Link className="lb-extra__item" to={`/spelers/${p.id}`}>
                  <Avatar profile={p} size={32} />
                  <span className="lb-extra__name">{displayName(p)}</span>
                  <span className="lb-extra__go" aria-hidden="true">
                    Profiel →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Uitleg onderaan: wie hem nodig heeft vindt hem, wie de stand komt
          checken krijgt die meteen bovenaan te zien. */}
      <KlassementUitleg />

      {tab === "player" && myRankIdx >= 0 && rows.length > 8 && !nq && (
        <button className="me-chip" onClick={scrollToMe}>
          Jouw positie · #{myRankIdx + 1}
        </button>
      )}
    </div>
  );
}

export default Leaderboard;
