import { Link } from "react-router-dom";
import { Avatar } from "@/ui/Avatar";
import { displayName } from "@/features/profiles/api";
import { HighlightTile } from "@/features/profiles/components/HighlightTile";
import { partnerSynergy, synergyExtremes } from "@/features/profiles/synergy";
import type { Match, Profile, Team } from "@/types";

// Partner-synergie (#471): Dream Team + Choke Combo bovenaan, daaronder het
// volledige rapport per maatje met een win%-balkje. Puur presentatie; de
// cijfers komen uit synergy.ts.
export function PartnerSynergyMatrix({
  matches,
  teams,
  profiles,
  playerId,
}: {
  matches: Match[];
  teams: Record<string, Team>;
  profiles: Record<string, Profile>;
  playerId: string;
}) {
  const rows = partnerSynergy(matches, teams, playerId);
  if (rows.length === 0) return null;
  const { dreamTeam, chokeCombo } = synergyExtremes(rows);

  return (
    <section className="card">
      <h2 className="card__title">Partner-synergie</h2>
      <p className="card__subtitle">
        Je winstpercentage per maatje — met wie klikt het, en met wie stroef?
      </p>

      {(dreamTeam || chokeCombo) && (
        <div className="highlight-tiles">
          {dreamTeam && (
            <HighlightTile
              icon="🏆"
              label="Dream Team"
              value={
                <Link
                  className="highlight-tile__link"
                  to={`/spelers/${dreamTeam.partnerId}`}
                >
                  {displayName(profiles[dreamTeam.partnerId])}
                </Link>
              }
              meta={
                <>
                  {dreamTeam.rate}% samen · {dreamTeam.gewonnen}–
                  {dreamTeam.verloren} in {dreamTeam.samen}
                </>
              }
            />
          )}
          {chokeCombo && (
            <HighlightTile
              icon="🥶"
              label="Choke Combo"
              value={
                <Link
                  className="highlight-tile__link"
                  to={`/spelers/${chokeCombo.partnerId}`}
                >
                  {displayName(profiles[chokeCombo.partnerId])}
                </Link>
              }
              meta={
                <>
                  {chokeCombo.rate}% samen · {chokeCombo.gewonnen}–
                  {chokeCombo.verloren} in {chokeCombo.samen}
                </>
              }
            />
          )}
        </div>
      )}

      <ul className="synergy">
        {rows.map((r) => (
          <li key={r.partnerId} className="synergy__row">
            <Link className="synergy__player" to={`/spelers/${r.partnerId}`}>
              <Avatar profile={profiles[r.partnerId]} size={28} />
              <span className="synergy__name">
                {displayName(profiles[r.partnerId])}
              </span>
            </Link>
            <span className="synergy__bar" aria-hidden="true">
              <span
                className="synergy__fill"
                style={{ width: `${Math.max(r.rate, 2)}%` }}
              />
            </span>
            <span className="synergy__rate">{r.rate}%</span>
            <span className="synergy__record">
              {r.gewonnen}–{r.verloren}
              {r.gelijk > 0 && `–${r.gelijk}`}
              <span className="synergy__samen"> · {r.samen}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default PartnerSynergyMatrix;
