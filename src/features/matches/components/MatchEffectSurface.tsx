import type { Match } from "@/types";
import {
  drankIcon,
  drankLabel,
  traktatieRegel,
} from "@/features/matches/drankkaart";
import type { MatchEffecten } from "@/features/matches/matchEffecten";
import "./MatchEffectSurface.css";

type EffectNaam = keyof MatchEffecten;

/**
 * Vaste, brede banen per effect. De paden zijn bewust niet variabel per match:
 * dezelfde combinatie blijft daardoor overal herkenbaar en de browser kan de
 * kleine SVG's efficiënt hergebruiken. Iedere kleur heeft een andere stroom,
 * zodat combinaties niet samensmelten tot één gemiddelde tint.
 */
const EFFECT_PADEN: Record<EffectNaam, readonly [string, string]> = {
  lef: [
    "M -90 88 C 120 8, 255 122, 455 61 S 790 18, 1090 76",
    "M -70 105 C 155 35, 300 132, 520 78 S 835 37, 1080 93",
  ],
  joker: [
    "M -70 35 C 140 112, 315 -4, 545 53 S 835 108, 1085 20",
    "M -90 53 C 125 126, 335 15, 570 69 S 860 126, 1100 38",
  ],
  inzet: [
    "M -80 99 C 135 45, 315 118, 555 82 S 840 1, 1095 58",
    "M -75 116 C 155 63, 345 135, 585 98 S 865 21, 1090 76",
  ],
};

function EffectRibbon({ naam }: { naam: EffectNaam }) {
  return (
    <svg
      className={`match-effect-ribbon match-effect-ribbon--${naam}`}
      viewBox="0 0 1000 130"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      {EFFECT_PADEN[naam].map((pad, index) => (
        <g key={pad} className={index === 0 ? "is-main" : "is-echo"}>
          <path className="match-effect-ribbon__mist" d={pad} />
          <path className="match-effect-ribbon__body" d={pad} />
          <path className="match-effect-ribbon__core" d={pad} />
          <path className="match-effect-ribbon__glint" d={pad} />
        </g>
      ))}
    </svg>
  );
}

/** Decoratieve laag tussen het neutrale kaartvlak en de inhoud. */
export function MatchEffectSurface({ effecten }: { effecten: MatchEffecten }) {
  if (!effecten.lef && !effecten.joker && !effecten.inzet) return null;

  return (
    <span className="match-effect-surface" aria-hidden="true">
      {effecten.lef && <EffectRibbon naam="lef" />}
      {effecten.joker && <EffectRibbon naam="joker" />}
      {effecten.inzet && <EffectRibbon naam="inzet" />}
    </span>
  );
}

function Scheiding() {
  return (
    <span className="match-effect-badge__plus" aria-hidden="true">
      +
    </span>
  );
}

/**
 * Eén compacte badge, maar semantisch nog steeds losse gekleurde onderdelen.
 * De lange bestaande regels blijven als screenreadertekst aanwezig: visueel
 * scant de gebruiker de effecten, op het detail leest die alle namen/uitkomst.
 */
export function MatchEffectBadge({
  match,
  effecten,
  lef,
  joker,
}: {
  match: Match;
  effecten: MatchEffecten;
  lef?: string | null;
  joker?: string | null;
}) {
  const onderdelen: { naam: EffectNaam; icoon: string; label: string }[] = [];

  if (effecten.lef) {
    onderdelen.push({
      naam: "lef",
      icoon: "🎲",
      label: lef?.includes("×2") ? "LEF ×2" : "LEF",
    });
  }
  if (effecten.joker) {
    onderdelen.push({ naam: "joker", icoon: "🃏", label: "JOKER" });
  }
  if (effecten.inzet) {
    const aantal = Math.max(1, match.wager_drink_qty ?? 1);
    onderdelen.push({
      naam: "inzet",
      icoon: drankIcon(match.wager_drink) || "🍺",
      label: `${aantal > 1 ? `${aantal}× ` : ""}${
        drankLabel(match.wager_drink) || "drankje"
      }`.toLocaleUpperCase("nl-BE"),
    });
  }

  if (onderdelen.length === 0) return null;

  return (
    <span
      className="match-effect-badge"
      title={[lef, joker].filter(Boolean).join(" · ") || undefined}
    >
      {onderdelen.map((onderdeel, index) => (
        <span key={onderdeel.naam} className="match-effect-badge__group">
          {index > 0 && <Scheiding />}
          <span
            className={`match-effect-badge__part match-effect-badge__part--${onderdeel.naam}`}
            aria-hidden="true"
          >
            <span className="match-effect-badge__icon">{onderdeel.icoon}</span>
            {onderdeel.label}
          </span>
        </span>
      ))}
      {lef && <span className="sr-only">{lef}</span>}
      {joker && <span className="sr-only">{joker}</span>}
      {effecten.inzet && (
        <span className="sr-only">{traktatieRegel(match)}</span>
      )}
    </span>
  );
}
