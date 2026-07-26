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
  DICTATOR_EPAULET,
  DICTATOR_EPAULET_FRANJE,
  DICTATOR_GEM,
  DICTATOR_GEMS,
  DICTATOR_GEM_GLANS,
  DICTATOR_GOUD_CONTOUR,
  DICTATOR_GOUD_GLANS,
  DICTATOR_GOUD_VERLOOP,
  DICTATOR_KROON,
  DICTATOR_KROON_BAND,
  DICTATOR_KROON_BOLLEN,
  DICTATOR_LAUWER_BLADEN,
  DICTATOR_LAUWER_STENGEL,
  DICTATOR_WATERMARK,
  DICTATOR_WATERMARK_BREEDTE,
  DICTATOR_WATERMARK_KLEUR,
  DICTATOR_WATERMARK_POSITIE,
  DICTATOR_ZEGEL,
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
  INFORM_VIN,
} from "./ornamentenInform";
import "./FutKaart.css";

/** Schildvormen: vier clipPaths met exact dezelfde onderkant (de punt op
 *  50%/100% blijft het chemielijn-anker in de Opstelling) en een bovenrand
 *  die oploopt met de divisiegroep — vlak, kroon-notch, spitse vleugels,
 *  kroon-crest. FutKaart.css kiest per tier via de --schild-variabele.
 *  objectBoundingBox laat de paden meeschalen met elke kaartbreedte.
 *  Eén keer renderen per pagina; dubbel renderen is onschadelijk (identieke
 *  defs), maar onnodig. */
/** Metaalpalet van één ornamentfamilie: welke gradient-def de vulling levert en
 *  welke lijnkleuren het reliëf maken. Zo delen de rosé GOAT-hoorns en de
 *  champagne In-Form-vinnen (#710) één renderer i.p.v. twee bijna-gelijke
 *  copieën. Canvas-spiegel: het `StrengPalet` in futKaartCanvas.ts. */
interface StrengPalet {
  verloop: string;
  contour: string;
  ribbel: string;
  ribbelGlans: string;
  schaduw: string;
  glans: string;
}
const GOAT_PALET: StrengPalet = {
  verloop: "url(#fut-orn-metaal)",
  contour: GOAT_METAAL_CONTOUR,
  ribbel: GOAT_METAAL_RIBBEL,
  ribbelGlans: GOAT_METAAL_RIBBELGLANS,
  schaduw: GOAT_METAAL_SCHADUW,
  glans: GOAT_METAAL_GLANS,
};
const INFORM_PALET: StrengPalet = {
  verloop: "url(#fut-orn-inform-goud)",
  contour: INFORM_GOUD_CONTOUR,
  ribbel: INFORM_GOUD_GROEF,
  ribbelGlans: INFORM_GOUD_GLANS,
  schaduw: INFORM_GOUD_SCHADUW,
  glans: INFORM_GOUD_GLANS,
};

/** Eén getaperde metaalstreng (#710): gevulde omtrek met contour, dwarsribbels
 *  en glanslijn. De vorm komt uit `bouwStreng` in futKaartOrnamenten.ts, dus
 *  DOM en canvas tekenen letterlijk dezelfde paden. */
