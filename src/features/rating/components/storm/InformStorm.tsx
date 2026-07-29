// In-Form stormeffect (#834): de storm die uit de kaart breekt, opgebouwd
// uit losse transparante assets in drie React-lagen rond de bestaande kaart
// (de kaart zelf is laag 2 en blijft ongewijzigd):
//
//   1. InformStormAchter  — vóór de zijden in de DOM, dus áchter de kaart:
//      de grote wolkenmassa rechts, de hoofdbliksem en het secundaire
//      wolkje linksonder.
//   3. InformStormBinnen  — ín .fut-kaart__vlak: de massa die binnen het
//      rechterdeel van het kaartvlak begint. Het vlak draagt clip-path:
//      var(--schild), dus deze laag is automatisch gemaskeerd met de exácte
//      kaartvorm; hij staat vóór de vlakachtergrond maar vóór de inhoud in
//      documentvolgorde, dus tekst en avatar blijven erbovenop leesbaar.
//   4. InformStormVoor    — ná de vóór-ornamentlaag: kleinere wolkendelen,
//      bliksemsegmenten, debris en vonken die plaatselijk óver het gouden
//      frame liggen, plus de frameglow (mix-blend-mode: screen).
//
// Posities staan in InformStorm.css als custom properties op
// .fut-kaart--inform, procentueel t.o.v. de kaartstage. De assets zijn
// placeholders voor webp's — zie ./MANIFEST.md.
//
// Debugmodus (?debugStorm=1, alleen dev): gekleurde bounding boxes, labels
// en ankerpunten per asset.

import wolkAchter from "./assets/storm-cloud-back-right.svg";
import wolkBinnen from "./assets/storm-cloud-inside-right.svg";
import wolkVoor from "./assets/storm-cloud-front-right.svg";
import wolkLinks from "./assets/storm-cloud-bottom-left.svg";
import bliksemAchterAsset from "./assets/lightning-back-right.svg";
import bliksemVoorAsset from "./assets/lightning-front-right.svg";
import gloed from "./assets/storm-glow-right.svg";
import puin from "./assets/storm-debris.svg";
import vonken from "./assets/storm-sparks.svg";
import "./InformStorm.css";

/** Alleen in development en alleen met ?debugStorm=1 in de URL — de
 *  productiebundel strip't de hele tak dankzij import.meta.env.DEV. */
function debugActief(): boolean {
  return (
    import.meta.env.DEV &&
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("debugStorm")
  );
}

/** Eén gepositioneerd asset: wrapper-span (positie + debuglabel) met de
 *  afbeelding erin. `naam` is de assetbestandsnaam, zichtbaar in debug. */
function Asset({
  naam,
  src,
  className,
}: {
  naam: string;
  src: string;
  className: string;
}) {
  return (
    <span className={`inform-storm__asset ${className}`} data-naam={naam}>
      <img src={src} alt="" draggable={false} loading="lazy" />
    </span>
  );
}

function laagKlasse(laag: "achter" | "binnen" | "voor"): string {
  return `inform-storm inform-storm--${laag}${
    debugActief() ? " inform-storm--debug" : ""
  }`;
}

/** Laag 1 — stormBackLayer: achter de kaart en achter het frame. */
export function InformStormAchter() {
  return (
    <span className={laagKlasse("achter")} data-laag="back" aria-hidden="true">
      <Asset
        naam="storm-glow-right"
        src={gloed}
        className="inform-storm__gloed-achter"
      />
      <Asset
        naam="storm-cloud-back-right"
        src={wolkAchter}
        className="inform-storm__wolk-achter"
      />
      <Asset
        naam="lightning-back-right"
        src={bliksemAchterAsset}
        className="inform-storm__bliksem-achter"
      />
      {/* Tweede instantie van dezelfde massa, gespiegeld en lager: zo loopt
          de storm langs de héle rechterflank door zonder extra asset. */}
      <Asset
        naam="storm-cloud-back-right"
        src={wolkAchter}
        className="inform-storm__wolk-achter-onder"
      />
      <Asset
        naam="storm-cloud-bottom-left"
        src={wolkLinks}
        className="inform-storm__wolk-links"
      />
    </span>
  );
}

/** Laag 3 — stormInsideLayer: ín het kaartvlak, gemaskeerd door de
 *  schildclip van .fut-kaart__vlak. Monteren vóór de kaartinhoud. */
export function InformStormBinnen() {
  return (
    <span className={laagKlasse("binnen")} data-laag="inside" aria-hidden="true">
      <Asset
        naam="storm-cloud-inside-right"
        src={wolkBinnen}
        className="inform-storm__wolk-binnen"
      />
      <Asset
        naam="lightning-back-right"
        src={bliksemAchterAsset}
        className="inform-storm__bliksem-binnen"
      />
      <Asset
        naam="storm-glow-right"
        src={gloed}
        className="inform-storm__gloed-binnen"
      />
    </span>
  );
}

/** Laag 4 — stormFrontLayer: óver het frame. */
export function InformStormVoor() {
  return (
    <span className={laagKlasse("voor")} data-laag="front" aria-hidden="true">
      <Asset
        naam="storm-glow-right"
        src={gloed}
        className="inform-storm__frame-gloed"
      />
      <Asset
        naam="storm-cloud-front-right"
        src={wolkVoor}
        className="inform-storm__wolk-voor"
      />
      {/* Tweede, gespiegelde instantie lager langs de rand: zes voorste
          puffen uit één asset, zonder herhaalpatroon. */}
      <Asset
        naam="storm-cloud-front-right"
        src={wolkVoor}
        className="inform-storm__wolk-voor-onder"
      />
      <Asset
        naam="lightning-front-right"
        src={bliksemVoorAsset}
        className="inform-storm__bliksem-voor"
      />
      <Asset
        naam="lightning-front-right"
        src={bliksemVoorAsset}
        className="inform-storm__bliksem-voor-onder"
      />
      <Asset
        naam="storm-debris"
        src={puin}
        className="inform-storm__puin"
      />
      <Asset
        naam="storm-sparks"
        src={vonken}
        className="inform-storm__vonken"
      />
    </span>
  );
}
