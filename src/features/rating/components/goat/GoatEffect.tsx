// GOAT-breakout: één transparant master-artwork in drie exact geregistreerde
// lagen. Alleen clipping en diepte verschillen. Het artwork draagt het
// monument (bokhoorns, geitenstandbeeld op de rots), de kristalclusters langs
// de flanken, de bergscene in het kaartvlak en de edelsteen-chevron in de
// schildpunt — de vroegere hoorn- en baardfiligraan-SVG's zijn daarmee
// vervangen door één samenhangende bron.

import goatMaster from "./assets/goat-master.webp";
import "./GoatEffect.css";

type GoatLaag = "achter" | "binnen" | "voor";

function debugActief(): boolean {
  return (
    import.meta.env.DEV &&
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("debugGoat")
  );
}

function GoatMaster({ laag }: { laag: GoatLaag }) {
  const debug = debugActief() ? " goat-effect--debug" : "";

  return (
    <span
      className={`goat-effect goat-effect--${laag}${debug}`}
      data-laag={laag}
      aria-hidden="true"
    >
      <span className="goat-effect__master" data-naam="goat-master.webp">
        <img
          src={goatMaster}
          alt=""
          draggable={false}
          decoding="sync"
          loading="eager"
        />
      </span>
    </span>
  );
}

export function GoatEffectAchter() {
  return <GoatMaster laag="achter" />;
}

export function GoatEffectBinnen() {
  return <GoatMaster laag="binnen" />;
}

export function GoatEffectVoor() {
  return <GoatMaster laag="voor" />;
}
