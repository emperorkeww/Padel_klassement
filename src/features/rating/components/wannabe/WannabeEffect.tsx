// Wannabe-breakout: één transparant master-artwork in drie exact geregistreerde
// lagen. Alleen clipping en diepte verschillen. Het artwork draagt de
// racketcrest boven de bovenrand, de megafoon in de schildpunt, de twee
// plakstroken, de briefjes "ALMOST THERE?" en "NOT BAD" met hun pijlen, het
// kruis, het kroontje met krassenbundel, de inktdruipers en het perkamentvuil
// met rasterpunten — de vroegere folieranden-, crest- en medaillon-SVG's van de
// goud-divisie zijn daarmee vervangen door één samenhangende bron.
//
// Het assetcontract staat in ASSET_SPEC.md; master en frontmasker komen uit
// scripts/wannabe-master.py.

import wannabeMaster from "./assets/wannabe-master.webp";
import "./WannabeEffect.css";

type WannabeLaag = "achter" | "binnen" | "voor";

function debugActief(): boolean {
  return (
    import.meta.env.DEV &&
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("debugWannabe")
  );
}

function WannabeMaster({ laag }: { laag: WannabeLaag }) {
  const debug = debugActief() ? " wannabe-effect--debug" : "";

  return (
    <span
      className={`wannabe-effect wannabe-effect--${laag}${debug}`}
      data-laag={laag}
      aria-hidden="true"
    >
      <span className="wannabe-effect__master" data-naam="wannabe-master.webp">
        <img
          src={wannabeMaster}
          alt=""
          draggable={false}
          decoding="sync"
          loading="eager"
        />
      </span>
    </span>
  );
}

export function WannabeEffectAchter() {
  return <WannabeMaster laag="achter" />;
}

export function WannabeEffectBinnen() {
  return <WannabeMaster laag="binnen" />;
}

export function WannabeEffectVoor() {
  return <WannabeMaster laag="voor" />;
}
