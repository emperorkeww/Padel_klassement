import { drankTraktaties } from "@/features/profiles/trends";
import type { Match, Team } from "@/types";
import "./DrankStats.css";

/**
 * Drankstatistiek op het profiel (#1004): "meest gewonnen biertje" en "totaal
 * getrakteerde consumpties". Rekent op de al opgehaalde matches, dus geen extra
 * query — net als de andere trend-blokken.
 *
 * Verbergt zichzelf zolang deze speler nooit om een drankje speelde: twee lege
 * tegels zeggen niets, en de meeste profielen hebben (nog) geen inzet.
 */
export function DrankStats({
  matches,
  teams,
  playerId,
}: {
  matches: Match[];
  teams: Record<string, Team>;
  playerId: string;
}) {
  const { gewonnen, favoriet, totaalGewonnen, totaalGetrakteerd } =
    drankTraktaties(matches, teams, playerId);

  if (totaalGewonnen === 0 && totaalGetrakteerd === 0) return null;

  return (
    <section className="card">
      <h2 className="card__title">Aan de bar</h2>
      <p className="card__subtitle">
        Wat de drankje-inzetten opleverden — en wat ze kostten.
      </p>

      <div className="drankstats__tegels">
        <div className="drankstats__tegel">
          <span className="drankstats__label">Meest gewonnen drankje</span>
          {favoriet ? (
            <>
              <span className="drankstats__waarde">
                <span aria-hidden="true">{favoriet.icon}</span> {favoriet.label}
              </span>
              <span className="drankstats__meta">
                {favoriet.aantal}×, uit {favoriet.matches}{" "}
                {favoriet.matches === 1 ? "match" : "matches"}
              </span>
            </>
          ) : (
            <>
              <span className="drankstats__waarde">—</span>
              <span className="drankstats__meta">nog niets gewonnen</span>
            </>
          )}
        </div>

        <div className="drankstats__tegel">
          <span className="drankstats__label">Getrakteerde consumpties</span>
          <span className="drankstats__waarde">{totaalGetrakteerd}</span>
          <span className="drankstats__meta">
            {totaalGewonnen} gewonnen ·{" "}
            {/* Het saldo is wat je aan de bar voelt: meer gewonnen dan
                getrakteerd betekent dat er nog rondjes jouw kant op komen. */}
            {totaalGewonnen - totaalGetrakteerd >= 0
              ? `${totaalGewonnen - totaalGetrakteerd} in je voordeel`
              : `${totaalGetrakteerd - totaalGewonnen} in het rood`}
          </span>
        </div>
      </div>

      {gewonnen.length > 1 && (
        <ul className="drankstats__lijst">
          {gewonnen.slice(0, 5).map((d) => (
            <li key={d.slug} className="drankstats__rij">
              <span className="drankstats__rij-naam">
                <span aria-hidden="true">{d.icon}</span> {d.label}
              </span>
              <span className="drankstats__rij-aantal">{d.aantal}×</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default DrankStats;