function FutStreng({
  streng,
  ribbelBreedte = 0.4,
  palet = GOAT_PALET,
}: {
  streng: Streng;
  ribbelBreedte?: number;
  palet?: StrengPalet;
}) {
  return (
    <>
      <path
        d={streng.omtrek}
        fill={palet.verloop}
        stroke={palet.contour}
        strokeWidth="0.7"
        strokeLinejoin="round"
      />
      {streng.ribbelGlans.map((d) => (
        <path
          key={d}
          d={d}
          fill="none"
          stroke={palet.ribbelGlans}
          strokeWidth={ribbelBreedte}
          strokeLinecap="round"
        />
      ))}
      {streng.ribbels.map((d) => (
        <path
          key={d}
          d={d}
          fill="none"
          stroke={palet.ribbel}
          strokeWidth={ribbelBreedte}
          strokeLinecap="round"
        />
      ))}
      <path
        d={streng.schaduw}
        fill="none"
        stroke={palet.schaduw}
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path
        d={streng.highlight}
        fill="none"
        stroke={palet.glans}
        strokeWidth="0.9"
        strokeLinecap="round"
      />
    </>
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
          <FutGoud d={DICTATOR_KROON_BAND} />
          <FutGoud d={DICTATOR_KROON} />
          {DICTATOR_KROON_BOLLEN.map(([cx, cy, r]) => (
            <g key={`${cx}-${cy}`}>
              <circle
                cx={cx}
                cy={cy}
                r={r}
                fill="url(#fut-orn-goud)"
                stroke={DICTATOR_GOUD_CONTOUR}
                strokeWidth="0.5"
              />
              {cx !== 50 && (
                <circle
                  cx={100 - cx}
                  cy={cy}
                  r={r}
                  fill="url(#fut-orn-goud)"
                  stroke={DICTATOR_GOUD_CONTOUR}
                  strokeWidth="0.5"
                />
              )}
            </g>
          ))}
          {DICTATOR_GEMS.map((d) => (
            <g key={d}>
              <path d={d} fill={DICTATOR_GEM} stroke={DICTATOR_GOUD_CONTOUR} strokeWidth="0.4" />
              <path
                d={d}
                fill="none"
                stroke={DICTATOR_GEM_GLANS}
                strokeWidth="0.3"
                transform="translate(100,0) scale(-1,1)"
              />
            </g>
          ))}
          <g transform="translate(100,0) scale(-1,1)">
            {DICTATOR_GEMS.map((d) => (
              <path key={d} d={d} fill={DICTATOR_GEM} stroke={DICTATOR_GOUD_CONTOUR} strokeWidth="0.4" />
            ))}
          </g>
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
        </g>
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
          <FutStreng streng={INFORM_VIN} ribbelBreedte={0.62} palet={INFORM_PALET} />
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
}: {
  paden: readonly OrnamentPad[];
  kleur: string;
  /** Breedte als fractie van het vlak (CSS --motief-b, default 0.92). */
  breedte?: number;
  /** Verticale plaatsing als background-position-fractie (--motief-pos). */
  positie?: number;
}) {
  return (
    <svg
      className="fut-kaart__motief"
      viewBox="0 0 100 100"
      aria-hidden="true"
      style={{
        ...(breedte != null ? { ["--motief-b" as string]: breedte * 100 } : {}),
        ...(positie != null
          ? { ["--motief-pos" as string]: `${positie * 100}%` }
          : {}),
      }}
    >
      {paden.map((p) =>
        p.soort === "vlak" ? (
          <path key={p.d} d={p.d} fill={kleur} opacity={p.alpha} />
        ) : (
          <path
            key={p.d}
            d={p.d}
            fill="none"
            stroke={kleur}
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

/** Ornamentlaag per kaart. **De regel** (vastgelegd bij #710): een editie mét
 *  eigen ornament wint van het tier-ornament, precies zoals de editie-skin het
 *  vlak van de tier wint — in de CSS staat het editie-blok ná het toptier-blok
 *  met gelijke specificiteit. Een GOAT-in-vorm draagt dus de In-Form-bliksem
 *  en niet zijn hoorns: de editie is het nieuws van deze week, het monument is
 *  de constante. Edities zónder eigen ornament (icon, kampioen, onfire, pias,
 *  piet) laten de hoorns of de kroon juist staan; dáár is de editie alleen een
 *  hertinting.
 *
 *  Canvas-spiegel: dezelfde tabellen in kaartSkin() (futKaartCanvas.ts). */
const EDITIE_ORNAMENT: Partial<Record<FutEditie, FutOrnament>> = {
  inform: "inform",
};
const TIER_ORNAMENT: Partial<Record<string, FutOrnament>> = {
  legende: "goat",
  dictator: "dictator",
};
/** Ornamenten met óók een laag vóór de kaart (lauwerkrans/lakzegel bij El
 *  Padelissimo, bliksemmedaillon bij In-Form). */
const VOOR_ORNAMENTEN: readonly FutOrnament[] = ["dictator", "inform"];

function ornamentVoor(
  tierKey: string | undefined,
  editie: FutEditie | null,
): FutOrnament | null {
  return (
    (editie ? EDITIE_ORNAMENT[editie] : undefined) ??
    (tierKey ? TIER_ORNAMENT[tierKey] : undefined) ??
    null
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
  const ornament = ornamentVoor(tier?.key, editie);
  // Motief (#710): het watermerk ín het vlak hoort bij het vlak-register, dus
  // het volgt de skin — een editie overschrijft het vlak en daarmee ook het
  // tier-motief (het GOAT-medaillon zou op het In-Form-navy vloeken). Nieuw
  // sinds deze PR: een editie mág een eigen motief meebrengen. In-Form doet
  // dat met zijn pulse-ring en snelheidslijnen; de andere vijf edities laten
  // het vlak leeg. Alleen de voorkant draagt het motief.
  const motief =
    editie === "inform" ? (
      <FutKaartMotief
        paden={INFORM_MOTIEF}
        kleur={INFORM_MOTIEF_KLEUR}
        breedte={INFORM_MOTIEF_BREEDTE}
        positie={INFORM_MOTIEF_POSITIE}
      />
    ) : editie ? null : tier?.key === "legende" ? (
      <FutKaartMotief paden={GOAT_MEDAILLON} kleur={GOAT_MEDAILLON_KLEUR} />
    ) : tier?.key === "dictator" ? (
      <FutKaartMotief
        paden={DICTATOR_WATERMARK}
        kleur={DICTATOR_WATERMARK_KLEUR}
        breedte={DICTATOR_WATERMARK_BREEDTE}
        positie={DICTATOR_WATERMARK_POSITIE}
      />
    ) : null;
  return (
    <div className={klassen}>
      {ornament && (
        <svg
          className="fut-kaart__ornament"
          viewBox={ORNAMENT_VIEWBOX}
          aria-hidden="true"
        >
          <use
            href={`#fut-orn-${
              VOOR_ORNAMENTEN.includes(ornament)
                ? `${ornament}-achter`
                : ornament
            }`}
          />
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
      {/* Vóór-laag (#710): El Padelissimo (lauwerkransen langs de zijkanten,
          lakzegel in de punt) en In-Form (bliksemmedaillon in de punt) hebben
          ornamenten die over de kaart heen liggen — de laagvolgorde uit de
          referentie-instructies. Ze staan in de lege punt en de marge van het
          vlak, dus ze dekken geen tekst af, en de laag is pointer-events: none
          zodat de flip-knop bereikbaar blijft. */}
      {ornament && VOOR_ORNAMENTEN.includes(ornament) && (
        <svg
          className="fut-kaart__ornament fut-kaart__ornament--voor"
          viewBox={ORNAMENT_VIEWBOX}
          aria-hidden="true"
        >
          <use href={`#fut-orn-${ornament}-voor`} />
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
