import { useCallback, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { useAsync } from "../../lib/useAsync";
import { useRealtime } from "../../lib/useRealtime";
import { StandingsSkeleton } from "../../components/Skeleton";
import { EmptyState } from "../../components/EmptyState";
import { Avatar } from "../../components/Avatar";
import { FormChips } from "../../components/FormChips";
import { CountUp } from "../../components/CountUp";
import { useFlip } from "../../lib/useFlip";
import { recentForm, winRate, type Outcome } from "../../lib/results";
import { isSeasonClosed, listSeasons, seasonFromId } from "../../lib/seasons";
import {
  byRank,
  computePlayerStandings,
  computeTeamStandings,
  matchesInSeason,
  matchesUpTo,
} from "../../lib/standings";
import { rankShifts, type Shift } from "../../lib/rankShift";
import {
  getPlayerStandings,
  getTeamStandings,
  getGroupPlayerStandings,
} from "./api";
import { getMyGroups } from "../groups/api";
import { getPlayerRatings, getAllRatingHistories } from "./ratingsApi";
import { Sparkline } from "../../components/Sparkline";
import { Podium } from "../../components/Podium";
import {
  getCompletedMatchesBetween,
  getFirstMatchDate,
  getRecentMatches,
  getTeamsMap,
  teamLabel,
} from "../matches/api";
import { getProfilesMap, displayName } from "../profiles/api";
import { ShareChampion } from "./ShareChampion";
import type { Match, Profile, RatingPoint } from "../../lib/types";
import "./Leaderboard.css";

type Tab = "player" | "team";

/** Rating van een speler zoals die was op (of vóór) een datum, uit de historie
 *  (rating_after van de laatste match ≤ die dag). Null als er niets is. */
function ratingAsOf(
  history: RatingPoint[] | undefined,
  isoDate: string,
): number | null {
  if (!history || history.length === 0) return null;
  let best: RatingPoint | null = null;
  for (const p of history) {
    if (p.played_at.slice(0, 10) <= isoDate && (!best || p.played_at > best.played_at))
      best = p;
  }
  return best ? best.rating_after : null;
}

export function Leaderboard() {
  const { user } = useAuth();
  const myId = user?.id ?? "";
  const [tab, setTab] = useState<Tab>("player");
  const [groupId, setGroupId] = useState<string>("");

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players.reload, teams.reload, teamsMap.reload, recent.reload, ratings.reload, histories.reload, seasonMatches.reload, allCompleted.reload]);
  useRealtime("matches", refresh);

  const pmap = profilesMap.data ?? {};
  // Stabiele referentie: tmap voedt de useMemo van de rangverschuivingen.
  const tmap = useMemo(() => teamsMap.data ?? {}, [teamsMap.data]);
  const rmap = ratings.data ?? {};
  const hmap = histories.data ?? {};

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
    history: [] as RatingPoint[],
    form: [] as Outcome[],
    shift: undefined as Shift | undefined,
  }));

  // Minimaal-aantal-matches: verberg spelers/teams onder de drempel (de
  // overgebleven lijst wordt opnieuw genummerd 1..k).
  const atLeastMin = <T extends { played: number }>(list: T[]): T[] =>
    minMatches > 0 ? list.filter((r) => r.played >= minMatches) : list;
  const shownPlayerRows = atLeastMin(playerRows);
  const rows = tab === "player" ? shownPlayerRows : atLeastMin(teamRows);
  // Rating is de leidende volgorde voor spelers (#52) — speelfrequentie telt
  // niet; de klassieke punten-tie-break geldt bij gelijke/ontbrekende rating.
  const displayRows =
    tab === "player"
      ? [...rows].sort(
          (a, b) =>
            (b.rating ?? -Infinity) - (a.rating ?? -Infinity) ||
            byRank(
              { points: a.points, goal_diff: a.goalDiff, won: a.won },
              { points: b.points, goal_diff: b.goalDiff, won: b.won },
            ),
        )
      : rows;
  // In seizoens-/datumweergave rekenen we zelf, dus wachten we op matches + lookups.
  const scopeAsync = season ? seasonMatches : allCompleted;
  const loading = usingScope
    ? scopeAsync.loading || teamsMap.loading || profilesMap.loading
    : tab === "player"
      ? players.loading
      : teams.loading;
  const error = usingScope
    ? scopeAsync.error
    : tab === "player"
      ? players.error
      : teams.error;
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

  return (
    <div>
      <header className="page-head">
        <h1 className="page-title">Klassement</h1>
        <p className="page-subtitle">
          {tab === "player"
            ? "Gesorteerd op rating — hoe vaak je speelt telt niet mee."
            : "Teams gesorteerd op punten."}
        </p>
      </header>

      <div className="toolbar">
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
        </div>

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

        {tab === "player" && (
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
        )}

        {/* Geavanceerde filters achter een uitklap: de ranglijst blijft het
            hoofdpodium, wie wil verdiepen vindt ze hier (#71). */}
        <details className="lb-filters">
          <summary>
            Filters
            {(asof ? 1 : 0) + (minMatches > 0 ? 1 : 0) > 0 && (
              <span className="lb-filters__count">
                {(asof ? 1 : 0) + (minMatches > 0 ? 1 : 0)}
              </span>
            )}
          </summary>
          <div className="lb-filters__body">
            {/* Stand op datum: de ranglijst zoals hij was t/m die dag. */}
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
                className={`tab ${asof === myLastMatchDay ? "is-active" : ""}`}
                onClick={() =>
                  setAsof(asof === myLastMatchDay ? "" : myLastMatchDay)
                }
              >
                Mijn laatste match
              </button>
            )}
            {/* Minimaal aantal matches om mee te tellen in de lijst. */}
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

      {showPodium && (
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
              sub: `${r.points} ptn`,
              record: `${r.won}W · ${r.drawn}G · ${r.lost}V`,
            }))}
        />
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
              title="Nog geen afgeronde matches."
              action={
                <Link className="btn btn--primary" to="/matches">
                  Naar matches
                </Link>
              }
            >
              Het klassement vult zich zodra de eerste uitslag gelogd is.
            </EmptyState>
          )
        ) : (
          <>
            <StandingsTable
              rows={displayRows}
              showForm={tab === "player"}
              meRef={meRowRef}
            />
            <RankList
              rows={displayRows}
              meRef={meItemRef}
              lead={tab === "player" ? "rating" : "points"}
            />
          </>
        )}
      </div>

      {/* Uitleg onderaan: wie hem nodig heeft vindt hem, wie de stand komt
          checken krijgt die meteen bovenaan te zien. */}
      <KlassementUitleg />

      {tab === "player" && myRankIdx >= 0 && rows.length > 8 && (
        <button className="me-chip" onClick={scrollToMe}>
          Jouw positie · #{myRankIdx + 1}
        </button>
      )}
    </div>
  );
}

