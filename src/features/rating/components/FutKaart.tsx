// Gedeelde FUT-schildkaart (#495, gedeeld sinds #496): het kaartrecept van de
// Opstelling — vier geclipte lagen (frame → liner → keyline → vlak, #664) rond een schildclip waarvan de bovenrand
// oploopt met de divisiegroep, metaalvlak in de tierkleur en donkere
// special-toptiers — als herbruikbare component voor de Opstelling (Lineup)
// en het spelersprofiel (ProfileHero). Puur presentationeel: flip-state en
// knoppen (de .fut-kaart__flip-overlays) blijven bij de caller, zodat elke
// plek zijn eigen aria-labels en interacties houdt.

import type { ReactNode } from "react";
import { tierTitle, type Tier } from "@/features/rating/tiers";
import {
  GOAT_BAARD_BLAD,
  GOAT_BAARD_FLICK,
  GOAT_BAARD_NERVEN,
  GOAT_HOORN,
  GOAT_MEDAILLON,
  GOAT_MEDAILLON_KLEUR,
  GOAT_METAAL_CONTOUR,
  GOAT_METAAL_GLANS,
  GOAT_METAAL_RIBBEL,
  GOAT_METAAL_RIBBELGLANS,
  GOAT_METAAL_SCHADUW,
  GOAT_METAAL_VERLOOP,
  ORNAMENT_VIEWBOX,
  type OrnamentPad,
  type Streng,
} from "./futKaartOrnamenten";
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
import "./FutKaart.css";

/** Schildvormen: vier clipPaths met exact dezelfde onderkant (de punt op
 *  50%/100% blijft het chemielijn-anker in de Opstelling) en een bovenrand
 *  die oploopt met de divisiegroep — vlak, kroon-notch, spitse vleugels,
 *  kroon-crest. FutKaart.css kiest per tier via de --schild-variabele.
 *  objectBoundingBox laat de paden meeschalen met elke kaartbreedte.
 *  Eén keer renderen per pagina; dubbel renderen is onschadelijk (identieke
 *  defs), maar onnodig. */
/** Verf van één streng: welk vlak en welke lijnen erop. Tot #710 stond dit
 *  hard in `FutStreng` omdat alleen de GOAT strengen had; sinds de pias er
 *  gouden bies om bordeauxrode stof legt, is het een parameter. Canvas-spiegel:
 *  het `StrengVerf`-blok in futKaartCanvas.ts. */
interface StrengVerf {
  /** SVG-paint van de omtrek — meestal een `url(#…)`-verloop uit de defs. */
  vulling: string;
  contour: string;
  contourBreedte: number;
  glans: string;
  schaduw: string;
  ribbel: string;
  ribbelGlans: string;
}

const GOAT_VERF: StrengVerf = {
  vulling: "url(#fut-orn-metaal)",
  contour: GOAT_METAAL_CONTOUR,
  contourBreedte: 0.7,
  glans: GOAT_METAAL_GLANS,
  schaduw: GOAT_METAAL_SCHADUW,
  ribbel: GOAT_METAAL_RIBBEL,
  ribbelGlans: GOAT_METAAL_RIBBELGLANS,
};

/** Stof met gouden bies (#710, pias): de contour is hier geen donkere lijn maar
 *  de piping zelf, dus dikker en licht. */
