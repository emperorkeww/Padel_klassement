// De Glazenwasser-kaart (#834): een divisiespecifieke kaart die de compositie van
// docs/fut-kaarten/referentie_glazenwasser.png reconstrueert op de kaarthoogte van de app.
//
// Dit is bewust géén variant van `FutKaart`. De referentie heeft een gebogen
// bovenrand, een portretcirkel van een derde kaartbreedte, een scheidingslijn op
// 43%, zes statistieken op één regel en een waterexplosie over de hele onderrand.
// In het gedeelde schild geperst verdwijnt precies dat. De gedeelde kaart blijft
// in gebruik waar hij klein wordt (klassement, opstelling, legenda); deze kaart is
// voor de plekken waar hij groot is: de kaart-modal en de dev-stage.
//
// Het artwork bestaat uit losse, strak bijgesneden onderdelen uit
// `scripts/glazenwasser-onderdelen.py` — elk met eigen alfa, zonder transparante
// rand. Alle geometrie staat in glazenwasserLayout.ts; dit bestand zet die
// fracties om in stijlen en de CSS doet alleen materiaal (kleur, bevel, schaduw).

import type { CSSProperties, ReactNode } from "react";
import { tierTitle, type Tier } from "@/features/rating/tiers";
import ring from "./assets/gw-ring.webp";
import waterBack from "./assets/gw-water-back.webp";
import glas from "./assets/gw-glas.webp";
import {
  GW_INHOUD,
  GW_LAGEN,
  gwSchildPad,
  laagVensterStijl,
  naarKaartY,
  type GwBron,
  type GwLaag,
} from "./glazenwasserLayout";
import type { GlazenwasserStat } from "./glazenwasserStats";
import "./GlazenwasserKaart.css";

/** De losse onderdelen. Eén plek waar een sleutel aan een bestand hangt. */
const GW_BRONNEN: Record<GwBron, string> = {
  ring,
  "water-back": waterBack,
  glas,
};

/** Fractie van de kaartbreedte als CSS-lengte. Eén helper, zodat geen enkele maat
 *  in dit bestand een pixelwaarde wordt. */
const kw = (fractie: number) => `calc(var(--gw-kw) * ${fractie})`;
const pct = (fractie: number) => `${fractie * 100}%`;

/** De schildclip. Eén keer per pagina renderen; dubbel is onschadelijk maar
 *  onnodig — zelfde afspraak als `FutKaartDefs`. */
export function GlazenwasserKaartDefs() {
  return (
    <svg width="0" height="0" className="gw-kaart__defs" aria-hidden="true">
      <defs>
        <clipPath id="gw-schild" clipPathUnits="objectBoundingBox">
          <path d={gwSchildPad()} />
        </clipPath>
      </defs>
    </svg>
  );
}

/** Eén artworklaag: één onderdeel op zijn eigen plek. Het vult zijn venster
 *  volledig en venster en asset hebben dezelfde verhouding, dus er wordt nooit
 *  iets uitgerekt. */
function Laag({ laag }: { laag: GwLaag }) {
  // Materiaal in plaats van voorwerp: een herhalende textuur die het vlak vult.
  // De maten staan in de CSS — twee lagen met een verschillende korrel, zodat
  // het oog de herhaling niet oppikt (zie GlazenwasserKaart.css).
  if (laag.tegel) {
    const bron = `url(${GW_BRONNEN[laag.bron]})`;
    return (
      <span
        className="gw-kaart__laag"
        data-laag={laag.naam}
        style={
          {
            ...laagVensterStijl(laag),
            backgroundImage: `${bron}, ${bron}`,
          } as CSSProperties
        }
        aria-hidden="true"
      />
    );
  }

  return (
    <span
      className="gw-kaart__laag"
      data-laag={laag.naam}
      style={laagVensterStijl(laag) as CSSProperties}
      aria-hidden="true"
    >
      {/* Contactschaduw: dezelfde vorm, zwart en geblurd, een fractie lager. Die
          fuseert het onderdeel met de lijst eronder. */}
      {laag.schaduw && (
        <img
          className="gw-kaart__laag-schaduw"
          src={GW_BRONNEN[laag.bron]}
          alt=""
          draggable={false}
          aria-hidden="true"
          style={{
            filter: `brightness(0) blur(${kw(laag.schaduw)})`,
            transform: `translate(${kw(-laag.schaduw * 0.25)}, ${kw(
              laag.schaduw * 0.5,
            )})`,
          }}
        />
      )}
      <img
        src={GW_BRONNEN[laag.bron]}
        alt=""
        draggable={false}
        decoding="sync"
        loading="eager"
      />
    </span>
  );
}

