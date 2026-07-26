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
import "./FutKaart.css";

/** Schildvormen: vier clipPaths met exact dezelfde onderkant (de punt op
 *  50%/100% blijft het chemielijn-anker in de Opstelling) en een bovenrand
 *  die oploopt met de divisiegroep — vlak, kroon-notch, spitse vleugels,
 *  kroon-crest. FutKaart.css kiest per tier via de --schild-variabele.
 *  objectBoundingBox laat de paden meeschalen met elke kaartbreedte.
 *  Eén keer renderen per pagina; dubbel renderen is onschadelijk (identieke
 *  defs), maar onnodig. */
/** Het materiaal van een streng: één vulling plus de vier lijnkleuren die hem
 *  rondte geven. Sinds #710 PR 3 draaien er twee materialen op dezelfde
 *  generator (rosé metaal voor de GOAT, smaragden loof voor de Kampioen), dus
 *  staat het losgekoppeld van de vorm. */
interface StrengMateriaal {
  /** SVG-paint voor de omtrek: bij beide een gradient-verwijzing. */
  vulling: string;
  contour: string;
  glans: string;
  schaduw: string;
  ribbel: string;
  ribbelGlans: string;
}

const GOAT_MATERIAAL: StrengMateriaal = {
  vulling: "url(#fut-orn-metaal)",
  contour: GOAT_METAAL_CONTOUR,
  glans: GOAT_METAAL_GLANS,
  schaduw: GOAT_METAAL_SCHADUW,
  ribbel: GOAT_METAAL_RIBBEL,
  ribbelGlans: GOAT_METAAL_RIBBELGLANS,
};

const KAMPIOEN_LOOF_MATERIAAL: StrengMateriaal = {
  vulling: "url(#fut-orn-kampioen-loof)",
  contour: KAMPIOEN_LOOF_CONTOUR,
  glans: KAMPIOEN_LOOF_GLANS,
  schaduw: KAMPIOEN_LOOF_SCHADUW,
  ribbel: KAMPIOEN_LOOF_NERF,
  ribbelGlans: KAMPIOEN_LOOF_GLANS,
};

/** Eén getaperde streng (#710): gevulde omtrek met contour, dwarsribbels en
 *  glanslijn. De vorm komt uit `bouwStreng` in futKaartOrnamenten.ts, dus DOM
 *  en canvas tekenen letterlijk dezelfde paden. */
function FutStreng({
  streng,
  ribbelBreedte = 0.4,
  materiaal = GOAT_MATERIAAL,
}: {
  streng: Streng;
  ribbelBreedte?: number;
  materiaal?: StrengMateriaal;
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
        />
      ))}
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
        <g id="fut-orn-kampioen">
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
        <g id="fut-orn-kampioen-crest">
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
  // Ornament (#710): de laag die buiten het schild uitsteekt hangt aan de
  // tíer — een GOAT met In-Form houdt zijn hoorns. Een editie mét eigen
  // ornament wint dáárvan, zoals de editie-skin ook het vlak wint: de
  // Kampioen ruilt de bokhoorns dus in voor zijn lauwerkrans.
  const ornament =
    editie === "kampioen" ? "kampioen" : tier?.key === "legende" ? "goat" : null;
  // Voorste ornamentlaag (#710): alleen de diamantcrest hoort vóór de kaart
  // (laagvolgorde 8 van #710) — hij hangt met zijn punt bóven de bovenrand en
  // zakt met zijn onderpunt in de inkeping, dus achter het schild zou hij
  // half verdwijnen. Alle andere ornamenten blijven erachter.
  const crest = editie === "kampioen";
  // Motief (#710): het watermerk ín het vlak hoort bij het vlak-register. Het
  // GOAT-medaillon verdwijnt daarom onder een editie-skin (het zou op het
  // In-Form-navy vloeken); het legacy-zegel van de Kampioen komt juist mét de
  // editie mee. Alleen de voorkant draagt een motief.
  const motief =
    editie === "kampioen" ? (
      <FutKaartMotief paden={KAMPIOEN_ZEGEL} kleur={KAMPIOEN_ZEGEL_KLEUR} />
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
      {crest && (
        <svg
          className="fut-kaart__ornament fut-kaart__ornament--voor"
          viewBox={ORNAMENT_VIEWBOX}
          aria-hidden="true"
        >
          <use href="#fut-orn-kampioen-crest" />
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
