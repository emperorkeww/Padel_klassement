import { useState } from "react";
import { Link } from "react-router-dom";
import { Stat } from "@/ui/Stat";
import { Avatar } from "@/ui/Avatar";
import { TierBadge } from "@/features/rating/components/TierBadge";
import { RatingChart } from "@/features/rating/components/RatingChart";
import { winRate } from "@/features/rating/results";
import { bestWeekday, monthlyWinRate, opponentExtremes } from "@/features/profiles/trends";
import { formatDate } from "@/lib/utils/format";
import { displayName } from "@/features/profiles/api";
import { HighlightTile } from "@/features/profiles/components/HighlightTile";
import { PartnerSynergyMatrix } from "@/features/profiles/components/PartnerSynergyMatrix";
import { PreferenceStats } from "@/features/profiles/components/PreferenceStats";
import { DrankStats } from "@/features/profiles/components/DrankStats";
import { MilestoneTimeline } from "@/features/profiles/components/MilestoneTimeline";
import type { ProfileData, H2HRow } from "@/features/profiles/components/types";

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
    rhist,
    scoped,
    tmap,
    pmap,
    id,
    matchesLoading,
    h2h,
    nemesis,
    favoriet,
    vendettaMet,
  } = d;

  const [showAllH2H, setShowAllH2H] = useState(false);
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

      {/* Er stond een weergavewissel rating ⇄ positie, maar het positie-verloop
          draaide sinds #461 nooit meer (dode bron) — dus een toggle met altijd
          maar één optie. Opgeruimd in #918; zie PlayerProfile.tsx voor wat er
          nodig is om het terug te brengen. */}
      {hasRating && (
        <section className="card">
          <div className="card__head">
            <h2 className="card__title">Rating-verloop</h2>
          </div>
          <RatingChart history={rhist} />
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
                      {vendettaMet.has(row.oppId) && (
                        <span
                          className="badge badge--accent"
                          title="Actieve vendetta — de onderlinge stand is een lopend seizoen"
                        >
                          ⚔️
                        </span>
                      )}
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

      {/* Geavanceerde trends (#471): partner-synergie, baan-/tijdvoorkeuren en
          een mijlpalen-tijdlijn. Elk blok verbergt zichzelf zonder data. */}
      <div className="grid grid--2">
        <PartnerSynergyMatrix
          matches={scoped}
          teams={tmap}
          profiles={pmap}
          playerId={id}
        />
        <PreferenceStats matches={scoped} teams={tmap} playerId={id} />
        {/* Drankje-inzet (#1004): verbergt zichzelf zonder inzetten, net als
            de blokken ernaast. */}
        <DrankStats matches={scoped} teams={tmap} playerId={id} />
      </div>

      <MilestoneTimeline history={rhist} />
    </>
  );
}

export default ProfileStats;