/* ---------- Podium: top 3 met goud/zilver/brons ---------- */
type Row = {
  key: string;
  isMe: boolean;
  name: string;
  profile: Pick<Profile, "username" | "full_name"> & { avatar_url?: string | null } | null;
  link?: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
  goalDiff: number;
  rating: number | null;
  history: RatingPoint[];
  form: Outcome[];
  shift?: Shift;
};

/** ▲2 / ▼1 / "nieuw" onder het rangnummer; niets bij een gelijke positie. */
function ShiftBadge({ shift }: { shift?: Shift }) {
  if (shift == null || shift === 0) return null;
  if (shift === "nieuw")
    return <span className="rankshift rankshift--new">nieuw</span>;
  return (
    <span className={`rankshift ${shift > 0 ? "is-up" : "is-down"}`}>
      {shift > 0 ? `▲${shift}` : `▼${-shift}`}
    </span>
  );
}

function KlassementUitleg() {
  return (
    <details className="explainer">
      <summary>Hoe werkt het klassement?</summary>
      <div className="explainer__body">
        <dl>
          <div>
            <dt>Rating</dt>
            <dd>
              De basis van het klassement. Iedereen start op{" "}
              <strong>1000</strong>. Na elke match stijgt of daalt je rating op
              basis van de <strong>sterkte van de tegenstander</strong>: win je
              van een sterker team, dan levert dat meer op; verlies je van een
              zwakker team, dan zakt hij sneller. Zo meet de rating hoe goed je
              speelt, los van hoe váák je speelt.
            </dd>
          </div>
          <div>
            <dt>Punten</dt>
            <dd>
              Elke gewonnen match levert <strong>3 punten</strong> op, een
              gelijkspel <strong>1</strong> en een verlies <strong>0</strong>.
              Punten zijn vooral zinvol binnen een afgebakende periode of
              competitie, zoals een seizoen.
            </dd>
          </div>
          <div>
            <dt>Gespeeld · Winst · Gelijk · Verlies</dt>
            <dd>
              Tellen alleen <strong>afgeronde</strong> matches. Een geplande
              Americano-match telt pas mee zodra het resultaat is ingevoerd.
            </dd>
          </div>
          <div>
            <dt>Vorm</dt>
            <dd>
              De laatste vijf uitslagen van de speler, nieuwste links:{" "}
              <strong>W</strong>inst, <strong>D</strong> (gelijk),{" "}
              <strong>L</strong> (verlies).
            </dd>
          </div>
          <div>
            <dt>Spelers versus Teams</dt>
            <dd>
              Het spelersklassement telt jouw matches over <em>alle</em> teams
              waarin je speelde — ook bij wisselende partners in een Americano. Het
              teamklassement telt per vast spelerspaar.
            </dd>
          </div>
          <div>
            <dt>Volgorde</dt>
            <dd>
              Spelers staan standaard op <strong>rating</strong> (hoog naar
              laag); tik op een kolomkop om anders te sorteren. Bij een gelijke
              rating telt eerst het aantal punten, dan het{" "}
              <strong>scoresaldo</strong>, het aantal gewonnen matches en ten
              slotte de naam. Het teamklassement sorteert op punten.
            </dd>
          </div>
          <div>
            <dt>Seizoenen</dt>
            <dd>
              Elk kwartaal is een seizoen (bv. <strong>Q3 2026</strong>). Kies
              een kwartaal om alleen de matches uit die periode te tellen; bij
              een afgesloten kwartaal zie je meteen de kampioen.{" "}
              <strong>Alle tijden</strong> telt alles samen.
            </dd>
          </div>
          <div>
            <dt>Groepsfilter</dt>
            <dd>
              <strong>Alle groepen</strong> toont al je afgeronde matches samen.
              Kies een groep om enkel de matches binnen die groep te tellen.
            </dd>
          </div>
        </dl>
      </div>
    </details>
  );
}

