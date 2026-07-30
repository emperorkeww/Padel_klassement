import type { CSSProperties } from "react";
import {
  onderdelenPerSlot,
  type DivisieKaartLayout,
  type KaartOnderdeelSlot,
} from "./kaartLayout";
import "./KaartOnderdelen.css";

export function KaartOnderdelen({
  layout,
  slot,
}: {
  layout: DivisieKaartLayout;
  slot: KaartOnderdeelSlot;
}) {
  const onderdelen = onderdelenPerSlot(layout, slot);
  if (onderdelen.length === 0) return null;

  return (
    <span
      className={`kaart-onderdelen kaart-onderdelen--${slot}`}
      aria-hidden="true"
    >
      {onderdelen.map((onderdeel) => (
        <img
          key={onderdeel.id}
          className={`kaart-onderdelen__beeld kaart-onderdelen__beeld--${onderdeel.id}`}
          src={onderdeel.src}
          alt=""
          draggable={false}
          style={
            {
              "--onderdeel-x": onderdeel.x,
              "--onderdeel-y": onderdeel.y,
              "--onderdeel-breedte": onderdeel.breedte,
              "--onderdeel-hoogte": onderdeel.hoogte,
              "--onderdeel-draai": `${onderdeel.draai ?? 0}deg`,
            } as CSSProperties
          }
        />
      ))}
    </span>
  );
}
