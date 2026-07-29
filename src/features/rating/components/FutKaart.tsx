// Gedeelde FUT-schildkaart (#495, gedeeld sinds #496): het kaartrecept van de
// Opstelling — vier geclipte lagen (frame → liner → keyline → vlak, #664) rond een schildclip waarvan de bovenrand
// oploopt met de divisiegroep, metaalvlak in de tierkleur en donkere
// special-toptiers — als herbruikbare component voor de Opstelling (Lineup)
// en het spelersprofiel (ProfileHero). Puur presentationeel: flip-state en
// knoppen (de .fut-kaart__flip-overlays) blijven bij de caller, zodat elke
// plek zijn eigen aria-labels en interacties houdt.

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { glansVertraging, premiumGlans } from "./premiumGlans";
import { tierTitle, type Tier } from "@/features/rating/tiers";
import {
  DICTATOR_EPAULET,
  DICTATOR_EPAULET_FRANJE,
  DICTATOR_GOUD_CONTOUR,
  DICTATOR_GOUD_GLANS,
  DICTATOR_GOUD_VERLOOP,
  DICTATOR_KROON,
  DICTATOR_KROON_BAND,
  DICTATOR_LAUWER_BLADEN,
  DICTATOR_LAUWER_STENGEL,
  DICTATOR_WATERMARK,
  DICTATOR_WATERMARK_BREEDTE,
  DICTATOR_WATERMARK_KLEUR,
  DICTATOR_WATERMARK_POSITIE,
  DICTATOR_ZEGEL,
  DICTATOR_PET_KLEP,
  DICTATOR_PET_KLEP_GLANS,
  DICTATOR_PET_STORM,
  DICTATOR_PET_COCARDE_STER,
  GOAT_BAARD_ARM,
  GOAT_BAARD_BLADEN,
  GOAT_BAARD_KRUL,
  GOAT_BAARD_NERVEN,
  GOAT_BAARD_SPEER,
  GOAT_HOORN,
  GOAT_ICOON,
  GOAT_ICOON_VIEWBOX,
  GOAT_METAAL_CONTOUR,
  GOAT_METAAL_GLANS,
  GOAT_METAAL_RIBBEL,
  GOAT_METAAL_RIBBELGLANS,
  GOAT_METAAL_SCHADUW,
  GOAT_METAAL_VERLOOP,
  GOAT_PLATINA_VERLOOP,
  GOAT_WATERMERK,
  GOAT_WATERMERK_BREEDTE,
  GOAT_WATERMERK_KLEUR,
  GOAT_WATERMERK_POSITIE,
  ORNAMENT_VIEWBOX,
  type OrnamentPad,
  type Streng,
  type StrengMateriaal,
} from "./futKaartOrnamenten";
import {
  BD_BALLONNEN,
  BD_BALLON_GLANS,
  BD_BALLON_TOUW,
  BD_CONFETTI,
  BD_CONTOUR,
  BD_KROON,
  BD_KROON_BAND,
  BD_KROON_BANDGLANS,
  BD_KROON_BOLLEN,
  BD_KROON_MOTIEF,
  BD_KROON_MOTIEF_KLEUR,
  BD_KROON_STEEN,
  BD_KROON_STEEN_FACETTEN,
  BD_LINT_BOOG,
  BD_LINT_MATERIAAL,
  BD_LINT_STAART,
  BD_METAAL_MATERIAAL,
  BD_PUNT_STEEN,
  BD_PUNT_STEEN_FACETTEN,
  BD_PUNT_VLEUGEL,
  BD_PUNT_ZETTING,
  BD_RIBBEL,
  BD_RIBBELGLANS,
  BD_STEEN_FACET,
  BD_STEEN_VERLOOP,
  cirkelPad,
} from "./ornamentenBigDaddy";
import { DIVISIE_KAARTEN, divisieKaart } from "./divisies";
import type { DivisieDeel } from "./divisies/divisieKaart";
import {
  KAMPIOEN_CREST_FACET,
  KAMPIOEN_CREST_GLANS,
  KAMPIOEN_CREST_KLAUW,
  KAMPIOEN_CREST_KRUIS,
  KAMPIOEN_CREST_RING,
  KAMPIOEN_CREST_RING_KLEUR,
  KAMPIOEN_CREST_STEEN,
  KAMPIOEN_CREST_ZETTING,
  KAMPIOEN_KRANS_BLAD,
  KAMPIOEN_KRANS_STAM,
  KAMPIOEN_LINT_AS,
  KAMPIOEN_LINT_AS_VERLOOP,
  KAMPIOEN_LINT_BUITEN,
  KAMPIOEN_LINT_CONTOUR,
  KAMPIOEN_LINT_EMBLEEM,
  KAMPIOEN_LINT_GROEN_VERLOOP,
  KAMPIOEN_LINT_LIJN,
  KAMPIOEN_LINT_PLATINA,
  KAMPIOEN_LINT_PLATINA_VERLOOP,
  KAMPIOEN_LOOF_AS,
  KAMPIOEN_LOOF_CONTOUR,
  KAMPIOEN_LOOF_GLANS,
  KAMPIOEN_LOOF_NERF,
  KAMPIOEN_LOOF_SCHADUW,
  KAMPIOEN_LOOF_VERLOOP,
  KAMPIOEN_STEEN_CONTOUR,
  KAMPIOEN_STEEN_FACET,
  KAMPIOEN_STEEN_FACETTEN,
  KAMPIOEN_STEEN_GLANS,
  KAMPIOEN_STEEN_KLAUW,
  KAMPIOEN_ZEGEL,
  KAMPIOEN_ZEGEL_KLEUR,
  KAMPIOEN_ZETTING_CONTOUR,
  KAMPIOEN_ZETTING_VERLOOP,
  KAMPIOEN_ZETTING_AS,
  type Lint,
} from "./ornamentenKampioen";
import {
  belPaden,
  PIAS_GOUD_CONTOUR,
  PIAS_GOUD_GLANS,
  PIAS_GOUD_GRAVURE,
  PIAS_GOUD_SCHADUW,
  PIAS_GOUD_VERLOOP,
  PIAS_KAP_BAND,
  PIAS_KAP_BELLEN,
  PIAS_KAP_MIDDENLOB,
  PIAS_KAP_NERVEN,
  PIAS_KAP_ZIJLOB,
  PIAS_KAP_ZOOM,
  PIAS_LINT,
  PIAS_LINT_BEL,
  PIAS_LINT_HALS,
  PIAS_MED_BARST,
  PIAS_MED_HAARLIJN,
  PIAS_MED_MASKER,
  PIAS_MED_RING,
  PIAS_MED_TRAAN,
  PIAS_MED_TREKKEN,
  PIAS_MED_VLAK,
  PIAS_MED_VOLUTE,
  PIAS_MOTIEF,
  PIAS_MOTIEF_INK,
  PIAS_MOTIEF_VIEWBOX,
  PIAS_STOF_BIES,
  PIAS_STOF_GLANS,
  PIAS_STOF_SCHADUW,
  PIAS_STOF_VERLOOP,
  type PiasBel,
} from "./ornamentenPias";
import {
  PIET_BREUK,
  PIET_BREUK_GLANS,
  PIET_CREST_GRAVURE,
  PIET_CREST_PION,
  PIET_CREST_PUNT,
  PIET_CREST_RING,
  PIET_CREST_SCHIJF,
  PIET_CREST_VLEUGEL,
  PIET_GRAVURE,
  PIET_KETTING,
  PIET_KETTING_DRAAD,
  PIET_LAK,
  PIET_LAK_RAND,
  PIET_LAUWER,
  PIET_LAUWER_RUIT,
  PIET_LOOF,
  PIET_LOOF_NERF,
  PIET_RAND_CARTOUCHES,
  PIET_RAND_RUIT,
  PIET_RAND_TEKENS,
  PIET_ROOD,
  PIET_ROOD_RAND,
  PIET_SLUITING,
  PIET_STAAL_CONTOUR,
  PIET_STAAL_GLANS,
  PIET_STAAL_RIBBEL,
  PIET_STAAL_VERLOOP,
  PIET_WATERMERK,
  PIET_WATERMERK_BREEDTE,
  PIET_WATERMERK_KLEUR,
  PIET_WATERMERK_POSITIE,
  PIET_ZEGEL_BREUK,
  PIET_ZEGEL_DRAAD,
  PIET_ZEGEL_GRAVURE,
  PIET_ZEGEL_HELFT_LINKS,
  PIET_ZEGEL_HELFT_RECHTS,
  PIET_ZEGEL_SCHIJF,
  PIET_ZEGEL_STUKKEN,
} from "./ornamentenPiet";
import {
  INFORM_CREST,
  INFORM_GOUD_CONTOUR,
  INFORM_GOUD_GLANS,
  INFORM_GOUD_GROEF,
  INFORM_GOUD_SCHADUW,
  INFORM_GOUD_VERLOOP,
  INFORM_MEDAILLON,
  INFORM_MOTIEF,
  INFORM_MOTIEF_BREEDTE,
  INFORM_MOTIEF_KLEUR,
  INFORM_MOTIEF_POSITIE,
  INFORM_TITAAN,
  INFORM_VINNEN,
} from "./ornamentenInform";
import {
  InformStormAchter,
  InformStormBinnen,
  InformStormVoor,
} from "./storm/InformStorm";
import {
  OnfireEffectAchter,
  OnfireEffectBinnen,
  OnfireEffectVoor,
} from "./onfire/OnfireEffect";
import {
  ONFIRE_CREST_BAND,
  ONFIRE_CREST_NERVEN,
  ONFIRE_CREST_PLAAT,
  ONFIRE_CREST_VLAM,
  ONFIRE_GLOED_VERLOOP,
  ONFIRE_KOPER,
  ONFIRE_MEDAILLON,
  ONFIRE_MEDAILLON_DIEP,
  ONFIRE_MEDAILLON_NERVEN,
  ONFIRE_MEDAILLON_VLAM,
  ONFIRE_SINTELS,
  ONFIRE_SINTEL_GLOED,
  ONFIRE_SINTEL_KERN,
  ONFIRE_STAAL_VERLOOP,
  ONFIRE_VINNEN,
  ONFIRE_WATERMARK,
  ONFIRE_WATERMARK_BREEDTE,
  ONFIRE_WATERMARK_KLEUR,
  ONFIRE_WATERMARK_POSITIE,
} from "./ornamentenOnfire";
import "./FutKaart.css";
// Ná FutKaart.css: de negen divisieregisters (#710) winnen van de generieke
// metaalladder daar.
import "./divisies/index.css";

/** Materiaal van de GOAT-strengen. Sinds #710 (Big Daddy) kan een ornament
 *  zijn eigen metaal meebrengen, dus wat eerst losse constanten waren staat
 *  hier als één materiaal — de canvas-spiegel doet exact hetzelfde. */
const GOAT_MATERIAAL: StrengMateriaal = {
  vulling: "url(#fut-orn-metaal)",
  verloop: GOAT_METAAL_VERLOOP,
  contour: GOAT_METAAL_CONTOUR,
  glans: GOAT_METAAL_GLANS,
  ribbel: GOAT_METAAL_RIBBEL,
  ribbelGlans: GOAT_METAAL_RIBBELGLANS,
  schaduw: GOAT_METAAL_SCHADUW,
  // Platina op de bovenste ribben (#772). Alleen de hoorn tekent hem: het
  // baardfiligraan is te fijn voor een tweede metaal en zou er vlekkerig van
  // worden, dus dat draait op `GOAT_FILIGRAAN` hieronder.
  rugGlans: "url(#fut-orn-platina)",
};

