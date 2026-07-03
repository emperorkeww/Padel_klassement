import { useCallback, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { useAsync } from "../../lib/useAsync";
import { useRealtime } from "../../lib/useRealtime";
import { Skeleton } from "../../components/Skeleton";
import { Avatar } from "../../components/Avatar";
import { FormChips } from "../../components/FormChips";
import { CountUp } from "../../components/CountUp";
import { useFlip } from "../../lib/useFlip";
import { recentForm, winRate, type Outcome } from "../../lib/results";
import { isSeasonClosed, listSeasons, seasonFromId } from "../../lib/seasons";
import {
  computePlayerStandings,
  computeTeamStandings,
  matchesInSeason,
} from "../../lib/standings";
import {
  getPlayerStandings,
  getTeamStandings,
  getGroupPlayerStandings,
} from "./api";
import { getMyGroups } from "../groups/api";
import { getPlayerRatings, getAllRatingHistories } from "./ratingsApi";
import { Sparkline } from "../../components/Sparkline";
import {
  getCompletedMatchesBetween,
  getFirstMatchDate,
  getRecentMatches,
  getTeamsMap,
  teamLabel,
} from "../matches/api";
import { getProfilesMap, displayName } from "../profiles/api";
import type { Match, Profile, RatingPoint } from "../../lib/types";
import "./Leaderboard.css";

type Tab = "player" | "team";

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
    if (id) next.set("seizoen", id);
    else next.delete("seizoen");
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

  // Live bijwerken bij nieuwe/aangepaste matches.
  const refresh = useCallback(() => {
    players.reload();
    teams.reload();
    teamsMap.reload();
    recent.reload();
    ratings.reload();
    histories.reload();
    seasonMatches.reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players.reload, teams.reload, teamsMap.reload, recent.reload, ratings.reload, histories.reload, seasonMatches.reload]);
  useRealtime("matches", refresh);

  const pmap = profilesMap.data ?? {};
  const tmap = teamsMap.data ?? {};
  const rmap = ratings.data ?? {};
  const hmap = histories.data ?? {};

  // Matches van het gekozen seizoen, met het groepsfilter toegepast.
  const scoped =
    season && seasonMatches.data
      ? matchesInSeason(seasonMatches.data, season).filter(
          (m) => !groupId || m.group_id === groupId,
        )
      : null;
  const playerStandings = season
    ? scoped
      ? computePlayerStandings(scoped, tmap, pmap)
      : []
    : (players.data ?? []);
  const teamStandings = season
    ? scoped
      ? computeTeamStandings(scoped, tmap)
      : []
    : (teams.data ?? []);

  // Vorm: binnen een seizoen alleen de matches van dat seizoen tonen.
  const formSource = season ? (scoped ?? []) : (recent.data ?? []);
  const formFor = (playerId: string): Outcome[] =>
    recentForm(formSource, tmap, playerId, 5);

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
    rating: rmap[p.player_id]?.rating ?? null,
    history: hmap[p.player_id] ?? [],
    form: formFor(p.player_id),
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
  }));

  const rows = tab === "player" ? playerRows : teamRows;
  // In seizoensweergave rekenen we zelf, dus wachten we op matches + lookups.
  const loading = season
    ? seasonMatches.loading || teamsMap.loading || profilesMap.loading
    : tab === "player"
      ? players.loading
      : teams.loading;
  const error = season
    ? seasonMatches.error
    : tab === "player"
      ? players.error
      : teams.error;
  const showPodium = tab === "player" && !loading && !error && rows.length >= 3;

  // Kampioensbanner: de nummer 1 van een volledig afgesloten kwartaal.
  const champion =
    season && isSeasonClosed(season) && !loading && !error && playerRows.length > 0
      ? playerRows[0]
      : null;

  // "Jouw positie": scrolt naar je eigen rij (tabel op desktop, lijst op mobiel).
  const meRowRef = useRef<HTMLTableRowElement | null>(null);
  const meItemRef = useRef<HTMLLIElement | null>(null);
  const myRankIdx = playerRows.findIndex((r) => r.isMe);
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
        <p className="page-subtitle">Winst = 3 punten, gelijkspel = 1, verlies = 0.</p>
      </header>

      <KlassementUitleg />

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
      </div>

      {champion && season && (
        <p className="champion-banner" role="status">
          <span className="champion-banner__cup" aria-hidden="true">
            🏆
          </span>
          <span>
            Kampioen {season.label}: <strong>{champion.name}</strong>
          </span>
        </p>
      )}

      {showPodium && <Podium rows={playerRows.slice(0, 3)} />}

      <div className="card">
        {loading ? (
          <Skeleton rows={5} />
        ) : error ? (
          <p className="msg msg--error">{error}</p>
        ) : rows.length === 0 ? (
          <p className="empty">
            {season
              ? "Geen matches in dit seizoen."
              : "Nog geen afgeronde matches."}
          </p>
        ) : (
          <>
            <StandingsTable
              rows={rows}
              showForm={tab === "player"}
              meRef={meRowRef}
            />
            <RankList rows={rows} meRef={meItemRef} />
          </>
        )}
      </div>

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
};