export function GlazenwasserKaart({
  elo,
  tier,
  naam,
  avatar,
  stats,
  className,
}: {
  elo: number | null;
  tier: Tier | null;
  naam: string;
  /** De echte avatar van de speler (foto of initialen). De kaart geeft hem zijn
   *  maat en dubbele glasring; de fallback krijgt exact dezelfde cirkel. */
  avatar: ReactNode;
  /** De zes kolommen uit `glazenwasserStats`. */
  stats: readonly GlazenwasserStat[];
  className?: string;
}) {
  const geclipt = GW_LAGEN.filter((l) => l.clip);
  const vrij = GW_LAGEN.filter((l) => !l.clip);
  const {
    ratinggroep,
    portret,
    scheiding,
    naam: naamPos,
    divisie,
    stats: statsPos,
  } = GW_INHOUD;

  return (
    <div className={`gw-kaart${className ? ` ${className}` : ""}`}>
      <div className="gw-kaart__stage">
        <span className="gw-kaart__waas" aria-hidden="true" />

        {/* Lijst en glasvlak: vijf keer dezelfde schildclip met een eigen padding
            en een eigen materiaal. De rand is dus het zichtbare verschil tussen
            opeenvolgende geclipte vlakken — een CSS-border kan die bocht niet
            volgen, en één vlakke omtrek leest niet als een gefabriceerde lijst. */}
        <div className="gw-kaart__schild">
          <span className="gw-kaart__bevel">
            <span className="gw-kaart__liner">
              <span className="gw-kaart__keyline">
                <span className="gw-kaart__vlak">
                  {/* Terug naar het coördinatenstelsel van de hele kaart, nadat
                      vier paddings naar binnen hebben genest. */}
                  <span className="gw-kaart__vlak-stage">
                    {geclipt.map((laag) => (
                      <Laag key={laag.naam} laag={laag} />
                    ))}
                  </span>
                </span>
              </span>
            </span>
          </span>
        </div>

        <div className="gw-kaart__inhoud">
          <div
            className="gw-kaart__ratinggroep"
            style={{
              left: pct(ratinggroep.left),
              top: pct(naarKaartY(ratinggroep.top)),
              width: pct(ratinggroep.breedte),
            }}
          >
            <span
              className="gw-kaart__rating"
              style={{ fontSize: kw(ratinggroep.ratingFont) }}
            >
              {elo ?? "—"}
            </span>
            {tier?.subLabel && (
              <span
                className="gw-kaart__subniveau"
                style={{
                  fontSize: kw(ratinggroep.subFont),
                  marginTop: kw(ratinggroep.subMarge),
                }}
              >
                {tier.subLabel}
              </span>
            )}
            {tier && (
              <span
                className="gw-kaart__raamicoon"
                style={{
                  fontSize: kw(ratinggroep.icoonFont),
                  marginTop: kw(ratinggroep.icoonMarge),
                }}
                title={tierTitle(tier)}
              >
                {tier.emoji}
              </span>
            )}
          </div>

          <span
            className="gw-kaart__scheiding"
            style={{
              left: pct(scheiding.left),
              top: pct(naarKaartY(scheiding.top)),
              width: pct(scheiding.breedte),
              height: kw(scheiding.dikte),
            }}
            aria-hidden="true"
          />

          <span
            className="gw-kaart__naam"
            style={{
              left: pct(naamPos.left),
              width: pct(naamPos.breedte),
              top: pct(naarKaartY(naamPos.top)),
              fontSize: kw(naamPos.font),
            }}
          >
            {naam}
          </span>

          {tier && (
            <span
              className="gw-kaart__divisie"
              style={{
                top: pct(naarKaartY(divisie.top)),
                fontSize: kw(divisie.font),
              }}
            >
              <span
                className="gw-kaart__divisie-lijn"
                style={{ width: pct(divisie.lijn) }}
                aria-hidden="true"
              />
              <span
                className="gw-kaart__divisie-tekst"
                style={{ transform: `scaleX(${divisie.smal})` }}
              >
                GLAZENWASSER
              </span>
              <span
                className="gw-kaart__divisie-lijn"
                style={{ width: pct(divisie.lijn) }}
                aria-hidden="true"
              />
            </span>
          )}

          <div
            className="gw-kaart__stats"
            style={{
              left: pct(statsPos.left),
              width: pct(statsPos.breedte),
              top: pct(naarKaartY(statsPos.top)),
            }}
          >
            {stats.map((stat) => (
              <span
                className="gw-kaart__stat"
                key={stat.label}
                title={stat.uitleg}
              >
                <span
                  className="gw-kaart__stat-label"
                  style={{
                    fontSize: kw(statsPos.labelFont),
                    transform: `scaleX(${statsPos.labelSmal})`,
                  }}
                >
                  {stat.label}
                </span>
                <span
                  className="gw-kaart__stat-waarde"
                  style={{ fontSize: kw(statsPos.waardeFont) }}
                >
                  {stat.waarde}
                </span>
              </span>
            ))}
          </div>
        </div>

        <div
          className="gw-kaart__portret"
          style={
            {
              left: pct(portret.left),
              top: pct(naarKaartY(portret.top)),
              width: pct(portret.breedte),
              padding: pct(portret.blauw),
              "--gw-portret-wit": kw(portret.wit),
              "--gw-portret-maat": kw(portret.breedte),
            } as CSSProperties
          }
        >
          {avatar}
        </div>

        {vrij.map((laag) => (
          <Laag key={laag.naam} laag={laag} />
        ))}
      </div>
    </div>
  );
}

/** Het informatieblok onder de kaart: raamicoon, divisienaam, ratingbereik en de
 *  omschrijving. Bewust een eigen element buiten de kaartcontainer — in de
 *  referentie staat het ónder het schild, niet erin. */
export function GlazenwasserInfo({
  tier,
  bereik,
}: {
  tier: Tier;
  /** Ratingbereik als tekst, bv. "1100–1199". */
  bereik: string;
}) {
  return (
    <div className="gw-info">
      <p className="gw-info__kop">
        <span className="gw-info__icoon" aria-hidden="true">
          {tier.emoji}
        </span>
        {tier.naam}
      </p>
      <p className="gw-info__bereik">Rating {bereik}</p>
      <p className="gw-info__flavor">{tier.flavor}</p>
    </div>
  );
}

export default GlazenwasserKaart;