/** Zelfde rosé metaal, zonder de platina rugband: voor het baardfiligraan,
 *  waar de strengen maar 2–4 units breed zijn (#772). */
const GOAT_FILIGRAAN: StrengMateriaal = { ...GOAT_MATERIAAL, rugGlans: undefined };

/** Schildvormen: vier clipPaths met exact dezelfde onderkant (de punt op
 *  50%/100% blijft het chemielijn-anker in de Opstelling) en een bovenrand
 *  die oploopt met de divisiegroep — vlak, kroon-notch, spitse vleugels,
 *  kroon-crest. FutKaart.css kiest per tier via de --schild-variabele.
 *  objectBoundingBox laat de paden meeschalen met elke kaartbreedte.
 *  Eén keer renderen per pagina; dubbel renderen is onschadelijk (identieke
 *  defs), maar onnodig. */
/** De ornamentlagen die #710 kent. "goat" heeft er alleen één áchter de kaart;
 *  de rest heeft ook een vóór-laag (zie `ornamentVoor` hieronder). */
type OrnamentNaam =
  | "goat"
  | "dictator"
  | "bigdaddy"
  | "kampioen"
  | "pias"
  | "piet"
  | "inform"
  | "onfire";

/** Het id uit een `url(#id)`-paint — de gradient-definitie draagt het kale id,
 *  de vorm verwijst er met de volledige paint naar. Zo staat de bron van beide
 *  op één plek in het materiaal. */
