// Glazenwasser-breakout met één gedeeld register en fysiek gescheiden bronnen:
// back/inside dragen achterwater en frame, front draagt uitsluitend de
// frame-breakers. Daardoor kan de metalen rail nooit in de voorgrondpixels van
// emmer, spons, schuim of trekker terechtkomen.

import glazenwasserFront from "./assets/glazenwasser-front.webp";
import glazenwasserMaster from "./assets/glazenwasser-master.webp";
import "./GlazenwasserEffect.css";

type GlazenwasserLaag = "achter" | "binnen" | "voor";

function debugActief(): boolean {
  return (
    import.meta.env.DEV &&
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("debugGlazenwasser")
  );
}

function GlazenwasserMaster({ laag }: { laag: GlazenwasserLaag }) {
  const debug = debugActief() ? " glazenwasser-effect--debug" : "";
  const voor = laag === "voor";
  const bron = voor ? glazenwasserFront : glazenwasserMaster;
  const bestandsnaam = voor
    ? "glazenwasser-front.webp"
    : "glazenwasser-master.webp";

  return (
    <span
      className={`glazenwasser-effect glazenwasser-effect--${laag}${debug}`}
      data-laag={laag}
      aria-hidden="true"
    >
      <span
        className="glazenwasser-effect__master"
        data-naam={bestandsnaam}
      >
        <img
          src={bron}
          alt=""
          draggable={false}
          decoding="sync"
          loading="eager"
        />
      </span>
    </span>
  );
}

export function GlazenwasserEffectAchter() {
  return <GlazenwasserMaster laag="achter" />;
}

export function GlazenwasserEffectBinnen() {
  return <GlazenwasserMaster laag="binnen" />;
}

export function GlazenwasserEffectVoor() {
  return <GlazenwasserMaster laag="voor" />;
}
