// Big Daddy-breakout: één transparant master-artwork in drie exact
// geregistreerde lagen. Alleen clipping en zichtselectie verschillen.

import bigDaddyMaster from "./assets/bigdaddy-master.webp";
import "./BigDaddyEffect.css";

type BigDaddyLaag = "achter" | "binnen" | "voor";

function debugActief(): boolean {
  return (
    import.meta.env.DEV &&
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("debugBigDaddy")
  );
}

function BigDaddyMaster({ laag }: { laag: BigDaddyLaag }) {
  const debug = debugActief() ? " bigdaddy-effect--debug" : "";

  return (
    <span
      className={`bigdaddy-effect bigdaddy-effect--${laag}${debug}`}
      data-laag={laag}
      aria-hidden="true"
    >
      <span
        className="bigdaddy-effect__master"
        data-naam="bigdaddy-master.webp"
      >
        <img
          src={bigDaddyMaster}
          alt=""
          draggable={false}
          decoding="sync"
          loading="eager"
        />
      </span>
    </span>
  );
}

export function BigDaddyEffectAchter() {
  return <BigDaddyMaster laag="achter" />;
}

export function BigDaddyEffectBinnen() {
  return <BigDaddyMaster laag="binnen" />;
}

export function BigDaddyEffectVoor() {
  return <BigDaddyMaster laag="voor" />;
}
