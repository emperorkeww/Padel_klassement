// Piet-breakout met één gedeeld register en fysiek gescheiden bronnen:
// achter/binnen dragen de gouden lijst met alles wat eromheen hangt, voor
// draagt uitsluitend de voorwerpen die de lijst kruisen — crest, medaille,
// staf, cadeau, zak, kolen en kettingen. Daardoor kan geen runtime-masker
// alsnog lijstpixels over een van die voorwerpen leggen.

import pietFront from "./assets/piet-front.webp";
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
  const voor = laag === "voor";
  const bron = voor ? pietFront : pietMaster;
  const bestandsnaam = voor ? "piet-front.webp" : "piet-master.webp";

  return (
    <span
      className={`piet-effect piet-effect--${laag}${debug}`}
      data-laag={laag}
      aria-hidden="true"
    >
      <span className="piet-effect__master" data-naam={bestandsnaam}>
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

export function PietEffectAchter() {
  return <PietMaster laag="achter" />;
}

export function PietEffectBinnen() {
  return <PietMaster laag="binnen" />;
}

export function PietEffectVoor() {
  return <PietMaster laag="voor" />;
}