function Podium({ rows }: { rows: Row[] }) {
  const [first, second, third] = rows;
  // Visuele volgorde: zilver — goud — brons.
  const order: { row: Row; place: 1 | 2 | 3 }[] = [
    { row: second, place: 2 },
    { row: first, place: 1 },
    { row: third, place: 3 },
  ];

  return (
    <div className="podium" aria-label="Top 3">
      {order.map(({ row, place }) => (
        <Link
          key={row.key}
          to={row.link ?? "#"}
          className={`podium__spot podium__spot--${place} ${row.isMe ? "is-me" : ""}`}
        >
          <span className="podium__medal">{place}</span>
          <Avatar profile={row.profile} name={row.name} size={place === 1 ? 56 : 44} />
          <span className="podium__name">{row.name}</span>
          <span className="podium__pts">{row.points} ptn</span>
          <span className="podium__record">
            {row.won}W · {row.drawn}G · {row.lost}V
          </span>
        </Link>
      ))}
    </div>
  );
}

function KlassementUitleg() {
  return (
    <details className="explainer">
      <summary>Hoe werkt het klassement?</summary>
      <div className="explainer__body">
        <dl>
          <div>
            <dt>Punten</dt>
            <dd>
              Elke gewonnen match levert <strong>3 punten</strong> op, een
              gelijkspel <strong>1</strong> en een verlies <strong>0</strong>.
              Omdat er meestal op tijd wordt gespeeld, kan een match gelijk
              eindigen — dan krijgen beide teams één punt.
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
              Eerst op punten (hoog naar laag). Bij een gelijke stand telt het{" "}
              <strong>scoresaldo</strong> (punten voor min tegen), daarna het
              aantal gewonnen matches, en ten slotte de naam (alfabetisch).
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

function StandingsTable({
  rows,
  showForm,
  meRef,
}: {
  rows: Row[];
  showForm: boolean;
  meRef?: React.Ref<HTMLTableRowElement>;
}) {
  const flipRef = useFlip<HTMLTableSectionElement>(
    rows.map((r) => r.key).join("|"),
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
            <th className="num">Winst</th>
            <th className="num">Gelijk</th>
            <th className="num">Verlies</th>
            <th className="num">Winrate</th>
            <th className="num">Saldo</th>
            {showForm && <th className="num">Rating</th>}
            {showForm && <th className="col-trend">Verloop</th>}
            <th className="num">Punten</th>
          </tr>
        </thead>
        <tbody ref={flipRef}>
          {rows.map((r, i) => {
            const rate = winRate(r.won, r.played);
            return (
              <tr
                key={r.key}
                data-flip-key={r.key}
                ref={r.isMe ? meRef : undefined}
                className={r.isMe ? "is-me" : ""}
              >
                <td>
                  <span className={`rank rank--${i + 1}`}>{i + 1}</span>
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
                <td className="num">{r.won}</td>
                <td className="num">{r.drawn}</td>
                <td className="num">{r.lost}</td>
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
                {showForm && (
                  <td className="num">
                    {r.rating != null ? (
                      <span className="rating-cell">{r.rating}</span>
                    ) : (
                      "—"
                    )}
                  </td>
                )}
                {showForm && (
                  <td className="col-trend">
                    {r.history.length > 0 ? (
                      <Sparkline history={r.history} name={r.name} />
                    ) : (
                      <span className="empty empty--bare">—</span>
                    )}
                  </td>
                )}
                <td className="num">
                  <strong>
                    <CountUp value={r.points} />
                  </strong>
                </td>
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
}: {
  rows: Row[];
  meRef?: React.Ref<HTMLLIElement>;
}) {
  const flipRef = useFlip<HTMLOListElement>(rows.map((r) => r.key).join("|"));
  return (
    <ol className="ranklist" ref={flipRef}>
      {rows.map((r, i) => {
        const body = (
          <>
            <span className={`rank rank--${i + 1} ranklist__rank`}>{i + 1}</span>
            <Avatar profile={r.profile} name={r.name} size={36} />
            <span className="ranklist__main">
              <span className="ranklist__name">
                {r.name}
                {r.isMe && <span className="badge badge--accent">jij</span>}
              </span>
              <span className="ranklist__sub">
                {r.form.length > 0 && <FormChips form={r.form} size="sm" />}
                <span>
                  {r.won}W · {r.drawn}G · {r.lost}V
                </span>
              </span>
            </span>
            <span className="ranklist__end">
              <span className="ranklist__pts">
                <CountUp value={r.points} />
              </span>
              <span className="ranklist__pts-label">
                {r.rating != null ? `ptn · ${r.rating}` : "ptn"}
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