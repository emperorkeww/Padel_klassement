// De Pias-kaart (#167): de anti-MVP van de lopende periode. Bij scope "maand"
// de groepskaart "op weg naar de pias van de maand"; bij scope "week" het
// persoonlijke "pias-alarm" op het dashboard (los van de serverside "Pias van
// de week" #127, die per groep de choke aanduidt). Puur client-side uit de al
// geladen matches — zonder afgang boven de drempel rendert de kaart niets, net
// als RivalryCard.

import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Avatar } from "../../components/Avatar";
import { bepaalPias, type MatchRatings } from "../../lib/maandpias";
import { monthRange, weekRange } from "../../lib/missions";
import type { Match, Profile, Team } from "../../lib/types";
import { displayName } from "../profiles/api";
import { SharePias } from "./SharePias";
import "./PiasCard.css";

const MAANDEN_NL = [
  "januari", "februari", "maart", "april", "mei", "juni",
  "juli", "augustus", "september", "oktober", "november", "december",
];

export function PiasCard({
  matches,
  teams,
  profiles,
  ratingsByMatch,
  scope = "maand",
  now = new Date(),
  restrictTo,
  selfId,
}: {
  matches: Match[];
  teams: Record<string, Team>;
  profiles: Record<string, Profile>;
  ratingsByMatch?: Map<string, MatchRatings>;
  scope?: "week" | "maand";
  now?: Date;
  /** Toon de kaart alleen als déze speler de pias grijpt (bv. eigen dashboard). */
  restrictTo?: string;
  /** Speler die "jij" is → tweede persoon in de tekst. */
  selfId?: string;
}) {
  const period = useMemo(
    () => (scope === "maand" ? monthRange(now) : weekRange(now)),
    [scope, now],
  );
  const pias = useMemo(
    () => bepaalPias(matches, teams, period, ratingsByMatch),
    [matches, teams, period, ratingsByMatch],
  );
  if (!pias) return null;
  if (restrictTo && pias.playerId !== restrictTo) return null;

  const periodeLabel =
    scope === "maand"
      ? `${MAANDEN_NL[period.start.getMonth()]} ${period.start.getFullYear()}`
      : "deze week";
  const isZelf = selfId != null && pias.playerId === selfId;
  const naam = isZelf ? "Jij" : displayName(profiles[pias.playerId]);
  const titel = scope === "week" ? "🤡 Pias-alarm" : "🤡 Op weg naar de pias van de maand";

  return (
    <section className="card pias-card">
      <div className="card__head">
        <h2 className="card__title">{titel}</h2>
        <SharePias
          naam={isZelf ? displayName(profiles[pias.playerId]) : naam}
          detail={pias.detail}
          periodeLabel={periodeLabel}
          reden={pias.reden}
          scope={scope}
        />
      </div>

      <Link className="pias-card__row" to={`/spelers/${pias.playerId}`}>
        <span className="pias-card__emoji" aria-hidden="true">🤡</span>
        <Avatar profile={profiles[pias.playerId]} size={44} />
        <span className="pias-card__body">
          <span className="pias-card__name">{naam}</span>
          <span className="pias-card__detail">{pias.detail}</span>
        </span>
      </Link>

      <p className="pias-card__meta">
        {isZelf
          ? "Pas op — jij gaat hard achteruit deze week. Zet 'm recht."
          : `Voorlopige schande van ${periodeLabel} — nog tijd om het recht te zetten.`}
      </p>
    </section>
  );
}

export default PiasCard;
