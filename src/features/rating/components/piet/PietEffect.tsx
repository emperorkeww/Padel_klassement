// Piet-breakout: één transparant master-artwork in drie pixelmatig
// geregistreerde lagen. Alleen clipping en zichtselectie verschillen.

import pietMaster from "./assets/piet-master.webp";
import "./PietEffect.css";

type PietLaag = "achter" | "binnen" | "voor";

function debugActief(): boolean {
  return (
    import.meta.env.DEV &&
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("debugPiet")
  );
}

function PietMaster({ laag }: { laag: PietLaag }) {
  const debug = debugActief() ? " piet-effect--debug" : "";

  return (
    <span
      className={`piet-effect piet-effect--${laag}${debug}`}
      data-laag={laag}
      aria-hidden="true"
    >
      <span className="piet-effect__master" data-naam="piet-master.webp">
        <img
          src={pietMaster}
          alt=""
          draggable={false}
          decoding="sync"
          loading="eager"
        />
      </span>
    </span>
  );
}

export function PietEffectAchter() {
  return <PietMaster laag="achter" />;
}

export function PietEffectBinnen() {
  return <PietMaster laag="binnen" />;
}

export function PietEffectVoor() {
  return <PietMaster laag="voor" />;
}
