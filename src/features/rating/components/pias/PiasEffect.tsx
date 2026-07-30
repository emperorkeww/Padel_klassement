// Pias-breakout: één transparant master-artwork in drie pixelmatig
// geregistreerde lagen. Alleen clipping en zichtselectie verschillen.

import piasMaster from "./assets/pias-master.webp";
import "./PiasEffect.css";

type PiasLaag = "achter" | "binnen" | "voor";

function debugActief(): boolean {
  return (
    import.meta.env.DEV &&
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("debugPias")
  );
}

function PiasMaster({ laag }: { laag: PiasLaag }) {
  const debug = debugActief() ? " pias-effect--debug" : "";

  return (
    <span
      className={`pias-effect pias-effect--${laag}${debug}`}
      data-laag={laag}
      aria-hidden="true"
    >
      <span className="pias-effect__master" data-naam="pias-master.webp">
        <img
          src={piasMaster}
          alt=""
          draggable={false}
          decoding="sync"
          loading="eager"
        />
      </span>
    </span>
  );
}

export function PiasEffectAchter() {
  return <PiasMaster laag="achter" />;
}

export function PiasEffectBinnen() {
  return <PiasMaster laag="binnen" />;
}

export function PiasEffectVoor() {
  return <PiasMaster laag="voor" />;
}
