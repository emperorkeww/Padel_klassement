// In-Form stormeffect (#834): één transparant master-artwork wordt in drie
// lagen herhaald. De gedeelde CSS-transform laat wolk en bliksem pixelmatig
// doorlopen; alleen de clipping verschilt per laag.
//
//   1. InformStormAchter — het volledige artwork achter kaart en frame.
//   2. InformStormBinnen — hetzelfde artwork in .fut-kaart__vlak, dus door
//      de actuele `var(--schild)` van de kaartvariant gemaskeerd.
//   3. InformStormVoor   — hetzelfde artwork door een klein frontmasker,
//      plaatselijk vóór het frame.

import stormMaster from "./assets/in-form/storm-master.webp";
import "./InformStorm.css";

type StormLaag = "achter" | "binnen" | "voor";

/** Alleen in development en alleen met ?debugStorm=1 in de URL. */
function debugActief(): boolean {
  return (
    import.meta.env.DEV &&
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("debugStorm")
  );
}

function StormMaster({ laag }: { laag: StormLaag }) {
  const debug = debugActief() ? " inform-storm--debug" : "";

  return (
    <span
      className={`inform-storm inform-storm--${laag}${debug}`}
      data-laag={laag}
      aria-hidden="true"
    >
      <span className="inform-storm__master" data-naam="storm-master.webp">
        <img
          src={stormMaster}
          alt=""
          draggable={false}
          decoding="async"
          loading="eager"
        />
      </span>
    </span>
  );
}

/** Laag 1: volledige buitenmassa achter kaart en frame. */
export function InformStormAchter() {
  return <StormMaster laag="achter" />;
}

/** Laag 2: exact door het bestaande kaartvlak/schild gemaskeerd. */
export function InformStormBinnen() {
  return <StormMaster laag="binnen" />;
}

/** Laag 3: twee geselecteerde occlusies vóór de rechterframerand. */
export function InformStormVoor() {
  return <StormMaster laag="voor" />;
}
