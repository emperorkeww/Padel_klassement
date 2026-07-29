// On Fire-breakout: één transparante vulkaanmaster wordt in drie exact
// geregistreerde lagen herhaald. Alleen clipping en laagpositie verschillen.

import onfireMaster from "./assets/onfire-master.webp";
import "./OnfireEffect.css";

type OnfireLaag = "achter" | "binnen" | "voor";

function debugActief(): boolean {
  return (
    import.meta.env.DEV &&
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("debugOnfire")
  );
}

function OnfireMaster({ laag }: { laag: OnfireLaag }) {
  const debug = debugActief() ? " onfire-effect--debug" : "";

  return (
    <span
      className={`onfire-effect onfire-effect--${laag}${debug}`}
      data-laag={laag}
      aria-hidden="true"
    >
      <span
        className="onfire-effect__master"
        data-naam="onfire-master.webp"
      >
        <img
          src={onfireMaster}
          alt=""
          draggable={false}
          decoding="async"
          loading="eager"
        />
      </span>
    </span>
  );
}

export function OnfireEffectAchter() {
  return <OnfireMaster laag="achter" />;
}

export function OnfireEffectBinnen() {
  return <OnfireMaster laag="binnen" />;
}

export function OnfireEffectVoor() {
  return <OnfireMaster laag="voor" />;
}
