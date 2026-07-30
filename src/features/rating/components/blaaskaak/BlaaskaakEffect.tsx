// Blaaskaak-breakout: één transparant rasterartwork in drie exact
// geregistreerde lagen. Alleen clipping en diepte verschillen. Het artwork
// draagt de megafoon, geluidsschichten, comic-burst, tekstballon en het
// mondmedaillon uit de referentie; de vroegere buisprofielen, crest en
// resonator-SVG's van de zilverdivisie blijven alleen voor de posterfallback.

import blaaskaakMaster from "./assets/blaaskaak-master.webp";
import "./BlaaskaakEffect.css";

type BlaaskaakLaag = "achter" | "binnen" | "voor";

function debugActief(): boolean {
  return (
    import.meta.env.DEV &&
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("debugBlaaskaak")
  );
}

function BlaaskaakMaster({ laag }: { laag: BlaaskaakLaag }) {
  const debug = debugActief() ? " blaaskaak-effect--debug" : "";

  return (
    <span
      className={`blaaskaak-effect blaaskaak-effect--${laag}${debug}`}
      data-laag={laag}
      aria-hidden="true"
    >
      <span
        className="blaaskaak-effect__master"
        data-naam="blaaskaak-master.webp"
      >
        <img
          className="blaaskaak-effect__decor"
          src={blaaskaakMaster}
          alt=""
          draggable={false}
          decoding="sync"
          loading="eager"
        />
        {laag === "voor" && (
          <img
            className="blaaskaak-effect__megafoon"
            src={blaaskaakMaster}
            alt=""
            draggable={false}
            decoding="sync"
            loading="eager"
          />
        )}
      </span>
      {laag === "voor" && (
        <span className="blaaskaak-effect__burst">
          <span className="blaaskaak-effect__burst-symbolen">#!&amp;*</span>
        </span>
      )}
    </span>
  );
}

export function BlaaskaakEffectAchter() {
  return <BlaaskaakMaster laag="achter" />;
}

export function BlaaskaakEffectBinnen() {
  return <BlaaskaakMaster laag="binnen" />;
}

export function BlaaskaakEffectVoor() {
  return <BlaaskaakMaster laag="voor" />;
}
