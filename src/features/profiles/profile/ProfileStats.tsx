import { useState } from "react";
import { Link } from "react-router-dom";
import { Stat } from "../../../components/Stat";
import { Avatar } from "../../../components/Avatar";
import { TierBadge } from "../../../components/TierBadge";
import { RatingChart } from "../../../components/RatingChart";
import { RankChart } from "../../../components/RankChart";
import { winRate } from "@/features/rating/results";
import { bestWeekday, monthlyWinRate, opponentExtremes } from "@/features/profiles/trends";
import { formatDate } from "@/lib/utils/format";
import { displayName } from "../api";
import { HighlightTile } from "./HighlightTile";
import type { ProfileData, H2HRow } from "./types";

// Statistieken-tab: het volledige cijferbeeld — 5-stat grid, het wisselbare
// rating/positie-verloop, trends, prestaties, beste maatje en de onderlinge
// stand. De grafiek-tab en de "toon alles"-toggle zijn puur lokale UI-state.
export function ProfileStats({ d }: { d: ProfileData }) {
  const {
    s,
    myRating,
    thinRating,
    rank,
    rate,
    playedCount,
    ratingDelta,
    best,
    bigWin,
    partner,
    hasRating,
    hasRank,
    rhist,
    rankPoints,
    scoped,
    tmap,
    pmap,
    id,
    matchesLoading,
    h2h,
    nemesis,
    favoriet,
  } = d;

  const [chartTab, setChartTab] = useState<"rating" | "positie">("rating");
  const [showAllH2H, setShowAllH2H] = useState(false);
  const chartShown =
    hasRating && hasRank ? chartTab : hasRating ? "rating" : "positie";
  const h2hShown = showAllH2H ? h2h : h2h.slice(0, 5);

  const months = monthlyWinRate(scoped, tmap, id);
  const { favorite, hardest } = opponentExtremes(scoped, tmap, id);
  const day = bestWeekday(scoped, tmap, id);
  const heeftTrends = months.length >= 2 || !!favorite || !!hardest || !!day;

  return (
    <>
      <div className="stats">
        <Stat
          label="Rating"
          value={myRating ?? "—"}
          delta={ratingDelta}
          primary
          badge={
            myRating != null ? (
              <TierBadge rating={myRating} dimmed={thinRating} size="sm" />
            ) : undefined
          }
        />
        <Stat label="Positie" value={rank ? `#${rank}` : "—"} />
        <Stat label="Punten" value={s?.points ?? 0} />
        <Stat label="Winrate" value={rate != null ? `${rate}%` : "—"} />
        <Stat label="Gespeeld" value={playedCount} />
      </div>

      {(hasRating || hasRank) && (
        <section className="card">
          <div className="card__head">
            <h2 className="card__title">
              {chartShown === "rating" ? "Rating-verloop" : "Positie-verloop"}
            </h2>
            {hasRating && hasRank && (
              <div
                className="tabs tabs--head"
                role="group"
                aria-label="Grafiek-weergave"
              >
                <button
                  type="button"
                  className={`tab ${chartShown === "rating" ? "is-active" : ""}`}
                  onClick={() => setChartTab("rating")}
                >
                  Rating
                </button>
                <button
                  type="button"
                  className={`tab ${chartShown === "positie" ? "is-active" : ""}`}
                  onClick={() => setChartTab("positie")}
                >
                  Positie
                </button>
              </div>
            )}
          </div>
          {chartShown === "rating" ? (
            <RatingChart history={rhist} />
          ) : (
            <>
              <p className="card__subtitle">
                Klassementspositie na elke speeldag — de stand is telkens berekend uit
                alle matches t/m die dag.
              </p>
              <RankChart points={rankPoints} />
            </>
          )}
        </section>
      )}

      <div className="grid grid--2">
        <div className="profile-grid__col">
          {!matchesLoading && heeftTrends && (
            <section className="card">
              <h2 className="card__title">Trends</h2>
              {months.length >= 2 && (
                <div
                  className="trend-months"
                  role="img"
                  aria-label={`Win-percentage per maand: ${months
                    .map((mo) => `${mo.label} ${mo.rate}%`)
                    .join(", ")}`}
                >
                  {months.map((mo) => (
                    <div key={mo.month} className="trend-month">
                      <span className="trend-month__rate">{mo.rate}%</span>
                      <span className="trend-month__barwrap" aria-hidden="true">
                        <span
                          className="trend-month__bar"
                          style={{ height: `${Math.max(mo.rate, 4)}%` }}
                          title={`${mo.won} van ${mo.played} gewonnen`}
                        />
                      </span>
                      <span className="trend-month__label">{mo.label}</span>
                    </div>
                  ))}
                </div>
              )}
              {(favorite || hardest || day) && (
                <div className="highlight-tiles">
                  {favorite && (
                    <HighlightTile
                      icon="💪"
                      label="Sterkst tegen"
                      value={
                        <Link
                          className="highlight-tile__link"
                          to={`/spelers/${favorite.oppId}`}
                        >
                          {displayName(pmap[favorite.oppId])}
                        </Link>
                      }
                      meta={
                        <>
                          {favorite.won}–{favorite.lost} in {favorite.played} duels
                        </>
                      }
                    />
                  )}
                  {hardest && (
                    <HighlightTile
                      icon="😅"
                      label="Lastigst"
                      value={
                        <Link
                          className="highlight-tile__link"
                          to={`/spelers/${hardest.oppId}`}
                        >
                          {displayName(pmap[hardest.oppId])}
                        </Link>
                      }
                      meta={
                        <>
                          {hardest.won}–{hardest.lost} in {hardest.played} duels
                        </>
                      }
                    />
                  )}
                  {day && (
                    <HighlightTile
                      icon="📅"
                      label="Beste dag"
                      value={<strong>{day.label}</strong>}
                      meta={
                        <>
                          {day.rate}% winst over {day.played} matches
                        </>
                      }
                    />
                  )}
                </div>
              )}
            </section>
          )}

          {(best > 0 || bigWin) && (
            <section className="card">
              <h2 className="card__title">Prestaties</h2>
              <div className="achievements">
                {best > 0 && (
                  <div className="achievement">
                    <span className="achievement__icon">🔥</span>
                    <div>
                      <span className="achievement__value">{best}</span>
                      <span className="achievement__label">Langste winreeks</span>
                    </div>
                  </div>
                )}
                {bigWin && (
                  <Link
                    className="achievement achievement--link"
                    to={`/matches/${bigWin.match.id}`}
                  >
                    <span className="achievement__icon">🏆</span>
                    <div>
                      <span className="achievement__value">
                        {bigWin.match.score_a}–{bigWin.match.score_b}
                      </span>
                      <span className="achievement__label">
                        Grootste zege · +{bigWin.margin} ·{" "}
                        {formatDate(bigWin.match.played_at ?? bigWin.match.created_at)}
                      </span>
                    </div>
                  </Link>
                )}
              </div>
            </section>
          )}
        </div>

        <div className="profile-grid__col">
          {partner && (
            <section className="card partner-card">
              <h2 className="card__title">Beste maatje</h2>
              <div className="partner-card__row">
                <Avatar profile={pmap[partner.partnerId]} size={40} />
                <div>
                  <Link
                    className="profile-link"
                    to={`/spelers/${partner.partnerId}`}
                  >
                    {displayName(pmap[partner.partnerId])}
                  </Link>
                  <p className="partner-card__sub">
                    {winRate(partner.gewonnen, partner.samen)}% samen gewonnen (
                    {partner.samen} matches)
                  </p>
                </div>
              </div>
            </section>
          )}

          {h2h.length > 0 && (
            <section className="card">
              <h2 className="card__title">Onderlinge stand</h2>

              {(nemesis || favoriet) && (
                <div className="h2h-highlights">
                  {favoriet && (
                    <div className="h2h-highlight h2h-highlight--fav">
                      <span className="h2h-highlight__tag">😎 Favoriete tegenstander</span>
                      <Link
                        className="h2h-highlight__player"
                        to={`/spelers/${favoriet.oppId}`}
                      >
                        <Avatar profile={pmap[favoriet.oppId]} size={28} />
                        <span className="h2h__name">
                          {displayName(pmap[favoriet.oppId])}
                        </span>
                      </Link>
                      <span className="h2h-highlight__meta">
                        {favoriet.won}× gewonnen van {favoriet.played}
                      </span>
                    </div>
                  )}
                  {nemesis && nemesis.oppId !== favoriet?.oppId && (
                    <div className="h2h-highlight h2h-highlight--nemesis">
                      <span className="h2h-highlight__tag">😤 Nemesis</span>
                      <Link
                        className="h2h-highlight__player"
                        to={`/spelers/${nemesis.oppId}`}
                      >
                        <Avatar profile={pmap[nemesis.oppId]} size={28} />
                        <span className="h2h__name">
                          {displayName(pmap[nemesis.oppId])}
                        </span>
                      </Link>
                      <span className="h2h-highlight__meta">
                        {nemesis.lost}× verloren van {nemesis.played}
                      </span>
                    </div>
                  )}
                </div>
              )}

              <ul className="h2h">
                {h2hShown.map((row: H2HRow) => (
                  <li key={row.oppId} className="h2h__row">
                    <Link className="h2h__player" to={`/spelers/${row.oppId}`}>
                      <Avatar profile={pmap[row.oppId]} size={28} />
                      <span className="h2h__name">{displayName(pmap[row.oppId])}</span>
                    </Link>
                    <span className="h2h__record">
                      <span className="h2h__w">{row.won}</span>
                      <span className="h2h__sep">–</span>
                      {row.drawn > 0 && (
                        <>
                          <span className="h2h__d">{row.drawn}</span>
                          <span className="h2h__sep">–</span>
                        </>
                      )}
                      <span className="h2h__l">{row.lost}</span>
                    </span>
                  </li>
                ))}
              </ul>
              {h2h.length > 5 && (
                <button
                  type="button"
                  className="btn btn--sm h2h__toggle"
                  onClick={() => setShowAllH2H((v) => !v)}
                >
                  {showAllH2H ? "Toon minder" : `Toon alles (${h2h.length})`}
                </button>
              )}
            </section>
          )}
        </div>
      </div>
    </>
  );
}

export default ProfileStats;
