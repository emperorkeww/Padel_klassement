import type { CSSProperties, ReactNode } from "react";
import { tierTitle, type Tier } from "@/features/rating/tiers";
import type {
  DivisieKaartLayout,
  KaartZone,
  SpelerStatBron,
} from "./kaartLayout";
import "./DivisieVoorkant.css";

const zoneStijl = (zone: KaartZone) =>
  ({
    "--zone-x": zone.x,
    "--zone-y": zone.y,
    "--zone-breedte": zone.breedte,
    "--zone-hoogte": zone.hoogte,
    "--zone-draai": `${zone.draai ?? 0}deg`,
  }) as CSSProperties;

export function DivisieVoorkant({
  layout,
  elo,
  tier,
  avatar,
  naam,
  statBron = null,
}: {
  layout: DivisieKaartLayout;
  elo: number | null;
  tier: Tier | null;
  avatar: ReactNode;
  naam: string;
  statBron?: SpelerStatBron | null;
}) {
  return (
    <span
      className={`divisie-voorkant divisie-voorkant--${layout.className}`}
    >
      <span
        className="divisie-voorkant__zone divisie-voorkant__rating"
        style={zoneStijl(layout.zones.rating)}
      >
        {elo ?? "—"}
      </span>
      <span
        className="divisie-voorkant__zone divisie-voorkant__subniveau"
        style={zoneStijl(layout.zones.subniveau)}
      >
        {tier?.subLabel ?? ""}
      </span>
      {layout.zones.emoji && tier && (
        <span
          className="divisie-voorkant__zone divisie-voorkant__emoji"
          style={zoneStijl(layout.zones.emoji)}
          aria-hidden="true"
        >
          {tier.emoji}
        </span>
      )}
      <span
        className="divisie-voorkant__zone divisie-voorkant__portret"
        style={zoneStijl(layout.zones.portret)}
      >
        {avatar}
      </span>
      <span
        className="divisie-voorkant__zone divisie-voorkant__naam"
        style={zoneStijl(layout.zones.naam)}
      >
        {naam}
      </span>
      <span
        className="divisie-voorkant__zone divisie-voorkant__titel"
        style={zoneStijl(layout.zones.titel)}
        title={tier ? tierTitle(tier) : undefined}
      >
        {tier?.label ?? ""}
      </span>
      <span
        className="divisie-voorkant__zone divisie-voorkant__stats"
        style={zoneStijl(layout.zones.statistieken)}
        aria-label={`${layout.id}-eigenschappen`}
      >
        {layout.statistieken.map((stat) => (
          <span className="divisie-voorkant__stat" key={stat.label}>
            <span className="divisie-voorkant__stat-label">{stat.label}</span>
            <span className="divisie-voorkant__stat-waarde">
              {stat.waarde(statBron)}
            </span>
          </span>
        ))}
      </span>
    </span>
  );
}