const PIAS_STOF_VERF: StrengVerf = {
  vulling: "url(#fut-orn-pias-stof)",
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
function FutStreng({
  streng,
  ribbelBreedte = 0.4,
  verf = GOAT_VERF,
}: {
  streng: Streng;
  ribbelBreedte?: number;
  verf?: StrengVerf;
}) {
  return (
    <>
      <path
        d={streng.omtrek}
        fill={verf.vulling}
        stroke={verf.contour}
        strokeWidth={verf.contourBreedte}
        strokeLinejoin="round"
      />
      {streng.ribbelGlans.map((d) => (
        <path
          key={d}
          d={d}
          fill="none"
          stroke={verf.ribbelGlans}
          strokeWidth={ribbelBreedte}
          strokeLinecap="round"
        />
      ))}
      {streng.ribbels.map((d) => (
        <path
          key={d}
          d={d}
          fill="none"
          stroke={verf.ribbel}
          strokeWidth={ribbelBreedte}
          strokeLinecap="round"
        />
      ))}
      <path
        d={streng.schaduw}
        fill="none"
        stroke={verf.schaduw}
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path
        d={streng.highlight}
        fill="none"
        stroke={verf.glans}
        strokeWidth="0.9"
        strokeLinecap="round"
      />
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
        {/* Ornamenten (#710): de laag die búiten het schild uitsteekt. Eén
            linkerhelft; de tweede <use> spiegelt om x=50 — links en rechts
            zijn per constructie gelijk, zoals de canvas-spiegel dat met
            scale(-1,1) doet. Kaarten verwijzen met <use> naar deze groep,
            dus de paden staan één keer per pagina. */}
        <linearGradient
          id="fut-orn-metaal"
          x1="0"
          y1="0"
          x2="0.35"
          y2="1"
          gradientUnits="objectBoundingBox"
        >
          {GOAT_METAAL_VERLOOP.map(([offset, kleur]) => (
            <stop key={offset} offset={offset} stopColor={kleur} />
          ))}
        </linearGradient>
        <g id="fut-orn-goat-helft">
          <FutStreng streng={GOAT_HOORN} ribbelBreedte={0.62} />
          <FutStreng streng={GOAT_BAARD_FLICK} ribbelBreedte={0.34} />
        </g>
        <g id="fut-orn-goat">
          {/* Het baardblad staat op de as en wordt dus niet gespiegeld; de
              nerven liggen erin, de flicks komen uit de gespiegelde helft. */}
          <path
            d={GOAT_BAARD_BLAD}
            fill="url(#fut-orn-metaal)"
            stroke={GOAT_METAAL_CONTOUR}
            strokeWidth="0.7"
            strokeLinejoin="round"
          />
          {GOAT_BAARD_NERVEN.map((d) => (
            <path
              key={d}
              d={d}
              fill="none"
              stroke={GOAT_METAAL_RIBBEL}
              strokeWidth="0.42"
              strokeLinecap="round"
            />
          ))}
          <use href="#fut-orn-goat-helft" />
          <use href="#fut-orn-goat-helft" transform="translate(100,0) scale(-1,1)" />
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
          <FutStreng streng={PIAS_LINT} verf={PIAS_STOF_VERF} />
          <path
            d={PIAS_LINT_HALS}
            fill="url(#fut-orn-pias-goud)"
            stroke={PIAS_GOUD_CONTOUR}
            strokeWidth="0.4"
          />
          <PiasBelletje bel={PIAS_LINT_BEL} />
          <FutStreng streng={PIAS_KAP_ZIJLOB} verf={PIAS_STOF_VERF} />
        </g>
        <g id="fut-orn-pias">
          <use href="#fut-orn-pias-helft" />
          <use href="#fut-orn-pias-helft" transform="translate(100,0) scale(-1,1)" />
          {/* De middenlob leunt bewust scheef en staat dus niet op de as: geen
              spiegeling, zoals het GOAT-baardblad. */}
          <FutStreng streng={PIAS_KAP_MIDDENLOB} verf={PIAS_STOF_VERF} />
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
  className,
  viewBox = "0 0 100 100",
  vullend = false,
}: {
  paden: readonly OrnamentPad[];
  kleur: string;
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
    >
      {paden.map((p) =>
        p.soort === "vlak" ? (
          <path key={p.d} d={p.d} fill={p.kleur ?? kleur} opacity={p.alpha} />
        ) : (
          <path
            key={p.d}
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
}: {
  tier: Tier | null;
  /** Speciale editie (#497/#625/#631/#632/#645): kleurt frame en vlak bóvenop
   *  de tier-klasse (icon = Big Daddy, kampioen = winnaar vorig kwartaal,
   *  inform = speler van de week, onfire = actieve winstreak, pias =
   *  anti-MVP van de week, piet = drager van de Zwarte Piet); de schildvorm
   *  blijft die van de divisie. Elke waarde heeft zijn eigen skin in
   *  FutKaart.css. */
  editie?: "icon" | "kampioen" | "inform" | "onfire" | "pias" | "piet" | null;
  omgedraaid?: boolean;
  /** Extra klasse op de wrapper (bv. "lineup-kaart" voor de veld-maat). */
  className?: string;
  /** Vlak-inhoud van de voorkant. */
  voor: ReactNode;
  /** Vlak-inhoud van de achterkant (gecentreerd stats-vlak). */
  achter?: ReactNode;
  voorOverlay?: ReactNode;
  achterOverlay?: ReactNode;
}) {
  const klassen = [
    "fut-kaart",
    tier ? `fut-kaart--${tier.key}` : "",
    editie ? `fut-kaart--${editie}` : "",
    omgedraaid ? "is-omgedraaid" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
  // Ornament (#710): de laag die buiten het schild uitsteekt, hangt aan de
  // tíer — een GOAT met In-Form houdt zijn hoorns. Een editie mét eigen
  // ornament wint daarvan, zoals de editie-skin ook het vlak wint: de pias
  // draagt zijn narrenkap en linten dus ook op een GOAT-drager.
  const ornament = editie === "pias" ? "pias" : tier?.key === "legende" ? "goat" : null;
  // Vóór-laag (#710, pias): het enige ornament dat óver de kaart ligt. Nodig
  // voor de kraag (die de kap in de bovenrand vastzet) en het maskermedaillon
  // op de punt — achter het schild zouden die onzichtbaar zijn.
  const ornamentVoor = editie === "pias";
  // Motief (#710): het watermerk ín het vlak hoort bij het vlak-register, dus
  // het GOAT-medaillon verdwijnt onder een editie-skin (het zou op het
  // In-Form-navy vloeken) terwijl de pias juist zijn éígen motief meebrengt.
  // Alleen de voorkant draagt het.
  const motief =
    editie === "pias" ? (
      <FutKaartMotief
        paden={PIAS_MOTIEF}
        kleur={PIAS_MOTIEF_INK}
        viewBox={PIAS_MOTIEF_VIEWBOX}
        vullend
      />
    ) : !editie && tier?.key === "legende" ? (
      <FutKaartMotief paden={GOAT_MEDAILLON} kleur={GOAT_MEDAILLON_KLEUR} />
    ) : null;
  return (
    <div className={klassen}>
      {ornament && (
        <svg
          className="fut-kaart__ornament"
          viewBox={ORNAMENT_VIEWBOX}
          aria-hidden="true"
        >
          <use href={`#fut-orn-${ornament}`} />
        </svg>
      )}
      <div className="fut-kaart__flipper">
        <div className="fut-kaart__zijde fut-kaart__zijde--voor">
          {voorOverlay}
          <span className="fut-kaart__liner">
            <span className="fut-kaart__keyline">
              <span className="fut-kaart__vlak">
                {motief}
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
                {achter}
              </span>
            </span>
          </span>
        </div>
      </div>
      {/* Ná de flipper, dus erbóven: de painting-order van positioned
          kinderen met z-index auto volgt de DOM. Blijft staan tijdens de flip —
          de achterkant draagt hetzelfde schild, dus kraag en medaillon vallen
          daar precies zo. */}
      {ornamentVoor && (
        <svg
          className="fut-kaart__ornament fut-kaart__ornament--voor"
          viewBox={ORNAMENT_VIEWBOX}
          aria-hidden="true"
        >
          <use href="#fut-orn-pias-voor" />
        </svg>
      )}
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
              {tier.emoji}
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
