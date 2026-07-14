// De Pias-kaart (#167): de anti-MVP van de lopende periode. Bij scope "maand"
// de groepskaart "op weg naar de pias van de maand"; bij scope "week" het
// persoonlijke "pias-alarm" op het dashboard (los van de serverside "Pias van
// de week" #127, die per groep de choke aanduidt). Puur client-side uit de al
// geladen matches — zonder afgang boven de drempel rendert de kaart niets, net
// als RivalryCard.

import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Avatar } from "@/ui/Avatar";
import { CoachSneer } from "@/features/coach/components/CoachSneer";
import { bepaalPias, type MatchRatings } from "@/features/groups/maandpias";
import { monthRange, weekRange } from "@/features/dashboard/missions";
import { roastCtx, roastSeed } from "@/features/coach/roastTone";
import type { Match, Profile, RoastIntensiteit, Team } from "@/types";
import { displayName } from "@/features/profiles/api";
import { SharePias } from "@/features/groups/components/SharePias";
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
  intensiteit = "gemeen",
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
  /** Roast-toon van de groep (#183); bepaalt de commentator-sneer. */
  intensiteit?: RoastIntensiteit;
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
  const beschermd = profiles[pias.playerId]?.roast_schild ?? false;
  const titel = beschermd
    ? scope === "week"
      ? "📊 Opvallende week"
      : "📊 Opvallende maand"
    : scope === "week"
      ? "🤡 Pias-alarm"
      : "🤡 Op weg naar de pias van de maand";
  // Commentator-sneer (#183/#287): schild van de pias respecteren, toon = groep.
  // Coach Rudy spreekt nu als geattribueerde spreker (CoachSneer) i.p.v. een
  // losse 🎙️-emoji achter het detail.
  const ctx = roastCtx({ roast_intensiteit: intensiteit }, profiles[pias.playerId]);
  const seed = roastSeed(pias.playerId, periodeLabel);
  // Korte definitie die de Pias (maandelijkse afgang, reset per periode)
  // onderscheidt van de Zwarte Piet (rondgaand token). (#287)
  const lede =
    scope === "maand"
      ? "De grootste afgang van de maand. Schone lei zodra de nieuwe maand begint."
      : "De grootste afgang van deze week.";

  return (
    <section className="card pias-card pias-card--pias">
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
      <p className="pias-card__lede">{lede}</p>

      <Link className="pias-card__row" to={`/spelers/${pias.playerId}`}>
        <span className="pias-card__emoji" aria-hidden="true">{beschermd ? "📊" : "🤡"}</span>
        <Avatar profile={profiles[pias.playerId]} size={44} />
        <span className="pias-card__body">
          <span className="pias-card__name">
            {naam}
            {!beschermd && (
              <span className="pias-card__role pias-card__role--pias">Pias</span>
            )}
          </span>
          <span className="pias-card__detail">{pias.detail}</span>
        </span>
      </Link>

      <CoachSneer ctx={ctx} seed={seed} />

      <p className="pias-card__meta">
        {beschermd
          ? `${isZelf ? "Je" : "Deze speler"} had een opvallende periode. Geen roast: het roast-schild staat aan.`
          : isZelf
          ? "Code rood! Je bent momenteel de clown van de groep. Tijd om te trainen of je racket te verstoppen."
          : `Voorlopige schande van ${periodeLabel}. Gelukkig is er nog tijd om iemand anders erin te luizen.`}
      </p>
    </section>
  );
}

export default PiasCard;
