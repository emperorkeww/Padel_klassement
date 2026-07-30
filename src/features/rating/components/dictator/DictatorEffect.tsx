// El Padelissimo-breakout: één transparant master-artwork in drie exact
// geregistreerde lagen. Alleen clipping en diepte verschillen.

import dictatorMaster from "./assets/dictator-master.webp";
import "./DictatorEffect.css";

type DictatorLaag = "achter" | "binnen" | "voor";

function debugActief(): boolean {
  return (
    import.meta.env.DEV &&
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("debugDictator")
  );
}

function DictatorMaster({ laag }: { laag: DictatorLaag }) {
  const debug = debugActief() ? " dictator-effect--debug" : "";

  return (
    <span
      className={`dictator-effect dictator-effect--${laag}${debug}`}
      data-laag={laag}
      aria-hidden="true"
    >
      <span
        className="dictator-effect__master"
        data-naam="dictator-master.webp"
      >
        <img
          src={dictatorMaster}
          alt=""
          draggable={false}
          decoding="async"
          loading="eager"
        />
      </span>
    </span>
  );
}

export function DictatorEffectAchter() {
  return <DictatorMaster laag="achter" />;
}

export function DictatorEffectBinnen() {
  return <DictatorMaster laag="binnen" />;
}

export function DictatorEffectVoor() {
  return <DictatorMaster laag="voor" />;
}