/** Zet de view-transition-naam op de avatar van de aangeklikte rij, zodat die
 *  bij het navigeren naar het profiel doorgroeit naar de grote profielfoto. */
function primeAvatarMorph(e: React.MouseEvent<HTMLElement>) {
  const avatar = e.currentTarget
    .closest("[data-flip-key]")
    ?.querySelector<HTMLElement>(".avatar");
  if (avatar) avatar.style.viewTransitionName = "player-avatar";
}

/* ---------- Sorteerbaar klassement ---------- */
type SortKey = "points" | "rating" | "winrate" | "saldo";
type SortState = { key: SortKey; dir: "asc" | "desc" };

/** Sorteerwaarde per kolom; ontbrekende waarden zakken naar onderen. */
function sortValue(r: Row, key: SortKey): number {
  switch (key) {
    case "points":
      return r.points;
    case "rating":
      return r.rating ?? Number.NEGATIVE_INFINITY;
    case "winrate":
      return winRate(r.won, r.played) ?? Number.NEGATIVE_INFINITY;
    case "saldo":
      return r.goalDiff;
  }
}

/** Klikbare kolomkop met sorteerpijl; hergebruikt de tie-break uit standings.ts. */
function SortableTh({
  label,
  sortKey,
  sort,
  onSort,
  title,
}: {
  label: string;
  sortKey: SortKey;
  sort: SortState | null;
  onSort: (key: SortKey) => void;
  title?: string;
}) {
  const active = sort?.key === sortKey;
  return (
    <th
      className="num th-sort"
      aria-sort={
        active ? (sort!.dir === "asc" ? "ascending" : "descending") : "none"
      }
    >
      <button
        type="button"
        className="th-sort__btn"
        onClick={() => onSort(sortKey)}
        title={title}
      >
        {label}
        <span
          className={`th-sort__arrow ${active ? "is-active" : ""}`}
          aria-hidden="true"
        >
          {active ? (sort!.dir === "desc" ? "▼" : "▲") : "▾"}
        </span>
      </button>
    </th>
  );
}