function gradientId(vulling: string): string {
  return /^url\(#([^)]+)\)$/.exec(vulling)?.[1] ?? vulling;
}

/** Smaragden loof voor de lauwerkrans van de Kampioen — zelfde generator
 *  als het rosé metaal van de GOAT, ander materiaal. */
const KAMPIOEN_LOOF_MATERIAAL: StrengMateriaal = {
  vulling: "url(#fut-orn-kampioen-loof)",
  verloop: KAMPIOEN_LOOF_VERLOOP,
  as: [KAMPIOEN_LOOF_AS[1], KAMPIOEN_LOOF_AS[3]],
  contour: KAMPIOEN_LOOF_CONTOUR,
  glans: KAMPIOEN_LOOF_GLANS,
  schaduw: KAMPIOEN_LOOF_SCHADUW,
  ribbel: KAMPIOEN_LOOF_NERF,
  ribbelGlans: KAMPIOEN_LOOF_GLANS,
};

/** Stof met gouden bies (#710, pias): de contour is hier geen donkere lijn maar
 *  de piping zelf, dus dikker en licht. */
const PIAS_STOF_MATERIAAL: StrengMateriaal = {
  vulling: "url(#fut-orn-pias-stof)",
  verloop: PIAS_STOF_VERLOOP,
  contour: PIAS_STOF_BIES,
  contourBreedte: 1.1,
  glans: PIAS_STOF_GLANS,
  schaduw: PIAS_STOF_SCHADUW,
  ribbel: PIAS_STOF_SCHADUW,
  ribbelGlans: PIAS_STOF_GLANS,
};

/** Eén getaperde streng (#710): gevulde omtrek met contour, dwarsribbels en
 *  glanslijn. De vorm komt uit `bouwStreng` in futKaartOrnamenten.ts, dus DOM
 *  en canvas tekenen letterlijk dezelfde paden. */
/** Champagnegoud voor de vinnen van In-Form — zelfde generator als het rosé
 *  metaal van de GOAT, ander materiaal. */
const INFORM_MATERIAAL: StrengMateriaal = {
  vulling: "url(#fut-orn-inform-goud)",
  verloop: INFORM_GOUD_VERLOOP,
  contour: INFORM_GOUD_CONTOUR,
  ribbel: INFORM_GOUD_GROEF,
  ribbelGlans: INFORM_GOUD_GLANS,
  schaduw: INFORM_GOUD_SCHADUW,
  glans: INFORM_GOUD_GLANS,
};
/** Verhit koper voor de vinnen van On Fire — zelfde generator als het rosé
 *  metaal van de GOAT, ander materiaal. */
const ONFIRE_MATERIAAL: StrengMateriaal = {
  vulling: "url(#fut-orn-koper)",
  verloop: ONFIRE_KOPER.verloop,
  contour: ONFIRE_KOPER.contour,
  glans: ONFIRE_KOPER.glans,
  ribbel: ONFIRE_KOPER.ribbel,
  ribbelGlans: ONFIRE_KOPER.ribbelGlans,
  schaduw: ONFIRE_KOPER.schaduw,
};
function FutStreng({
  streng,
  materiaal = GOAT_MATERIAAL,
  ribbelBreedte = 0.4,
}: {
  streng: Streng;
  materiaal?: StrengMateriaal;
  ribbelBreedte?: number;
}) {
  return (
    <>
      <path
        d={streng.omtrek}
        fill={materiaal.vulling}
        stroke={materiaal.contour}
        strokeWidth="0.7"
        strokeLinejoin="round"
      />
      {/* Rugband (#772): het tweede metaal over de bolle flank, vóór de groeven
          zodat het ribbelreliëf er doorheen blijft lopen — platina óp de ribben,
          niet eroverheen. */}
      {materiaal.rugGlans && (
        <path d={streng.rug} fill={materiaal.rugGlans} stroke="none" />
      )}
      {streng.ribbelGlans.map((d) => (
        <path
          key={d}
          d={d}
          fill="none"
          stroke={materiaal.ribbelGlans}
          strokeWidth={ribbelBreedte}
          strokeLinecap="round"
        />
      ))}
      {streng.ribbels.map((d) => (
        <path
          key={d}
          d={d}
          fill="none"
          stroke={materiaal.ribbel}
          strokeWidth={ribbelBreedte}
          strokeLinecap="round"
        />
      ))}
      <path
        d={streng.schaduw}
        fill="none"
        stroke={materiaal.schaduw}
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path
        d={streng.highlight}
        fill="none"
        stroke={materiaal.glans}
        strokeWidth="0.9"
        strokeLinecap="round"
      />
    </>
  );
}

/** Eén koperen ornamentvlak van de On Fire-editie: verloop-vulling met een
 *  donkere contour — dezelfde opbouw als `FutGoud`, andere legering. */
function FutKoper({ d, contour = ONFIRE_KOPER.contour }: { d: string; contour?: string }) {
  return (
    <path
      d={d}
      fill="url(#fut-orn-koper)"
      stroke={contour}
      strokeWidth="0.5"
      strokeLinejoin="round"
    />
  );
}

/** Eén gouden ornamentvlak (#710): vulling met verloop, donkere contour en
 *  een lichte binnenrand — het reliëf van de referentie zonder extra lagen.
 *  Standaard het antiekgoud van El Padelissimo; In-Form geeft champagne mee. */
function FutGoud({
  d,
  vulling = "url(#fut-orn-goud)",
  contour = DICTATOR_GOUD_CONTOUR,
  glans = DICTATOR_GOUD_GLANS,
}: {
  d: string;
  vulling?: string;
  contour?: string;
  glans?: string;
}) {
  return (
    <>
      <path
        d={d}
        fill={vulling}
        stroke={contour}
        strokeWidth="0.6"
        strokeLinejoin="round"
      />
      <path
        d={d}
        fill="none"
        stroke={glans}
        strokeWidth="0.35"
        strokeLinejoin="round"
        opacity="0.7"
      />
    </>
  );
}

/** Ketting met geopende sluiting (#710) — de linkerhelft van de Piet-laag
 *  áchter de kaart. Elke schakel krijgt drie strokes op twee paden (contour,
 *  staal, binnenglans): daarmee leest hij rond zonder extra geometrie. De
 *  schakels worden per stuk afgemaakt, zodat de volgende er correct
 *  overheen grijpt — dát is wat een reeks ovalen tot een ketting maakt. */
function PietKetting() {
  return (
    <>
      {PIET_KETTING.map((s) => (
        <g key={s.ring}>
          <path
            d={s.ring}
            fill="none"
            stroke={PIET_STAAL_CONTOUR}
            strokeWidth={PIET_KETTING_DRAAD + 0.8}
          />
          <path
            d={s.ring}
            fill="none"
            stroke="url(#fut-orn-staal)"
            strokeWidth={PIET_KETTING_DRAAD}
          />
          <path
            d={s.binnen}
            fill="none"
            stroke={PIET_STAAL_GLANS}
            strokeWidth="0.4"
          />
        </g>
      ))}
      <path
        d={PIET_SLUITING.balk}
        fill="none"
        stroke={PIET_STAAL_CONTOUR}
        strokeWidth={PIET_SLUITING.draad + 0.7}
        strokeLinecap="round"
      />
      <path
        d={PIET_SLUITING.balk}
        fill="none"
        stroke="url(#fut-orn-staal)"
        strokeWidth={PIET_SLUITING.draad - 0.3}
        strokeLinecap="round"
      />
      <path
        d={PIET_SLUITING.beugel}
        fill="none"
        stroke={PIET_STAAL_CONTOUR}
        strokeWidth={PIET_SLUITING.draad + 0.8}
      />
      <path
        d={PIET_SLUITING.beugel}
        fill="none"
        stroke="url(#fut-orn-staal)"
        strokeWidth={PIET_SLUITING.draad}
      />
    </>
  );
}

/** Edelsteen (#710): omtrek in de steen-gradient met lichte facetlijnen — de
 *  kroon bovenaan en het ornament in de punt dragen dezelfde steen, zodat de
 *  twee bij elkaar horen. */
function FutSteen({
  omtrek,
  facetten,
}: {
  omtrek: string;
  facetten: readonly string[];
}) {
  return (
    <>
      <path
        d={omtrek}
        fill="url(#fut-orn-bd-steen)"
        stroke={BD_CONTOUR}
        strokeWidth="0.35"
        strokeLinejoin="round"
      />
      {facetten.map((d) => (
        <path
          key={d}
          d={d}
          fill="none"
          stroke={BD_STEEN_FACET}
          strokeWidth="0.3"
          strokeLinecap="round"
        />
      ))}
    </>
  );
}

/** Gravure op het lakframe (#710): de vleugel langs de bovenrand en de
 *  lauwerblaadjes langs de onderrand. Vlakke geoxideerde zilvertint i.p.v. het
 *  staalverloop — op bijna-zwart lak moet een gravure lichter zijn dan zijn
 *  ondergrond, anders verdwijnt hij. */
function PietGravure() {
  return (
    <>
      <path
        d={PIET_CREST_VLEUGEL.omtrek}
        fill={PIET_LOOF}
        stroke={PIET_STAAL_CONTOUR}
        strokeWidth="0.25"
        strokeLinejoin="round"
      />
      {PIET_CREST_VLEUGEL.ribbels.map((d) => (
        <path
          key={d}
          d={d}
          fill="none"
          stroke={PIET_STAAL_RIBBEL}
          strokeWidth="0.3"
          strokeLinecap="round"
        />
      ))}
    </>
  );
}

/** Verloop van een ornamentmateriaal, in kaart-units (userSpaceOnUse). Zo
 *  kantelt het licht mee met de `<use transform>` van de gespiegelde helft —
 *  precies wat de canvas-spiegel met `ctx.scale(-1, 1)` doet. */
function FutOrnamentVerloop({
  id,
  as,
  stops,
}: {
  id: string;
  as: readonly [number, number, number, number];
  stops: readonly (readonly [number, string])[];
}) {
  return (
    <linearGradient
      id={id}
      gradientUnits="userSpaceOnUse"
      x1={as[0]}
      y1={as[1]}
      x2={as[2]}
      y2={as[3]}
    >
      {stops.map(([offset, kleur]) => (
        <stop key={offset} offset={offset} stopColor={kleur} />
      ))}
    </linearGradient>
  );
}

/** Eén medaillelint: de band in zijn eigen materiaal, met de vouwlijnen erin. */
function FutLint({ lint, vulling }: { lint: Lint; vulling: string }) {
  return (
    <>
      <path
        d={lint.d}
        fill={vulling}
        stroke={KAMPIOEN_LINT_CONTOUR}
        strokeWidth="0.5"
        strokeLinejoin="round"
      />
      {lint.lijnen.map((d) => (
        <path
          key={d}
          d={d}
          fill="none"
          stroke={KAMPIOEN_LINT_LIJN}
          strokeWidth="0.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </>
  );
}

/** De rest van de lakframe-gravure (#710, Piet): de highlight langs de vleugel
 *  en de lauwerblaadjes langs de onderrand. */
function PietGravureLauwer() {
  return (
    <>
      <path
        d={PIET_CREST_VLEUGEL.highlight}
        fill="none"
        stroke={PIET_LOOF_NERF}
        strokeWidth="0.35"
        strokeLinecap="round"
      />
      {PIET_LAUWER.map((b) => (
        <g key={b.blad}>
          <path
            d={b.blad}
            fill={PIET_LOOF}
            stroke={PIET_STAAL_CONTOUR}
            strokeWidth="0.18"
          />
          <path
            d={b.nerf}
            fill="none"
            stroke={PIET_LOOF_NERF}
            strokeWidth="0.22"
          />
        </g>
      ))}
      {PIET_RAND_CARTOUCHES.map((d) => (
        <path
          key={d}
          d={d}
          fill={PIET_LAK}
          stroke={PIET_LAK_RAND}
          strokeWidth="0.5"
        />
      ))}
      {PIET_RAND_TEKENS.map((d) => (
        <path key={d} d={d} fill={PIET_GRAVURE} />
      ))}
      {[PIET_RAND_RUIT, PIET_LAUWER_RUIT].map((d) => (
        <path
          key={d}
          d={d}
          fill={PIET_ROOD}
          stroke={PIET_ROOD_RAND}
          strokeWidth="0.3"
        />
      ))}
    </>
  );
}

/** Eén ornamentdeel van een divisiekaart (#710): vulling en/of contour, en
 *  optioneel gespiegeld om x=50. De canvas-tegenhanger is `drawDivisieDeel`
 *  in futKaartCanvas.ts — beide lezen letterlijk hetzelfde pad. */
function FutDivisieDeel({ deel }: { deel: DivisieDeel }) {
  const vorm = (
    <path
      d={deel.d}
      fill={deel.vulling ?? "none"}
      stroke={deel.contour}
      strokeWidth={deel.contourBreedte ?? 0.5}
      strokeLinejoin="round"
      strokeLinecap="round"
      opacity={deel.alpha}
    />
  );
  if (!deel.spiegel) return vorm;
  return (
    <>
      {vorm}
      <g transform="translate(100,0) scale(-1,1)">{vorm}</g>
    </>
  );
}

/** De defs van álle uitgewerkte divisiekaarten: hun gradients en de twee
 *  ornamentgroepen. Eén keer per pagina gerenderd, net als de schildvormen;
 *  een divisie zonder ornamenten levert niets op. */
function FutDivisieDefs() {
  return (
    <>
      {DIVISIE_KAARTEN.flatMap((d) =>
        (d.gradienten ?? []).map((g) => (
          <linearGradient
            key={g.id}
            id={g.id}
            gradientUnits="userSpaceOnUse"
            x1={g.as[0]}
            y1={g.as[1]}
            x2={g.as[2]}
            y2={g.as[3]}
          >
            {g.stops.map(([offset, kleur]) => (
              <stop key={offset} offset={offset} stopColor={kleur} />
            ))}
          </linearGradient>
        )),
      )}
      {DIVISIE_KAARTEN.map((d) => (
        <g key={d.key}>
          {(d.achter?.length ?? 0) > 0 && (
            <g id={`fut-div-${d.key}-achter`}>
              {d.achter!.map((deel) => (
                <FutDivisieDeel key={deel.d} deel={deel} />
              ))}
            </g>
          )}
          {(d.voor?.length ?? 0) > 0 && (
            <g id={`fut-div-${d.key}-voor`}>
              {d.voor!.map((deel) => (
                <FutDivisieDeel key={deel.d} deel={deel} />
              ))}
            </g>
          )}
        </g>
      ))}
    </>
  );
}

/** Eén narrenbelletje (#710, pias): bol, naad, klepelgat en glans. De vier
 *  paden komen uit `belPaden`, dus DOM en canvas tekenen dezelfde bel. */
function PiasBelletje({ bel }: { bel: PiasBel }) {
  const p = belPaden(bel);
  return (
    <>
      <path
        d={p.bol}
        fill="url(#fut-orn-pias-goud)"
        stroke={PIAS_GOUD_CONTOUR}
        strokeWidth="0.5"
      />
      <path
        d={p.naad}
        fill="none"
        stroke={PIAS_GOUD_GRAVURE}
        strokeWidth="0.4"
        strokeLinecap="round"
      />
      <path d={p.gat} fill={PIAS_GOUD_CONTOUR} />
      <path
        d={p.glans}
        fill="none"
        stroke={PIAS_GOUD_GLANS}
        strokeWidth="0.5"
        strokeLinecap="round"
      />
    </>
  );
}

/** Het gebroken zegel in de onderpunt (#710): twee ringhelften die langs de
 *  breuk verspringen. Niet één gebarsten ring maar twee stukken die niet meer
 *  passen — dát is het verschil tussen beschadigd en verbroken. */
function PietZegel() {
  const helften = [PIET_ZEGEL_HELFT_LINKS, PIET_ZEGEL_HELFT_RECHTS];
  return (
    <>
      {helften.map((d) => (
        <path
          key={d}
          d={d}
          fill="none"
          stroke={PIET_STAAL_CONTOUR}
          strokeWidth={PIET_ZEGEL_DRAAD + 0.7}
        />
      ))}
      <path
        d={PIET_ZEGEL_SCHIJF}
        fill={PIET_LAK}
        stroke={PIET_LAK_RAND}
        strokeWidth="0.4"
      />
      {helften.map((d) => (
        <path
          key={`s${d}`}
          d={d}
          fill="none"
          stroke="url(#fut-orn-staal)"
          strokeWidth={PIET_ZEGEL_DRAAD}
        />
      ))}
      {PIET_ZEGEL_GRAVURE.map((d) => (
        <path
          key={d}
          d={d}
          fill="none"
          stroke={PIET_GRAVURE}
          strokeWidth="0.35"
        />
      ))}
      {PIET_ZEGEL_STUKKEN.map((d) => (
        <path key={d} d={d} fill={PIET_GRAVURE} />
      ))}
      <path
        d={PIET_ZEGEL_BREUK}
        fill="none"
        stroke={PIET_BREUK_GLANS}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d={PIET_ZEGEL_BREUK}
        fill="none"
        stroke={PIET_BREUK}
        strokeWidth="0.9"
        strokeLinejoin="round"
      />
    </>
  );
}

export function FutKaartDefs() {
  return (
    <svg width="0" height="0" className="fut-kaart__defs" aria-hidden="true">
      <defs>
        <clipPath id="fut-schild-vlak" clipPathUnits="objectBoundingBox">
          <path d="M 0.04 0 L 0.96 0 L 1 0.055 L 1 0.60 C 1 0.74 0.955 0.795 0.865 0.838 L 0.565 0.972 C 0.545 0.982 0.523 1 0.5 1 C 0.477 1 0.455 0.982 0.435 0.972 L 0.135 0.838 C 0.045 0.795 0 0.74 0 0.60 L 0 0.055 Z" />
        </clipPath>
        <clipPath id="fut-schild-notch" clipPathUnits="objectBoundingBox">
          <path d="M 0.085 0 L 0.40 0 C 0.44 0 0.46 0.022 0.5 0.022 C 0.54 0.022 0.56 0 0.60 0 L 0.915 0 C 0.962 0 1 0.028 1 0.062 L 1 0.60 C 1 0.74 0.955 0.795 0.865 0.838 L 0.565 0.972 C 0.545 0.982 0.523 1 0.5 1 C 0.477 1 0.455 0.982 0.435 0.972 L 0.135 0.838 C 0.045 0.795 0 0.74 0 0.60 L 0 0.062 C 0 0.028 0.038 0 0.085 0 Z" />
        </clipPath>
        <clipPath id="fut-schild-punt" clipPathUnits="objectBoundingBox">
          <path d="M 0.035 0.01 L 0.44 0.04 C 0.47 0.042 0.48 0.058 0.5 0.058 C 0.52 0.058 0.53 0.042 0.56 0.04 L 0.965 0.01 L 1 0.075 L 1 0.60 C 1 0.74 0.955 0.795 0.865 0.838 L 0.565 0.972 C 0.545 0.982 0.523 1 0.5 1 C 0.477 1 0.455 0.982 0.435 0.972 L 0.135 0.838 C 0.045 0.795 0 0.74 0 0.60 L 0 0.075 Z" />
        </clipPath>
        <clipPath id="fut-schild-kroon" clipPathUnits="objectBoundingBox">
          <path d="M 0.085 0.035 L 0.38 0.035 C 0.43 0.035 0.44 0 0.5 0 C 0.56 0 0.57 0.035 0.62 0.035 L 0.915 0.035 C 0.962 0.035 1 0.062 1 0.095 L 1 0.60 C 1 0.74 0.955 0.795 0.865 0.838 L 0.565 0.972 C 0.545 0.982 0.523 1 0.5 1 C 0.477 1 0.455 0.982 0.435 0.972 L 0.135 0.838 C 0.045 0.795 0 0.74 0 0.60 L 0 0.095 C 0 0.062 0.038 0.035 0.085 0.035 Z" />
        </clipPath>
        {/* GOAT (#834): een vloeiende drievoudige crest i.p.v. de oude ene
            ronde bobbel. Twee zijpunten leiden via zachte dalen naar de hogere
            middenpunt; de brede schouders lopen onder de hoornwortels door. */}
        <clipPath id="fut-schild-goat" clipPathUnits="objectBoundingBox">
          <path d="M 0.075 0.045 C 0.16 0.014 0.26 0.018 0.35 0.022 C 0.38 0.022 0.395 0.006 0.42 0.006 C 0.445 0.01 0.46 0.032 0.475 0.032 C 0.486 0.018 0.494 0 0.5 0 C 0.506 0 0.514 0.018 0.525 0.032 C 0.54 0.032 0.555 0.01 0.58 0.006 C 0.605 0.006 0.62 0.022 0.65 0.022 C 0.74 0.018 0.84 0.014 0.925 0.045 C 0.972 0.061 1 0.078 1 0.108 L 1 0.60 C 1 0.74 0.955 0.795 0.865 0.838 L 0.565 0.972 C 0.545 0.982 0.523 1 0.5 1 C 0.477 1 0.455 0.982 0.435 0.972 L 0.135 0.838 C 0.045 0.795 0 0.74 0 0.60 L 0 0.108 C 0 0.078 0.028 0.061 0.075 0.045 Z" />
        </clipPath>
        {/* Troon-crest (#710): de ceremoniële schildvorm van El Padelissimo —
            gekantelde bovenhoeken en een V-inkeping in het midden waar de
            kroon in valt. De onderkant is identiek aan de andere vormen (de
            punt op 50%/100% blijft het chemielijn-anker in de Opstelling). */}
        <clipPath id="fut-schild-troon" clipPathUnits="objectBoundingBox">
          <path d="M 0.16 0.012 L 0.40 0.012 L 0.5 0.058 L 0.60 0.012 L 0.84 0.012 L 1 0.085 L 1 0.60 C 1 0.74 0.955 0.795 0.865 0.838 L 0.565 0.972 C 0.545 0.982 0.523 1 0.5 1 C 0.477 1 0.455 0.982 0.435 0.972 L 0.135 0.838 C 0.045 0.795 0 0.74 0 0.60 L 0 0.085 Z" />
        </clipPath>
        {/* Ornamenten (#710): de laag die búiten het schild uitsteekt. Eén
            linkerhelft; de tweede <use> spiegelt om x=50 — links en rechts
            zijn per constructie gelijk, zoals de canvas-spiegel dat met
            scale(-1,1) doet. Kaarten verwijzen met <use> naar deze groep,
            dus de paden staan één keer per pagina. */}
        {/* Alleen de materialen zonder eigen <linearGradient> hieronder: de
            Kampioen, de pias, In-Form en On Fire definiëren hun verloop zelf
            in hun eigen defs-blok. Twee defs met hetzelfde id zou de tweede
            stilletjes laten winnen. */}
        {[GOAT_MATERIAAL, BD_METAAL_MATERIAAL, BD_LINT_MATERIAAL].map((m) =>
          // Een materiaal met vaste as (het lint) krijgt zijn gradient in
          // ornament-units: twee lintbogen samen vormen één voorwerp, dus de
          // as mag niet per streng meeschalen. De rest volgt de omhullende
          // van de vorm zelf.
          m.as ? (
            <linearGradient
              key={m.vulling}
              id={gradientId(m.vulling)}
              gradientUnits="userSpaceOnUse"
              x1="0"
              y1={m.as[0]}
              x2="0"
              y2={m.as[1]}
            >
              {m.verloop.map(([offset, kleur]) => (
                <stop key={offset} offset={offset} stopColor={kleur} />
              ))}
            </linearGradient>
          ) : (
            <linearGradient
              key={m.vulling}
              id={gradientId(m.vulling)}
              x1="0"
              y1="0"
              x2="0.35"
              y2="1"
              gradientUnits="objectBoundingBox"
            >
              {m.verloop.map(([offset, kleur]) => (
                <stop key={offset} offset={offset} stopColor={kleur} />
              ))}
            </linearGradient>
          ),
        )}
        <linearGradient
          id="fut-orn-bd-steen"
          x1="0.2"
          y1="0"
          x2="0.8"
          y2="1"
          gradientUnits="objectBoundingBox"
        >
          {BD_STEEN_VERLOOP.map(([offset, kleur]) => (
            <stop key={offset} offset={offset} stopColor={kleur} />
          ))}
        </linearGradient>
        {BD_BALLONNEN.map((b) => (
          <linearGradient
            key={b.id}
            id={`fut-orn-bd-ballon-${b.id}`}
            x1="0.15"
            y1="0.05"
            x2="0.85"
            y2="1"
            gradientUnits="objectBoundingBox"
          >
            {b.verloop.map(([offset, kleur]) => (
              <stop key={offset} offset={offset} stopColor={kleur} />
            ))}
          </linearGradient>
        ))}
        {/* Platina voor de rugband van de bokhoorn (#772): koel wit dat naar
            doorzichtig grijs uitloopt, dwars op de streng (x1→x2) zodat de
            highlight aan de buitenrand het felst is. */}
        <linearGradient
          id="fut-orn-platina"
          x1="0"
          y1="0"
          x2="0.85"
          y2="0.6"
          gradientUnits="objectBoundingBox"
        >
          {GOAT_PLATINA_VERLOOP.map(([offset, kleur]) => (
            <stop key={offset} offset={offset} stopColor={kleur} />
          ))}
        </linearGradient>
        <g id="fut-orn-goat-helft">
          <FutStreng streng={GOAT_HOORN} ribbelBreedte={0.62} />
        </g>
        {/* Baardfiligraan (#772), één helft: de bovenarm met zijn haarwaaier en
            de kleinere onderkrul. De speerpunt staat op de as en hoort dus in
            de groep hieronder, niet in deze helft. */}
        <g id="fut-orn-goat-baard-helft">
          {GOAT_BAARD_BLADEN.map((d) => (
            <path
              key={d}
              d={d}
              fill="url(#fut-orn-metaal)"
              stroke={GOAT_METAAL_CONTOUR}
              strokeWidth="0.35"
              strokeLinejoin="round"
            />
          ))}
          <FutStreng streng={GOAT_BAARD_ARM} materiaal={GOAT_FILIGRAAN} />
          <FutStreng streng={GOAT_BAARD_KRUL} materiaal={GOAT_FILIGRAAN} />
        </g>
        <linearGradient
          id="fut-orn-goud"
          x1="0"
          y1="0"
          x2="0.3"
          y2="1"
          gradientUnits="objectBoundingBox"
        >
          {DICTATOR_GOUD_VERLOOP.map(([offset, kleur]) => (
            <stop key={offset} offset={offset} stopColor={kleur} />
          ))}
        </linearGradient>
        {/* El Padelissimo (#710) — áchter de kaart: kroon en epauletten. De
            kroon staat op de as en wordt niet gespiegeld; de epaulet wel. */}
        <g id="fut-orn-dictator-achter-helft">
          <FutGoud d={DICTATOR_EPAULET} />
          {DICTATOR_EPAULET_FRANJE.map((d) => (
            <path
              key={d}
              d={d}
              fill="none"
              stroke="url(#fut-orn-goud)"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          ))}
        </g>
        <g id="fut-orn-dictator-achter">
          <use href="#fut-orn-dictator-achter-helft" />
          <use
            href="#fut-orn-dictator-achter-helft"
            transform="translate(100,0) scale(-1,1)"
          />
        </g>
        {/* En vóór de kaart: lauwerkransen langs de onderste zijkanten en het
            lakzegel in de punt (laagvolgorde uit de referentie-instructies).
            Beide liggen in de marge, dus ze dekken geen tekst af. */}
        <g id="fut-orn-dictator-voor-helft">
          <path
            d={DICTATOR_LAUWER_STENGEL.omtrek}
            fill="url(#fut-orn-goud)"
            stroke={DICTATOR_GOUD_CONTOUR}
            strokeWidth="0.5"
            strokeLinejoin="round"
          />
          {DICTATOR_LAUWER_BLADEN.map((d) => (
            <path
              key={d}
              d={d}
              fill="url(#fut-orn-goud)"
              stroke={DICTATOR_GOUD_CONTOUR}
              strokeWidth="0.4"
              strokeLinejoin="round"
            />
          ))}
        </g>
        <g id="fut-orn-dictator-voor">
          <use href="#fut-orn-dictator-voor-helft" />
          <use
            href="#fut-orn-dictator-voor-helft"
            transform="translate(100,0) scale(-1,1)"
          />
          <circle
            cx={DICTATOR_ZEGEL.midden[0]}
            cy={DICTATOR_ZEGEL.midden[1]}
            r={DICTATOR_ZEGEL.ring}
            fill="url(#fut-orn-goud)"
            stroke={DICTATOR_GOUD_CONTOUR}
            strokeWidth="0.6"
          />
          <circle
            cx={DICTATOR_ZEGEL.midden[0]}
            cy={DICTATOR_ZEGEL.midden[1]}
            r={DICTATOR_ZEGEL.vlak}
            fill="#7d1a33"
            stroke={DICTATOR_GOUD_CONTOUR}
            strokeWidth="0.4"
          />
          <path
            d={DICTATOR_ZEGEL.ster}
            fill="url(#fut-orn-goud)"
            stroke={DICTATOR_GOUD_CONTOUR}
            strokeWidth="0.35"
            strokeLinejoin="round"
          />
          {DICTATOR_ZEGEL.bollen.map(([cx, cy, r]) => (
            <circle
              key={`${cx}-${cy}`}
              cx={cx}
              cy={cy}
              r={r}
              fill="url(#fut-orn-goud)"
              stroke={DICTATOR_GOUD_CONTOUR}
              strokeWidth="0.4"
            />
          ))}
          {/* Peaked cap body */}
          <path
            d={DICTATOR_KROON}
            fill="#1d1e20"
            stroke={DICTATOR_GOUD_CONTOUR}
            strokeWidth="0.6"
            strokeLinejoin="round"
          />
          {/* Cap band (red) */}
          <path
            d={DICTATOR_KROON_BAND}
            fill="#9c1a2e"
            stroke={DICTATOR_GOUD_CONTOUR}
            strokeWidth="0.5"
            strokeLinejoin="round"
          />
          {/* Cap visor (black) */}
          <path
            d={DICTATOR_PET_KLEP}
            fill="#0c0c0c"
            stroke={DICTATOR_GOUD_CONTOUR}
            strokeWidth="0.5"
            strokeLinejoin="round"
          />
          <path
            d={DICTATOR_PET_KLEP_GLANS}
            fill="rgba(255, 255, 255, 0.15)"
          />
          {/* Stormband (gold) */}
          <path
            d={DICTATOR_PET_STORM}
            fill="none"
            stroke="url(#fut-orn-goud)"
            strokeWidth="0.8"
            strokeLinecap="round"
          />
          <circle cx={26.5} cy={1.5} r={1.3} fill="url(#fut-orn-goud)" stroke={DICTATOR_GOUD_CONTOUR} strokeWidth="0.3" />
          <circle cx={73.5} cy={1.5} r={1.3} fill="url(#fut-orn-goud)" stroke={DICTATOR_GOUD_CONTOUR} strokeWidth="0.3" />
          {/* Cocarde (red star with gold badge) */}
          <circle cx={50} cy={-9.5} r={3.8} fill="#7e1228" stroke={DICTATOR_GOUD_CONTOUR} strokeWidth="0.4" />
          <path
            d={DICTATOR_PET_COCARDE_STER}
            fill="url(#fut-orn-goud)"
            stroke={DICTATOR_GOUD_CONTOUR}
            strokeWidth="0.3"
            strokeLinejoin="round"
          />
        </g>
        <FutDivisieDefs />
        {/* In-Form (#710) — het énige editie-ornament: champagnegouden
            bliksemcrest en twee slanke vinnen áchter de kaart, een
            bliksemmedaillon ervóór. Alles zit op de as of langs de ónderrand,
            die bij alle vijf de schildvormen identiek is; de crest staat
            bewust bóven v=0 i.p.v. ín de notch, want die notch is per vorm
            anders diep (zie het commentaar bij INFORM_CREST). */}
        <linearGradient
          id="fut-orn-inform-goud"
          x1="0"
          y1="0"
          x2="0.3"
          y2="1"
          gradientUnits="objectBoundingBox"
        >
          {INFORM_GOUD_VERLOOP.map(([offset, kleur]) => (
            <stop key={offset} offset={offset} stopColor={kleur} />
          ))}
        </linearGradient>
        <g id="fut-orn-inform-achter-helft">
          {INFORM_VINNEN.map((vin, index) => (
            <FutStreng
              key={vin.omtrek}
              streng={vin}
              ribbelBreedte={index === 0 ? 0.62 : 0.46}
              materiaal={INFORM_MATERIAAL}
            />
          ))}
        </g>
        <g id="fut-orn-inform-achter">
          <use href="#fut-orn-inform-achter-helft" />
          <use
            href="#fut-orn-inform-achter-helft"
            transform="translate(100,0) scale(-1,1)"
          />
          {/* De crest staat op de as en wordt dus niet gespiegeld. */}
          <FutGoud
            d={INFORM_CREST}
            vulling="url(#fut-orn-inform-goud)"
            contour={INFORM_GOUD_CONTOUR}
            glans={INFORM_GOUD_GLANS}
          />
        </g>
        <g id="fut-orn-inform-voor">
          {/* Medaillon in de punt: ring — spouw — ring — titaniumvlak —
              bliksem. Vier concentrische cirkels i.p.v. één brede stroke,
              zodat het reliëf van de referentie ook op de veldmaat leest. */}
          {(
            [
              [INFORM_MEDAILLON.ring, "url(#fut-orn-inform-goud)"],
              [INFORM_MEDAILLON.spouw, INFORM_TITAAN],
              [INFORM_MEDAILLON.binnenring, "url(#fut-orn-inform-goud)"],
              [INFORM_MEDAILLON.vlak, INFORM_TITAAN],
            ] as const
          ).map(([r, vulling]) => (
            <circle
              key={r}
              cx={INFORM_MEDAILLON.midden[0]}
              cy={INFORM_MEDAILLON.midden[1]}
              r={r}
              fill={vulling}
              stroke={INFORM_GOUD_CONTOUR}
              strokeWidth="0.35"
            />
          ))}
          <FutGoud
            d={INFORM_MEDAILLON.bliksem}
            vulling="url(#fut-orn-inform-goud)"
            contour={INFORM_GOUD_CONTOUR}
            glans={INFORM_GOUD_GLANS}
          />
        </g>
        {/* On Fire (#710) — de editie-ornamentlaag. Verhit koper voor de
            vinnen, crest en het medaillon; verkoold staal voor de crest-plaat;
            een gloeikern voor de vlam in het medaillon. */}
        <linearGradient
          id="fut-orn-koper"
          x1="0"
          y1="0"
          x2="0.35"
          y2="1"
          gradientUnits="objectBoundingBox"
        >
          {ONFIRE_KOPER.verloop.map(([offset, kleur]) => (
            <stop key={offset} offset={offset} stopColor={kleur} />
          ))}
        </linearGradient>
        <linearGradient
          id="fut-orn-onfire-staal"
          x1="0"
          y1="0"
          x2="0.2"
          y2="1"
          gradientUnits="objectBoundingBox"
        >
          {ONFIRE_STAAL_VERLOOP.map(([offset, kleur]) => (
            <stop key={offset} offset={offset} stopColor={kleur} />
          ))}
        </linearGradient>
        <linearGradient
          id="fut-orn-gloed"
          x1="0"
          y1="1"
          x2="0"
          y2="0"
          gradientUnits="objectBoundingBox"
        >
          {ONFIRE_GLOED_VERLOOP.map(([offset, kleur]) => (
            <stop key={offset} offset={offset} stopColor={kleur} />
          ))}
        </linearGradient>
        {/* De metalen V-rails blijven vectorieel en liggen achter de kaart.
            Vuur, lava en rook komen uit de gedeelde masterlaag. */}
        <g id="fut-orn-onfire-vinnen-helft">
          {ONFIRE_VINNEN.map((vin) => (
            <FutStreng key={vin.omtrek} streng={vin} materiaal={ONFIRE_MATERIAAL} />
          ))}
        </g>
        <g id="fut-orn-onfire-achter">
          <use href="#fut-orn-onfire-vinnen-helft" />
          <use
            href="#fut-orn-onfire-vinnen-helft"
            transform="translate(100,0) scale(-1,1)"
          />
        </g>
        {/* En vóór de kaart: de vlamcrest op de bovenrand, het gloeiende
            medaillon over de punt en de sintelaccenten. De crest móet vóór
            liggen — hij dekt de bovenrand af en werkt zo op élke schildvorm
            (zie ornamentenOnfire.ts); het medaillon verbergt bovendien de
            wortels van de vinnen. Alles staat op de as of komt uit de
            gespiegelde sintel-helft. */}
        <g id="fut-orn-onfire-sintels-helft">
          {ONFIRE_SINTELS.map(([u, v, r]) => (
            <g key={`${u}-${v}`}>
              <circle cx={u} cy={v} r={r * 2.6} fill={ONFIRE_SINTEL_GLOED} opacity="0.35" />
              <circle cx={u} cy={v} r={r} fill={ONFIRE_SINTEL_KERN} />
            </g>
          ))}
        </g>
        <g id="fut-orn-onfire-voor">
          <path
            d={ONFIRE_CREST_PLAAT}
            fill="url(#fut-orn-onfire-staal)"
            stroke="url(#fut-orn-koper)"
            strokeWidth="0.55"
            strokeLinejoin="round"
          />
          <FutKoper d={ONFIRE_CREST_BAND} />
          <FutKoper d={ONFIRE_CREST_VLAM} />
          {ONFIRE_CREST_NERVEN.map((d) => (
            <path
              key={d}
              d={d}
              fill="none"
              stroke={ONFIRE_KOPER.ribbel}
              strokeWidth="0.32"
              strokeLinecap="round"
            />
          ))}
          <circle
            cx={ONFIRE_MEDAILLON.midden[0]}
            cy={ONFIRE_MEDAILLON.midden[1]}
            r={ONFIRE_MEDAILLON.ring}
            fill="url(#fut-orn-koper)"
            stroke={ONFIRE_KOPER.contour}
            strokeWidth="0.55"
          />
          <circle
            cx={ONFIRE_MEDAILLON.midden[0]}
            cy={ONFIRE_MEDAILLON.midden[1]}
            r={ONFIRE_MEDAILLON.vlak}
            fill={ONFIRE_MEDAILLON_DIEP}
            stroke={ONFIRE_KOPER.contour}
            strokeWidth="0.35"
          />
          <path d={ONFIRE_MEDAILLON_VLAM} fill="url(#fut-orn-gloed)" />
          {ONFIRE_MEDAILLON_NERVEN.map((d) => (
            <path
              key={d}
              d={d}
              fill="none"
              stroke="rgba(120, 40, 10, 0.5)"
              strokeWidth="0.3"
              strokeLinecap="round"
            />
          ))}
          <use href="#fut-orn-onfire-sintels-helft" />
          <use
            href="#fut-orn-onfire-sintels-helft"
            transform="translate(100,0) scale(-1,1)"
          />
        </g>
        {/* GOAT áchter de kaart (#772): alleen de bokhoorns. Het baardfiligraan
            verhuisde naar de vóór-laag hieronder — in de referentie ligt het
            óver de onderste kaartpunt, en achter het schild zag je er niets
            meer van dan twee sliertjes naast de rand. */}
        <g id="fut-orn-goat-achter">
          <use href="#fut-orn-goat-helft" />
          <use href="#fut-orn-goat-helft" transform="translate(100,0) scale(-1,1)" />
        </g>
        {/* GOAT vóór de kaart (#772): het baardornament in de kaartpunt. De
            speerpunt staat op de as (uit zichzelf symmetrisch), armen en
            haarbladen komen twee keer uit dezelfde helft. */}
        <g id="fut-orn-goat-voor">
          <use href="#fut-orn-goat-baard-helft" />
          <use
            href="#fut-orn-goat-baard-helft"
            transform="translate(100,0) scale(-1,1)"
          />
          <path
            d={GOAT_BAARD_SPEER}
            fill="url(#fut-orn-metaal)"
            stroke={GOAT_METAAL_CONTOUR}
            strokeWidth="0.5"
            strokeLinejoin="round"
          />
          {GOAT_BAARD_NERVEN.map((d) => (
            <path
              key={d}
              d={d}
              fill="url(#fut-orn-metaal)"
              stroke={GOAT_METAAL_CONTOUR}
              strokeWidth="0.45"
              strokeLinejoin="round"
            />
          ))}
          {/* Glowing pink gem on spear point */}
          <path
            d="M 50 120.5 L 52.2 124 L 50 127.5 L 47.8 124 Z"
            fill="#ff4d80"
            stroke="#ffe2ea"
            strokeWidth="0.35"
            strokeLinejoin="round"
          />
          <path
            d="M 49.3 121.5 L 50.7 121.5 L 50 124 Z"
            fill="rgba(255, 255, 255, 0.45)"
          />
        </g>
        {/* Big Daddy (#710): twee groepen i.p.v. één. Het feestwerk (lint,
            ballonnen, confetti) hoort áchter de kaart, maar kroon en
            punt-ornament liggen in de referentie duidelijk óver de rand — een
            steen die achter het schild valt is geen steen meer. Vandaar een
            tweede, vóór-liggende laag; zie .fut-kaart__ornament--voor. */}
        <g id="fut-orn-bigdaddy-helft">
          <FutStreng
            streng={BD_LINT_BOOG}
            materiaal={BD_LINT_MATERIAAL}
            ribbelBreedte={0.4}
          />
          <FutStreng
            streng={BD_LINT_STAART}
            materiaal={BD_LINT_MATERIAAL}
            ribbelBreedte={0.4}
          />
        </g>
        <g id="fut-orn-bigdaddy-achter">
          <use href="#fut-orn-bigdaddy-helft" />
          <use
            href="#fut-orn-bigdaddy-helft"
            transform="translate(100,0) scale(-1,1)"
          />
          {/* Ballonnen: bewust twee en alleen rechtsboven, met het touwtje dat
              achter de schouder verdwijnt. Niet gespiegeld — een symmetrisch
              paar zou als logo lezen i.p.v. als feestaccent. */}
          {BD_BALLONNEN.map((b) => (
            <g key={b.id}>
              <path
                d={b.touw}
                fill="none"
                stroke={BD_BALLON_TOUW}
                strokeWidth="0.4"
                strokeLinecap="round"
              />
              <path
                d={b.knoop}
                fill={`url(#fut-orn-bd-ballon-${b.id})`}
                stroke={BD_CONTOUR}
                strokeWidth="0.3"
                strokeLinejoin="round"
              />
              <path
                d={b.d}
                fill={`url(#fut-orn-bd-ballon-${b.id})`}
                stroke={BD_CONTOUR}
                strokeWidth="0.4"
                strokeLinejoin="round"
              />
              <path d={cirkelPad(b.glans)} fill={BD_BALLON_GLANS} />
            </g>
          ))}
          {BD_CONFETTI.map((c) => (
            <path key={c.d} d={c.d} fill={c.kleur} />
          ))}
        </g>
        <g id="fut-orn-bigdaddy-voor-helft">
          <FutStreng
            streng={BD_PUNT_VLEUGEL}
            materiaal={BD_METAAL_MATERIAAL}
            ribbelBreedte={0.3}
          />
        </g>
        <g id="fut-orn-bigdaddy-voor">
          <use href="#fut-orn-bigdaddy-voor-helft" />
          <use
            href="#fut-orn-bigdaddy-voor-helft"
            transform="translate(100,0) scale(-1,1)"
          />
          <path
            d={BD_PUNT_ZETTING}
            fill={BD_METAAL_MATERIAAL.vulling}
            stroke={BD_CONTOUR}
            strokeWidth="0.6"
            strokeLinejoin="round"
          />
          <FutSteen omtrek={BD_PUNT_STEEN} facetten={BD_PUNT_STEEN_FACETTEN} />
          <path
            d={BD_KROON}
            fill={BD_METAAL_MATERIAAL.vulling}
            stroke={BD_CONTOUR}
            strokeWidth="0.6"
            strokeLinejoin="round"
          />
          {BD_KROON_BAND.map((d) => (
            <path
              key={d}
              d={d}
              fill="none"
              stroke={BD_RIBBEL}
              strokeWidth="0.45"
              strokeLinecap="round"
            />
          ))}
          {BD_KROON_BANDGLANS.map((d) => (
            <path
              key={d}
              d={d}
              fill="none"
              stroke={BD_RIBBELGLANS}
              strokeWidth="0.4"
              strokeLinecap="round"
            />
          ))}
          {BD_KROON_BOLLEN.map((b) => (
            <path
              key={`${b.cx}-${b.cy}`}
              d={cirkelPad(b)}
              fill={BD_METAAL_MATERIAAL.vulling}
              stroke={BD_CONTOUR}
              strokeWidth="0.45"
            />
          ))}
          <FutSteen
            omtrek={BD_KROON_STEEN}
            facetten={BD_KROON_STEEN_FACETTEN}
          />
        </g>
        {/* Kampioen (#710): lauwerkrans en medaillelinten achter de kaart, en
            de diamantcrest als aparte groep vóór de kaart. */}
        <FutOrnamentVerloop
          id="fut-orn-kampioen-loof"
          as={KAMPIOEN_LOOF_AS}
          stops={KAMPIOEN_LOOF_VERLOOP}
        />
        <FutOrnamentVerloop
          id="fut-orn-kampioen-lint-groen"
          as={KAMPIOEN_LINT_AS_VERLOOP}
          stops={KAMPIOEN_LINT_GROEN_VERLOOP}
        />
        <FutOrnamentVerloop
          id="fut-orn-kampioen-lint-platina"
          as={KAMPIOEN_LINT_AS_VERLOOP}
          stops={KAMPIOEN_LINT_PLATINA_VERLOOP}
        />
        <FutOrnamentVerloop
          id="fut-orn-kampioen-zetting"
          as={KAMPIOEN_ZETTING_AS}
          stops={KAMPIOEN_ZETTING_VERLOOP}
        />
        <g id="fut-orn-kampioen-lint-helft">
          <FutLint
            lint={KAMPIOEN_LINT_BUITEN}
            vulling="url(#fut-orn-kampioen-lint-groen)"
          />
          <FutLint
            lint={KAMPIOEN_LINT_PLATINA}
            vulling="url(#fut-orn-kampioen-lint-platina)"
          />
        </g>
        <g id="fut-orn-kampioen-krans-helft">
          <FutStreng
            streng={KAMPIOEN_KRANS_STAM}
            materiaal={KAMPIOEN_LOOF_MATERIAAL}
          />
          {KAMPIOEN_KRANS_BLAD.map((b) => (
            <g key={b.d}>
              <path
                d={b.d}
                fill="url(#fut-orn-kampioen-loof)"
                stroke={KAMPIOEN_LOOF_CONTOUR}
                strokeWidth="0.35"
                strokeLinejoin="round"
              />
              {/* Zilverrand op de bolle flank plus de gegraveerde nerf: samen
                  geven ze elk blad reliëf zonder een tweede vulling. */}
              <path
                d={b.rand}
                fill="none"
                stroke={KAMPIOEN_LOOF_GLANS}
                strokeWidth="0.45"
                strokeLinecap="round"
              />
              <path
                d={b.nerf}
                fill="none"
                stroke={KAMPIOEN_LOOF_NERF}
                strokeWidth="0.35"
                strokeLinecap="round"
              />
            </g>
          ))}
        </g>
        <g id="fut-orn-kampioen-achter">
          {/* Linten eerst: de onderste bladeren van de krans vallen eróver,
              net als op de referentie. Het middenlint staat op de as en wordt
              dus niet gespiegeld — het ís de spiegelas. */}
          <use href="#fut-orn-kampioen-lint-helft" />
          <use
            href="#fut-orn-kampioen-lint-helft"
            transform="translate(100,0) scale(-1,1)"
          />
          <FutLint
            lint={KAMPIOEN_LINT_AS}
            vulling="url(#fut-orn-kampioen-lint-groen)"
          />
          {KAMPIOEN_LINT_EMBLEEM.map((d) => (
            <path
              key={d}
              d={d}
              fill="none"
              stroke={KAMPIOEN_LINT_LIJN}
              strokeWidth="0.35"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          <use href="#fut-orn-kampioen-krans-helft" />
          <use
            href="#fut-orn-kampioen-krans-helft"
            transform="translate(100,0) scale(-1,1)"
          />
        </g>
        <g id="fut-orn-kampioen-voor">
          <path
            d={KAMPIOEN_CREST_ZETTING}
            fill="url(#fut-orn-kampioen-zetting)"
            stroke={KAMPIOEN_ZETTING_CONTOUR}
            strokeWidth="0.5"
            strokeLinejoin="round"
          />
          <path d={KAMPIOEN_CREST_RING} fill={KAMPIOEN_CREST_RING_KLEUR} />
          {KAMPIOEN_CREST_FACET.map((d, i) => (
            <path key={d} d={d} fill={KAMPIOEN_STEEN_FACETTEN[i]} />
          ))}
          <path
            d={KAMPIOEN_CREST_KRUIS}
            fill="none"
            stroke={KAMPIOEN_STEEN_FACET}
            strokeWidth="0.3"
          />
          <path
            d={KAMPIOEN_CREST_STEEN}
            fill="none"
            stroke={KAMPIOEN_STEEN_CONTOUR}
            strokeWidth="0.4"
            strokeLinejoin="round"
          />
          {KAMPIOEN_CREST_KLAUW.map((d) => (
            <path key={d} d={d} fill={KAMPIOEN_STEEN_KLAUW} />
          ))}
          <path d={KAMPIOEN_CREST_GLANS} fill={KAMPIOEN_STEEN_GLANS} />
        </g>
        {/* Pias (#710): de gevallen joker. Twee groepen i.p.v. één, want dit
            ornament ligt aan twee kanten van de kaart — kap-lobben en linten
            komen áchter het schild vandaan, de kraag en het maskermedaillon
            liggen erover (anders zou de kap "erop geplakt" lezen i.p.v.
            geïntegreerd in de bovenrand). Elke laag heeft zijn eigen
            linkerhelft plus gespiegelde <use>. */}
        {/* Recht van boven naar onder (x1 = x2 = 0), niet diagonaal als het
            GOAT-metaal. Dat is geen smaakkeuze maar een pariteits-eis: de
            pias-ornamenten liggen ver van de kaartas (belletjes op u≈34 en
            u≈67, het medaillon op v≈127), en canvas kent geen
            objectBoundingBox — een schuine as zou daar per vorm een ándere
            anker-x nodig hebben. Verticaal is de y-strook het enige wat de
            canvas-spiegel hoeft te weten. */}
        <linearGradient
          id="fut-orn-pias-goud"
          x1="0"
          y1="0"
          x2="0"
          y2="1"
          gradientUnits="objectBoundingBox"
        >
          {PIAS_GOUD_VERLOOP.map(([offset, kleur]) => (
            <stop key={offset} offset={offset} stopColor={kleur} />
          ))}
        </linearGradient>
        <linearGradient
          id="fut-orn-pias-stof"
          x1="0"
          y1="0"
          x2="0"
          y2="1"
          gradientUnits="objectBoundingBox"
        >
          {PIAS_STOF_VERLOOP.map(([offset, kleur]) => (
            <stop key={offset} offset={offset} stopColor={kleur} />
          ))}
        </linearGradient>
        <g id="fut-orn-pias-helft">
          <FutStreng streng={PIAS_LINT} materiaal={PIAS_STOF_MATERIAAL} />
          <path
            d={PIAS_LINT_HALS}
            fill="url(#fut-orn-pias-goud)"
            stroke={PIAS_GOUD_CONTOUR}
            strokeWidth="0.4"
          />
          <PiasBelletje bel={PIAS_LINT_BEL} />
          <FutStreng streng={PIAS_KAP_ZIJLOB} materiaal={PIAS_STOF_MATERIAAL} />
        </g>
        <g id="fut-orn-pias-achter">
          <use href="#fut-orn-pias-helft" />
          <use href="#fut-orn-pias-helft" transform="translate(100,0) scale(-1,1)" />
          {/* De middenlob leunt bewust scheef en staat dus niet op de as: geen
              spiegeling, zoals het GOAT-baardblad. */}
          <FutStreng streng={PIAS_KAP_MIDDENLOB} materiaal={PIAS_STOF_MATERIAAL} />
        </g>
        <g id="fut-orn-pias-voor-helft">
          {PIAS_MED_VOLUTE.map((d) => (
            <path
              key={d}
              d={d}
              fill="none"
              stroke="url(#fut-orn-pias-goud)"
              strokeWidth="1.1"
              strokeLinecap="round"
            />
          ))}
        </g>
        <g id="fut-orn-pias-voor">
          {/* Kraag over de bovenrand, met de zoom eronder en twee nerven erin. */}
          {[PIAS_KAP_ZOOM, PIAS_KAP_BAND].map((d) => (
            <path
              key={d}
              d={d}
              fill="url(#fut-orn-pias-goud)"
              stroke={PIAS_GOUD_CONTOUR}
              strokeWidth="0.5"
              strokeLinejoin="round"
            />
          ))}
          {PIAS_KAP_NERVEN.map((d) => (
            <path
              key={d}
              d={d}
              fill="none"
              stroke={PIAS_GOUD_GRAVURE}
              strokeWidth="0.4"
              strokeLinecap="round"
            />
          ))}
          {PIAS_KAP_BELLEN.map((bel) => (
            <PiasBelletje key={`${bel.cx}-${bel.cy}`} bel={bel} />
          ))}
          <use href="#fut-orn-pias-voor-helft" />
          <use
            href="#fut-orn-pias-voor-helft"
            transform="translate(100,0) scale(-1,1)"
          />
          {/* Maskermedaillon op de schildpunt: ring, bordeaux binnenvlak,
              haarlijn, en daarin het gebarsten masker. */}
          <path
            d={PIAS_MED_RING}
            fill="url(#fut-orn-pias-goud)"
            stroke={PIAS_GOUD_CONTOUR}
            strokeWidth="0.6"
          />
          <path
            d={PIAS_MED_VLAK}
            fill="url(#fut-orn-pias-stof)"
            stroke={PIAS_GOUD_CONTOUR}
            strokeWidth="0.4"
          />
          <path
            d={PIAS_MED_HAARLIJN}
            fill="none"
            stroke={PIAS_GOUD_GLANS}
            strokeWidth="0.3"
          />
          <path
            d={PIAS_MED_MASKER}
            fill="url(#fut-orn-pias-goud)"
            stroke={PIAS_GOUD_CONTOUR}
            strokeWidth="0.4"
            strokeLinejoin="round"
          />
          {PIAS_MED_TREKKEN.map((d) => (
            <path
              key={d}
              d={d}
              fill="none"
              stroke={PIAS_GOUD_GRAVURE}
              strokeWidth="0.55"
              strokeLinecap="round"
            />
          ))}
          <path d={PIAS_MED_TRAAN} fill={PIAS_GOUD_SCHADUW} />
          <path
            d={PIAS_MED_BARST}
            fill="none"
            stroke={PIAS_GOUD_CONTOUR}
            strokeWidth="0.6"
            strokeLinejoin="round"
          />
        </g>
        {/* Zwarte Piet (#710): twee lagen i.p.v. één. De kettingen hangen
            áchter de kaart (ze komen van achter de flanken vandaan), maar de
            crest, de randgravures en het zegel liggen ópgelegd op het
            lakframe — die moeten dus vóór de kaart, anders verdwijnen ze er
            volledig achter. */}
        <linearGradient
          id="fut-orn-staal"
          x1="0"
          y1="0"
          x2="0.3"
          y2="1"
          gradientUnits="objectBoundingBox"
        >
          {PIET_STAAL_VERLOOP.map(([offset, kleur]) => (
            <stop key={offset} offset={offset} stopColor={kleur} />
          ))}
        </linearGradient>
        <g id="fut-orn-piet-achter-helft">
          <PietKetting />
        </g>
        <g id="fut-orn-piet-achter">
          <use href="#fut-orn-piet-achter-helft" />
          <use
            href="#fut-orn-piet-achter-helft"
            transform="translate(100,0) scale(-1,1)"
          />
        </g>
        <g id="fut-orn-piet-voor-helft">
          <PietGravure />
          <PietGravureLauwer />
        </g>
        <g id="fut-orn-piet-voor">
          <use href="#fut-orn-piet-voor-helft" />
          <use
            href="#fut-orn-piet-voor-helft"
            transform="translate(100,0) scale(-1,1)"
          />
          {/* Crest en zegel staan op de as en worden dus niet gespiegeld; ze
              komen ná de helften, zodat ze over de vleugelwortels en de
              uiteinden van de lauwerband vallen. */}
          <path
            d={PIET_CREST_PUNT}
            fill={PIET_LAK}
            stroke={PIET_LAK_RAND}
            strokeWidth="0.6"
          />
          <path
            d={PIET_CREST_RING}
            fill="url(#fut-orn-staal)"
            stroke={PIET_STAAL_CONTOUR}
            strokeWidth="0.5"
          />
          <path
            d={PIET_CREST_SCHIJF}
            fill={PIET_LAK}
            stroke={PIET_LAK_RAND}
            strokeWidth="0.4"
          />
          {PIET_CREST_GRAVURE.map((d) => (
            <path
              key={d}
              d={d}
              fill="none"
              stroke={PIET_GRAVURE}
              strokeWidth="0.3"
            />
          ))}
          <path
            d={PIET_CREST_PION}
            fill="#0d0c0a"
            stroke={PIET_LAK_RAND}
            strokeWidth="0.3"
          />
          <PietZegel />
        </g>
      </defs>
    </svg>
  );
}

/** Motief-svg (#710): het geëtste watermerk ín het vlak, als échte laag
 *  achter de inkt (z-index −1; het vlak is door zijn clip-path een eigen
 *  stacking context). Paden en kleur komen uit futKaartOrnamenten.ts en
 *  worden op canvas als Path2D hergebruikt. */
function FutKaartMotief({
  paden,
  kleur,
  breedte,
  positie,
  className,
  viewBox = "0 0 100 100",
  vullend = false,
}: {
  paden: readonly OrnamentPad[];
  kleur: string;
  /** Breedte als fractie van het vlak (CSS --motief-b, default 0.92). */
  breedte?: number;
  /** Verticale plaatsing als background-position-fractie (--motief-pos). */
  positie?: number;
  /** Extra klasse wanneer een register zijn maten liever in de CSS zet dan
   *  via de twee variabelen hierboven (zoals het Big Daddy-kroonwatermerk). */
  className?: string;
  /** Eigen viewBox (#710, pias): een motief dat tot in de schildpunt doorloopt
   *  rekent in kaart-units (100 × 139) i.p.v. de vierkante doos van de GOAT. */
  viewBox?: string;
  /** Vult het hele vlak i.p.v. te passen: dan mág de laag opzij afgesneden
   *  worden (het ruitpatroon bloedt bewust door de schildrand heen) en volgt
   *  de canvas-spiegel met dezelfde niet-uniforme schaal. */
  vullend?: boolean;
}) {
  return (
    <svg
      className={`fut-kaart__motief${vullend ? " fut-kaart__motief--vol" : ""}${
        className ? ` ${className}` : ""
      }`}
      viewBox={viewBox}
      preserveAspectRatio={vullend ? "none" : undefined}
      aria-hidden="true"
      style={{
        ...(breedte != null ? { ["--motief-b" as string]: breedte * 100 } : {}),
        ...(positie != null
          ? { ["--motief-pos" as string]: `${positie * 100}%` }
          : {}),
      }}
    >
      {paden.map((p, index) =>
        p.soort === "vlak" ? (
          <path
            key={`${index}-${p.soort}-${p.d}`}
            d={p.d}
            fill={p.kleur ?? kleur}
            opacity={p.alpha}
          />
        ) : (
          <path
            key={`${index}-${p.soort}-${p.d}`}
            d={p.d}
            fill="none"
            stroke={p.kleur ?? kleur}
            strokeWidth={p.breedte}
            opacity={p.alpha}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ),
      )}
    </svg>
  );
}

/** Divisie-icoon van de GOAT (#772): een eigen geitenkop i.p.v. 🐐. De emoji
 *  rendert per platform anders (iOS toont een compleet geitje, Android een
 *  kop, desktop niets herkenbaars op 11 px) en dat is te weinig houvast voor
 *  een divisiemerk. Decoratief: de divisieregel "GOAT" eronder draagt de
 *  betekenis, dus `aria-hidden` — de kleur alleen mag het nooit doen. Erft de
 *  inkt van het eloblok, zodat hij in élk register mee-kleurt. */
function FutGoatIcoon() {
  return (
    <svg
      className="fut-kaart__tier-icoon"
      viewBox={GOAT_ICOON_VIEWBOX}
      aria-hidden="true"
      focusable="false"
    >
      {GOAT_ICOON.map((p) =>
        p.soort === "vlak" ? (
          <path key={p.d} d={p.d} fill="currentColor" />
        ) : (
          <path
            key={p.d}
            d={p.d}
            fill="none"
            stroke="currentColor"
            strokeWidth={p.breedte}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ),
      )}
    </svg>
  );
}

/** De zes speciale edities zoals de kaart ze als prop kent (#497/#625/#631/
 *  #632/#645). Canvas-spiegel: `KaartEditie` in lib/utils/futKaartCanvas.ts. */
export type FutEditie =
  | "icon"
  | "kampioen"
  | "inform"
  | "onfire"
  | "pias"
  | "piet";

/** De drie ornamentfamilies die búiten het schild uitsteken (#710). */
export type FutOrnament = "goat" | "dictator" | "inform";


const EDITIE_ORNAMENT: Record<string, OrnamentNaam | undefined> = {
  icon: "bigdaddy",
  kampioen: "kampioen",
  pias: "pias",
  piet: "piet",
  inform: "inform",
  onfire: "onfire",
};
const TIER_ORNAMENT: Record<string, OrnamentNaam | undefined> = {
  legende: "goat",
  dictator: "dictator",
};

/** Houdt bij of een element in beeld staat, zodat de glans buiten de viewport
 *  pauzeert (#773). Start op `true`: een kaart die al zichtbaar is bij de eerste
 *  render mag niet één frame stilstaan, en waar IntersectionObserver ontbreekt
 *  (jsdom in de tests, oudere webviews) valt de hook stil terug op "altijd
 *  animeren" in plaats van op "nooit". */
function useInBeeld(actief: boolean) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [inBeeld, setInBeeld] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!actief || !el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      ([entry]) => setInBeeld(entry.isIntersecting),
      // Ruime marge: de kaart draait al voordat hij in beeld schuift, zodat een
      // sweep niet halverwege begint terwijl de gebruiker ernaar kijkt.
      { rootMargin: "120px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [actief]);
  return { ref, inBeeld };
}

/** De kaart zelf: tier-modifier + flip-structuur (voor/achter), met de
 *  liner- en vlak-lagen als vaste boilerplate. `voorOverlay`/`achterOverlay`
 *  zijn de interactielagen van de caller (flip-knop, lightbox-knop) en
 *  liggen bóven het vlak. De maat stuurt de caller via --fut-kw (CSS). */
export function FutKaart({
  tier,
  editie = null,
  omgedraaid = false,
  className,
  voor,
  achter,
  voorOverlay,
  achterOverlay,
  glansZaad,
}: {
  tier: Tier | null;
  /** Speciale editie (#497/#625/#631/#632/#645): kleurt frame en vlak bóvenop
   *  de tier-klasse (icon = Big Daddy, kampioen = winnaar vorig kwartaal,
   *  inform = speler van de week, onfire = actieve winstreak, pias =
   *  anti-MVP van de week, piet = drager van de Zwarte Piet); de schildvorm
   *  blijft die van de divisie. Elke waarde heeft zijn eigen skin in
   *  FutKaart.css. */
  editie?: FutEditie | null;
  omgedraaid?: boolean;
  /** Extra klasse op de wrapper (bv. "lineup-kaart" voor de veld-maat). */
  className?: string;
  /** Vlak-inhoud van de voorkant. */
  voor: ReactNode;
  /** Vlak-inhoud van de achterkant (gecentreerd stats-vlak). */
  achter?: ReactNode;
  voorOverlay?: ReactNode;
  achterOverlay?: ReactNode;
  /** Stabiel zaad (speler-key) voor de startvertraging van de premium glans
   *  (#773). Zonder dit starten alle kaarten in een raster synchroon. */
  glansZaad?: string;
}) {
  // Premium glans (#773): een editie met eigen glans wint van de tier-glans —
  // dezelfde cascade als bij het ornament. Is er een tijdelijke overlay actief
  // (In-Form, On Fire), dan houdt die de visuele voorrang en valt de permanente
  // glans terug op zijn statische highlight; twee zware animaties over elkaar is
  // precies wat de issue wil vermijden.
  const { variant: glans, gedempt: glansGedempt } = premiumGlans(
    editie,
    tier?.key,
  );
  const { ref: kaartRef, inBeeld } = useInBeeld(glans !== null && !glansGedempt);
  const klassen = [
    "fut-kaart",
    tier ? `fut-kaart--${tier.key}` : "",
    editie ? `fut-kaart--${editie}` : "",
    omgedraaid ? "is-omgedraaid" : "",
    glans && !inBeeld ? "is-buiten-beeld" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
  // Ornament (#710): de laag die buiten het schild uitsteekt. Een editie met
  // eigen ornament wint van het tier-ornament — net zoals de editie-skin het
  // vlak wint; zonder zo'n editie hangt het ornament aan de tíer, dus een
  // GOAT met In-Form houdt zijn hoorns.
  const ornament = EDITIE_ORNAMENT[editie ?? ""] ?? TIER_ORNAMENT[tier?.key ?? ""] ?? null;
  // Voorste ornamentlaag (#710): ornamenten die achter het schild half zouden
  // verdwijnen — de kroon en punt-edelsteen van Big Daddy, de lauwerkrans en
  // het lakzegel van El Padelissimo, de diamantcrest van de Kampioen, de kraag
  // en het maskermedaillon van de pias, de crest en het gebroken zegel van de
  // Zwarte Piet.
  // Elk ornament heeft ook een laag vóór de kaart: een crest in de bovenrand of
  // een medaillon in de punt zou achter het schild half verdwijnen. Sinds #772
  // geldt dat ook voor de GOAT: de hoorns blijven erachter (ze groeien uit de
  // bovenhoeken vandaan), het baardfiligraan ligt ervóór, in de kaartpunt.
  const ornamentVoor = ornament;
  // Divisie-ornament (#710): de negen basisdivisies hebben elk hun eigen crest,
  // zijranden en medaillon. Ze staan onderaan de prioriteit — een editie of een
  // toptier-ornament wint, want die zeggen iets tijdelijkers en zeldzamers over
  // deze speler dan zijn divisie.
  const divisie = !editie && !ornament ? divisieKaart(tier?.key) : undefined;
  // Motief (#710): het watermerk ín het vlak hoort bij het vlak-register. Onder
  // een editie-skin wijkt het tier-motief dus (het GOAT-medaillon zou op het
  // In-Form-navy vloeken); een editie met eigen watermerk zet dat ervoor.
  const motief =
    editie === "icon" ? (
      <FutKaartMotief
        paden={BD_KROON_MOTIEF}
        kleur={BD_KROON_MOTIEF_KLEUR}
        className="fut-kaart__motief--kroon"
      />
    ) : editie === "kampioen" ? (
      <FutKaartMotief paden={KAMPIOEN_ZEGEL} kleur={KAMPIOEN_ZEGEL_KLEUR} />
    ) : editie === "pias" ? (
      <FutKaartMotief
        paden={PIAS_MOTIEF}
        kleur={PIAS_MOTIEF_INK}
        className="fut-kaart__motief--vol"
        viewBox={PIAS_MOTIEF_VIEWBOX}
      />
    ) : editie === "onfire" ? (
      <FutKaartMotief
        paden={ONFIRE_WATERMARK}
        kleur={ONFIRE_WATERMARK_KLEUR}
        breedte={ONFIRE_WATERMARK_BREEDTE}
        positie={ONFIRE_WATERMARK_POSITIE}
      />
    ) : editie === "inform" ? (
      <FutKaartMotief
        paden={INFORM_MOTIEF}
        kleur={INFORM_MOTIEF_KLEUR}
        breedte={INFORM_MOTIEF_BREEDTE}
        positie={INFORM_MOTIEF_POSITIE}
      />
    ) : editie === "piet" ? (
      <FutKaartMotief
        paden={PIET_WATERMERK}
        kleur={PIET_WATERMERK_KLEUR}
        breedte={PIET_WATERMERK_BREEDTE}
        positie={PIET_WATERMERK_POSITIE}
      />
    ) : divisie?.motief ? (
      <FutKaartMotief
        paden={divisie.motief.paden}
        kleur={divisie.motief.kleur}
        breedte={divisie.motief.breedte}
        positie={divisie.motief.positie}
      />
    ) : editie ? null : tier?.key === "legende" ? (
      <FutKaartMotief
        paden={GOAT_WATERMERK}
        kleur={GOAT_WATERMERK_KLEUR}
        breedte={GOAT_WATERMERK_BREEDTE}
        positie={GOAT_WATERMERK_POSITIE}
      />
    ) : tier?.key === "dictator" ? (
      <FutKaartMotief
        paden={DICTATOR_WATERMARK}
        kleur={DICTATOR_WATERMARK_KLEUR}
        breedte={DICTATOR_WATERMARK_BREEDTE}
        positie={DICTATOR_WATERMARK_POSITIE}
      />
    ) : null;
  // De glanslaag draagt geen kaartgegevens en is puur decoratief, dus
  // aria-hidden; de startvertraging gaat als custom property mee zodat één
  // keyframe-set alle kaarten uit de fase van elkaar houdt.
  const glansLaag = glans ? (
    <span
      className={`fut-kaart__glans${glansGedempt ? " fut-kaart__glans--gedempt" : ""}`}
      aria-hidden="true"
      style={
        {
          "--glans-vertraging": `${glansVertraging(glansZaad)}ms`,
        } as CSSProperties
      }
    />
  ) : null;
  return (
    <div className={klassen} ref={kaartRef}>
      <div className="fut-kaart__flipper">
        {(divisie?.achter?.length ?? 0) > 0 && (
          <svg
            className="fut-kaart__ornament"
            viewBox={ORNAMENT_VIEWBOX}
            aria-hidden="true"
          >
            <use href={`#fut-div-${divisie!.key}-achter`} />
          </svg>
        )}
        {ornament && (
          <svg
            className="fut-kaart__ornament"
            viewBox={ORNAMENT_VIEWBOX}
            aria-hidden="true"
          >
            <use href={`#fut-orn-${ornament}-achter`} />
          </svg>
        )}
        {/* On Fire-backlaag: één coherent vulkaanartwork achter kaart en
            frame. De metalen vinnen hierboven blijven als eigen ornament. */}
        {editie === "onfire" && <OnfireEffectAchter />}
        {/* Storm-achterlaag (#834): de volledige master vóór de zijden in de
            DOM, dus achter kaart en frame. */}
        {editie === "inform" && <InformStormAchter />}
        <div className="fut-kaart__zijde fut-kaart__zijde--voor">
          {voorOverlay}
          <span className="fut-kaart__liner">
            <span className="fut-kaart__keyline">
              <span className="fut-kaart__vlak">
                <span className="fut-kaart__randwaas" aria-hidden="true" />
                {motief}
                {glansLaag}
                {/* Dezelfde On Fire-master in het echte kaartvlak. De inhoud
                    rendert erna en behoudt dus zijn contrast en interactie. */}
                {editie === "onfire" && <OnfireEffectBinnen />}
                {/* Storm-binnenlaag (#834): dezelfde master, door de bestaande
                    schildclip van dit kaartvlak gemaskeerd. De inhoud ({voor})
                    rendert erná en blijft dus leesbaar. */}
                {editie === "inform" && <InformStormBinnen />}
                {voor}
              </span>
            </span>
          </span>
        </div>
        <div
          className="fut-kaart__zijde fut-kaart__zijde--achter"
          aria-hidden={!omgedraaid}
        >
          {achterOverlay}
          <span className="fut-kaart__liner">
            <span className="fut-kaart__keyline">
              <span className="fut-kaart__vlak fut-kaart__vlak--stats">
                <span className="fut-kaart__randwaas" aria-hidden="true" />
                {achter}
              </span>
            </span>
          </span>
        </div>
        {ornamentVoor && (
          <svg
            className="fut-kaart__ornament fut-kaart__ornament--voor"
            viewBox={ORNAMENT_VIEWBOX}
            aria-hidden="true"
          >
            <use href={`#fut-orn-${ornamentVoor}-voor`} />
          </svg>
        )}
        {divisie?.voor && divisie.voor.length > 0 && (
          <svg
            className="fut-kaart__ornament fut-kaart__ornament--voor"
            viewBox={ORNAMENT_VIEWBOX}
            aria-hidden="true"
          >
            <use href={`#fut-div-${divisie.key}-voor`} />
          </svg>
        )}
        {/* Beperkte basalt- en eruptiedelen vóór het frame; crest en
            puntmedaillon blijven via hun hogere z-index leesbaar. */}
        {editie === "onfire" && <OnfireEffectVoor />}
        {/* Storm-voorlaag (#834): dezelfde master door een klein frontmasker,
            zodat alleen geselecteerde wolk- en bliksemstukken het frame
            plaatselijk overlappen. */}
        {editie === "inform" && <InformStormVoor />}
      </div>
    </div>
  );
}

/** PlayStyle-chip (#500): het minimale badge-vlak dat de kaart nodig heeft.
 *  Structureel gelijk aan `Badge` uit de profielen, maar hier los gedefinieerd
 *  zodat de kaart geen profiel-afhankelijkheid krijgt. */
export interface FutPlaystyle {
  id: string;
  naam: string;
  emoji: string;
}

/** Hooguit zoveel PlayStyle-chips passen leesbaar boven de naamplaat. */
export const MAX_PLAYSTYLES = 3;

/** Standaard-voorkant: Elo met sub-niveau (Romeins) en divisie-emoji links,
 *  avatar rechts, naam op de naamplaat en de divisienaam voluit eronder;
 *  optioneel een editie-regel ("👑 Big Daddy") als slotregel.
 *  `playstyles` (#500): uitgelichte badges als hex-chips boven de naamplaat. */
export function FutKaartVoorkant({
  elo,
  tier,
  avatar,
  naam,
  editie,
  editieTitel,
  playstyles,
  nieuwPlaystyleId,
}: {
  elo: number | null;
  tier: Tier | null;
  avatar: ReactNode;
  naam: string;
  /** Editie-regel onder de divisie (#497), bv. "⚡ In-Form · +48". */
  editie?: ReactNode;
  /** Hover-uitleg bij de editie-regel (#655, editieUitleg): alleen gezet
   *  wanneer het label uitleg nodig heeft, zoals de club-scope van de pias. */
  editieTitel?: string | null;
  playstyles?: FutPlaystyle[];
  /** Zojuist verdiende badge (#615): die chip pulseert in het pack-overlay. */
  nieuwPlaystyleId?: string;
}) {
  const chips = (playstyles ?? []).slice(0, MAX_PLAYSTYLES);
  return (
    <>
      <span className="fut-kaart__boven">
        <span className="fut-kaart__eloblok">
          <span className="fut-kaart__elo">{elo ?? "—"}</span>
          {tier?.subLabel && (
            <span className="fut-kaart__sub">{tier.subLabel}</span>
          )}
          {tier && (
            <span className="fut-kaart__tier" title={tierTitle(tier)}>
              {tier.key === "legende" ? <FutGoatIcoon /> : tier.emoji}
            </span>
          )}
        </span>
        <span className="fut-kaart__avatar">{avatar}</span>
      </span>
      {chips.length > 0 && (
        <span
          className="fut-kaart__playstyles"
          role="list"
          aria-label="Uitgelichte badges"
        >
          {chips.map((b) => (
            <span
              key={b.id}
              role="listitem"
              className={`fut-kaart__playstyle${
                b.id === nieuwPlaystyleId ? " fut-kaart__playstyle--nieuw" : ""
              }`}
              title={b.naam}
              aria-label={b.naam}
            >
              <span className="fut-kaart__playstyle-vlak" aria-hidden="true">
                {b.emoji}
              </span>
            </span>
          ))}
        </span>
      )}
      <span className="fut-kaart__naam">{naam}</span>
      {tier && <span className="fut-kaart__divisie">{tier.label}</span>}
      {editie && (
        <span className="fut-kaart__editie" title={editieTitel ?? undefined}>
          {editie}
        </span>
      )}
    </>
  );
}

export default FutKaart;
