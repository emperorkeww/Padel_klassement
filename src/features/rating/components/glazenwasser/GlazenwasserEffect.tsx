// Glazenwasser-breakout: één transparant master-artwork in drie pixelmatig
// geregistreerde lagen. Alleen clipping en zichtselectie verschillen. Het artwork
// draagt de raamcrest, het schuim over de bovenhoeken, de trekker met sopstrepen,
// de ophanging met sopemmer, de schildbadge met de tweede trekker, de
// waterexplosie langs de onderrand en de natte glaswand in het kaartvlak — de
// vroegere vector-crest, paneelklemmen, veegbogen en het glasmedaillon zijn
// daarmee vervangen door één samenhangende bron.

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

  return (
    <span
      className={`glazenwasser-effect glazenwasser-effect--${laag}${debug}`}
      data-laag={laag}
      aria-hidden="true"
    >
      <span
        className="glazenwasser-effect__master"
        data-naam="glazenwasser-master.webp"
      >
        <img
          src={glazenwasserMaster}
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
