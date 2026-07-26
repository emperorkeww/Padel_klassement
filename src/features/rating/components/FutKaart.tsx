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
  PIET_WATERMERK_KLEUR,
  PIET_ZEGEL_BREUK,
  PIET_ZEGEL_DRAAD,
  PIET_ZEGEL_GRAVURE,
  PIET_ZEGEL_HELFT_LINKS,
  PIET_ZEGEL_HELFT_RECHTS,
  PIET_ZEGEL_SCHIJF,
  PIET_ZEGEL_STUKKEN,
} from "./ornamentenPiet";
import "./FutKaart.css";

/** Schildvormen: vier clipPaths met exact dezelfde onderkant (de punt op
 *  50%/100% blijft het chemielijn-anker in de Opstelling) en een bovenrand
 *  die oploopt met de divisiegroep — vlak, kroon-notch, spitse vleugels,
 *  kroon-crest. FutKaart.css kiest per tier via de --schild-variabele.
 *  objectBoundingBox laat de paden meeschalen met elke kaartbreedte.
 *  Eén keer renderen per pagina; dubbel renderen is onschadelijk (identieke
 *  defs), maar onnodig. */
/** Eén getaperde metaalstreng (#710): gevulde omtrek met contour, dwarsribbels
 *  en glanslijn. De vorm komt uit `bouwStreng` in futKaartOrnamenten.ts, dus
 *  DOM en canvas tekenen letterlijk dezelfde paden. */
function FutStreng({
  streng,
  ribbelBreedte = 0.4,
}: {
  streng: Streng;
  ribbelBreedte?: number;
}) {
  return (
    <>
      <path
        d={streng.omtrek}
        fill="url(#fut-orn-metaal)"
        stroke={GOAT_METAAL_CONTOUR}
        strokeWidth="0.7"
        strokeLinejoin="round"
      />
      {streng.ribbelGlans.map((d) => (
        <path
          key={d}
          d={d}
          fill="none"
          stroke={GOAT_METAAL_RIBBELGLANS}
          strokeWidth={ribbelBreedte}
          strokeLinecap="round"
        />
      ))}
      {streng.ribbels.map((d) => (
        <path
          key={d}
          d={d}
          fill="none"
          stroke={GOAT_METAAL_RIBBEL}
          strokeWidth={ribbelBreedte}
          strokeLinecap="round"
        />
      ))}
      <path
        d={streng.schaduw}
        fill="none"
        stroke={GOAT_METAAL_SCHADUW}
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path
        d={streng.highlight}
        fill="none"
        stroke={GOAT_METAAL_GLANS}
        strokeWidth="0.9"
        strokeLinecap="round"
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
  className,
}: {
  paden: readonly OrnamentPad[];
  kleur: string;
  className?: string;
}) {
  return (
    <svg
      className={`fut-kaart__motief${className ? ` ${className}` : ""}`}
      viewBox="0 0 100 100"
      aria-hidden="true"
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
  // Ornament (#710): de laag die buiten het schild uitsteekt. Het tier-ornament
  // hangt aan de tíer — een GOAT met In-Form houdt zijn hoorns — maar een
  // editie met eigen ornament wint, zoals de editie-skin ook het vlak wint:
  // de Piet ís het ornament (kettingen, zegel), die hoort niet bij een divisie.
  const ornament: { achter: string; voor?: string } | null =
    editie === "piet"
      ? { achter: "fut-orn-piet-achter", voor: "fut-orn-piet-voor" }
      : tier?.key === "legende"
        ? { achter: "fut-orn-goat" }
        : null;
  // Motief (#710): het watermerk ín het vlak hoort bij het vlak-register. Het
  // GOAT-medaillon verdwijnt dus onder een editie-skin (het zou op het
  // In-Form-navy vloeken); het Piet-watermerk hóórt bij de editie-skin en komt
  // er juist mee. Alleen de voorkant draagt een motief.
  const motief =
    editie === "piet" ? (
      <FutKaartMotief paden={PIET_WATERMERK} kleur={PIET_WATERMERK_KLEUR} />
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
          <use href={`#${ornament.achter}`} />
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
      {ornament?.voor && (
        <svg
          className="fut-kaart__ornament fut-kaart__ornament--voor"
          viewBox={ORNAMENT_VIEWBOX}
          aria-hidden="true"
        >
          <use href={`#${ornament.voor}`} />
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