function StandingsTable({
  rows,
  showForm,
  meRef,
}: {
  rows: Row[];
  showForm: boolean;
  meRef?: React.Ref<HTMLTableRowElement>;
}) {
  // Sortering is client-side: de aangeleverde volgorde (spelers op rating,
  // teams op punten) is de standaard; klikken op een kolomkop hersorteert
  // lokaal, met de klassement-tie-break als tweede sleutel zodat gelijke
  // waarden hun canonieke volgorde houden.
  const [sort, setSort] = useState<SortState | null>(null);
  const onSort = (key: SortKey) =>
    setSort((s) =>
      s && s.key === key
        ? { key, dir: s.dir === "desc" ? "asc" : "desc" }
        : { key, dir: "desc" },
    );

  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    const factor = sort.dir === "asc" ? -1 : 1;
    return [...rows].sort((a, b) => {
      const diff = sortValue(b, sort.key) - sortValue(a, sort.key);
      const base =
        diff !== 0
          ? diff
          : byRank(
              { points: a.points, goal_diff: a.goalDiff, won: a.won },
              { points: b.points, goal_diff: b.goalDiff, won: b.won },
            );
      return factor * base;
    });
  }, [rows, sort]);

  const flipRef = useFlip<HTMLTableSectionElement>(
    sortedRows.map((r) => r.key).join("|"),
  );
  return (
    <div className="table-scroll leaderboard-table">
      <table className="table">
        <thead>
          <tr>
            <th style={{ width: "2rem" }}>#</th>
            <th>Naam</th>
            {showForm && <th>Vorm</th>}
            <th className="num">Gespeeld</th>
            <th className="num" aria-label="Winst · gelijk · verlies">
              W·G·V
            </th>
            <SortableTh
              label="Winrate"
              sortKey="winrate"
              sort={sort}
              onSort={onSort}
            />
            <SortableTh
              label="Saldo"
              sortKey="saldo"
              sort={sort}
              onSort={onSort}
            />
            <SortableTh
              label="Punten"
              sortKey="points"
              sort={sort}
              onSort={onSort}
            />
            {showForm && (
              <SortableTh
                label="Rating"
                sortKey="rating"
                sort={sort}
                onSort={onSort}
                title="Elo-rating: iedereen start op 1000 en stijgt of daalt na elke match op basis van de sterkte van de tegenstander."
              />
            )}
          </tr>
        </thead>
        <tbody ref={flipRef}>
          {sortedRows.map((r, i) => {
            const rate = winRate(r.won, r.played);
            return (
              <tr
                key={r.key}
                data-flip-key={r.key}
                ref={r.isMe ? meRef : undefined}
                className={r.isMe ? "is-me" : ""}
              >
                <td>
                  <span className="rank-wrap">
                    <span className={`rank rank--${i + 1}`}>{i + 1}</span>
                    <ShiftBadge shift={r.shift} />
                  </span>
                </td>
                <td>
                  <span className="cell-player">
                    <Avatar profile={r.profile} name={r.name} size={26} />
                    {r.link ? (
                      <Link
                        className="profile-link"
                        to={r.link}
                        viewTransition
                        onClick={primeAvatarMorph}
                      >
                        {r.name}
                      </Link>
                    ) : (
                      r.name
                    )}
                    {r.isMe && <span className="badge badge--accent">jij</span>}
                  </span>
                </td>
                {showForm && (
                  <td>
                    {r.form.length > 0 ? (
                      <FormChips form={r.form} size="sm" />
                    ) : (
                      <span className="empty empty--bare">—</span>
                    )}
                  </td>
                )}
                <td className="num">{r.played}</td>
                <td
                  className="num record-cell"
                  aria-label={`${r.won} winst, ${r.drawn} gelijk, ${r.lost} verlies`}
                >
                  <span className="record-cell__won">{r.won}</span>·{r.drawn}·
                  {r.lost}
                </td>
                <td className="num">
                  {rate != null ? (
                    <span className="winrate">
                      <span className="winrate__bar">
                        <span
                          className="winrate__fill"
                          style={{ width: `${rate}%` }}
                        />
                      </span>
                      {rate}%
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="num">
                  {r.goalDiff > 0 ? `+${r.goalDiff}` : r.goalDiff}
                </td>
                <td className="num">
                  <span className={showForm ? "pts-cell pts-cell--sub" : "pts-cell"}>
                    {showForm ? r.points : <CountUp value={r.points} />}
                  </span>
                </td>
                {showForm && (
                  <td className="num">
                    <span className="rating-wrap">
                      {r.rating != null ? (
                        <span className="rating-cell rating-cell--lead">
                          <CountUp value={r.rating} />
                        </span>
                      ) : (
                        "—"
                      )}
                      {r.history.length > 0 && (
                        <Sparkline history={r.history} name={r.name} />
                      )}
                    </span>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Mobiel: klassement als leesbare ranglijst i.p.v. krappe tabel ---------- */
function RankList({
  rows,
  meRef,
  lead,
}: {
  rows: Row[];
  meRef?: React.Ref<HTMLLIElement>;
  /** Welk getal groot staat: rating (spelers, #139) of punten (teams). */
  lead: "rating" | "points";
}) {
  const flipRef = useFlip<HTMLOListElement>(rows.map((r) => r.key).join("|"));
  return (
    <ol className="ranklist" ref={flipRef}>
      {rows.map((r, i) => {
        const body = (
          <>
            <span className="rank-wrap ranklist__rank">
              <span className={`rank rank--${i + 1}`}>{i + 1}</span>
              <ShiftBadge shift={r.shift} />
            </span>
            <Avatar profile={r.profile} name={r.name} size={36} />
            <span className="ranklist__main">
              <span className="ranklist__name">
                {r.name}
                {r.isMe && <span className="badge badge--accent">jij</span>}
              </span>
              <span className="ranklist__sub">
                {r.form.length > 0 && <FormChips form={r.form} size="sm" />}
                <span
                  aria-label={`${r.won} winst, ${r.drawn} gelijk, ${r.lost} verlies`}
                >
                  {r.won}·{r.drawn}·{r.lost}
                </span>
              </span>
            </span>
            <span className="ranklist__end">
              <span className="ranklist__lead">
                {lead === "rating" ? (
                  r.rating != null ? (
                    <CountUp value={r.rating} />
                  ) : (
                    "—"
                  )
                ) : (
                  <CountUp value={r.points} />
                )}
              </span>
              <span className="ranklist__lead-label">
                {lead === "rating" ? `${r.points} ptn` : "ptn"}
              </span>
            </span>
          </>
        );
        return (
          <li
            key={r.key}
            data-flip-key={r.key}
            ref={r.isMe ? meRef : undefined}
            className={`ranklist__row ${r.isMe ? "is-me" : ""}`}
          >
            {r.link ? (
              <Link
                className="ranklist__link"
                to={r.link}
                viewTransition
                onClick={primeAvatarMorph}
              >
                {body}
              </Link>
            ) : (
              <span className="ranklist__link">{body}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export default Leaderboard;