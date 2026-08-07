import { useState, type Dispatch, type SetStateAction } from "react";
import { PageTabs, TabPanel } from "@/ui/PageTabs";
import { Sheet } from "@/ui/Sheet";
import { tap } from "@/lib/utils/haptics";
import {
  banen,
  beschrijving,
  ctaLabel,
  klemRondes,
  reserves,
  rondes,
  RONDES_MAX,
  RONDES_MIN,
  type Speelvorm,
} from "@/features/groups/speelformaat";
import "@/components/ui/ScoreStepper.css";
import "./SpeelformaatKaart.css";

// "Speelformaat" — de keuze tussen Eerlijk, Americano en Mexicano (#1089).
//
// Stond hiervoor als drie tabs in de kop van de generatorkaart, met een losse
// alinea eronder: je koos een vorm zonder te zien wat die vorm met jouw groep
// zou dóen. Nu is het een eigen paneel dat de belofte compleet maakt — hoeveel
// spelers, hoeveel banen, hoeveel rondes — met één knop eronder.
//
// De getallen komen uit speelformaat.ts, dezelfde rekensom als de generator.
// Een meta-rij die iets anders belooft dan de knop levert is erger dan geen
// meta-rij.
//
// Het paneel is bewust omgekeerd (--paneel-om): dit is de knop waar de hele
// avond aan hangt, en die hoort niet als vierde witte kaart in de rij te staan.

const VORMEN: { id: Speelvorm; label: string }[] = [
  { id: "eerlijk", label: "Eerlijk" },
  { id: "americano", label: "Americano" },
  { id: "mexicano", label: "Mexicano" },
];

export function SpeelformaatKaart({
  vorm,
  onVorm,
  aanwezig,
  americanoRondes,
  onAmericanoRondes,
  bezig,
  blokkade,
  onStart,
}: {
  vorm: Speelvorm;
  onVorm: (v: Speelvorm) => void;
  /** Aantal aangevinkte spelers — voedt de beschrijving en de meta-rij. */
  aanwezig: number;
  americanoRondes: number;
  /** Een state-setter, geen kale callback: de stappers rekenen vanuit de vorige
   *  waarde. Twee tikken vlak na elkaar landen anders in dezelfde render en
   *  lezen allebei hetzelfde getal, waarna er één verhoging verdwijnt. */
  onAmericanoRondes: Dispatch<SetStateAction<number>>;
  bezig: boolean;
  /** Reden waarom starten nu niet kan, of null. Blokkeert ook de knop. */
  blokkade: string | null;
  onStart: () => void;
}) {
  const [uitlegOpen, setUitlegOpen] = useState(false);
  const bank = reserves(aanwezig);

  return (
    <section className="paneel-om speelvorm" aria-labelledby="speelvorm-titel">
      <div className="speelvorm__kop">
        <h2 className="speelvorm__titel" id="speelvorm-titel">
          Speelformaat
        </h2>
        {/* De badge houdt zijn ruimte vast en fade't alleen weg, anders
            verspringt de titelrij bij elke tabwissel. */}
        <span
          className="speelvorm__badge"
          data-aan={vorm === "eerlijk" ? "ja" : "nee"}
          aria-hidden={vorm !== "eerlijk"}
        >
          Aanbevolen
        </span>
      </div>

      <PageTabs
        variant="segment"
        tabs={VORMEN}
        value={vorm}
        onChange={onVorm}
        ariaLabel="Speelformaat"
        idPrefix="speelvorm"
      />

      <TabPanel id={vorm} idPrefix="speelvorm">
        <p className="speelvorm__uitleg">{beschrijving(vorm, aanwezig)}</p>

        <dl className="speelvorm__meta">
          <div>
            <dt>Spelers</dt>
            <dd>
              {aanwezig} aan
              {bank > 0 && (
                <span className="speelvorm__bank">
                  {" "}
                  · {bank} op de bank
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt>Banen</dt>
            <dd>{banen(aanwezig)}</dd>
          </div>
          <div>
            <dt>Rondes</dt>
            <dd>{rondes(vorm, americanoRondes)}</dd>
          </div>
        </dl>

        {/* De rondekeuze stond eerst als select ín de meta-rij hierboven. Daar
            was hij onvindbaar: tussen twee vette uitkomsten leest een klein
            keuzevakje als nóg een uitkomst, niet als iets wat je kunt zetten.
            Nu een eigen regel met dezelfde ±-stappers als de score-invoer, en
            het aantal staat ook in de knop.
            Alleen bij Americano: Mexicano deelt per ronde in op de laatste
            stand en kan er dus maar één tegelijk, en bij Eerlijk staan de teams
            vast — meer rondes zou daar hetzelfde duo herhalen. */}
        {vorm === "americano" && (
          <div className="speelvorm__keuzerij">
            <label className="speelvorm__keuzelabel" htmlFor="speelvorm-rondes">
              Hoeveel rondes?
            </label>
            <span className="stepper">
              <button
                type="button"
                className="stepper__btn"
                aria-label="Eén ronde minder"
                disabled={americanoRondes <= RONDES_MIN}
                onClick={() => {
                  tap();
                  onAmericanoRondes((n) => klemRondes(n - 1));
                }}
              >
                −
              </button>
              <input
                id="speelvorm-rondes"
                className="input input--score"
                type="number"
                inputMode="numeric"
                min={RONDES_MIN}
                max={RONDES_MAX}
                value={americanoRondes}
                onChange={(e) =>
                  onAmericanoRondes(klemRondes(Number(e.target.value)))
                }
              />
              <button
                type="button"
                className="stepper__btn"
                aria-label="Eén ronde meer"
                disabled={americanoRondes >= RONDES_MAX}
                onClick={() => {
                  tap();
                  onAmericanoRondes((n) => klemRondes(n + 1));
                }}
              >
                +
              </button>
            </span>
          </div>
        )}

        {blokkade && <p className="speelvorm__waarschuwing">{blokkade}</p>}

        <button
          type="button"
          className="speelvorm__cta"
          disabled={bezig || !!blokkade}
          onClick={() => {
            tap();
            onStart();
          }}
        >
          {bezig ? "Bezig…" : ctaLabel(vorm, americanoRondes)}
        </button>
      </TabPanel>

      <button
        type="button"
        className="speelvorm__verschil"
        onClick={() => setUitlegOpen(true)}
      >
        <span className="speelvorm__vraag" aria-hidden="true">
          ?
        </span>
        Eerlijk, Americano of Mexicano — wat is het verschil?
      </button>

      <Sheet
        open={uitlegOpen}
        onClose={() => setUitlegOpen(false)}
        title="Eerlijk, Americano of Mexicano?"
      >
        <SpelvormUitleg />
      </Sheet>
    </section>
  );
}

/** De inhoud achter "wat is het verschil?" — ongewijzigd meeverhuisd uit de
 *  generatorkaart, waar hij in een <details> zat. Een lade middenin de kaart
 *  duwde de rest omlaag zodra je 'm opende; als sheet legt hij zich ernáást. */
function SpelvormUitleg() {
  return (
    // .explainer__body is de bestaande opmaak van dit blok; alleen de <details>
    // eromheen is vervangen door de sheet.
    <div className="explainer__body">
      <dl>
      <div>
        <dt>Eerlijk</dt>
        <dd>
          Onze algoritmes puzzelen de meest <strong>evenwichtige duo's</strong>{" "}
          in elkaar op basis van jullie Elo. Sterk speelt met minder sterk, zodat
          elke match tot het einde spannend blijft. Je krijgt eerst een
          winstkans-prognose te zien voordat je de baan op gaat.
        </dd>
      </div>
      <div>
        <dt>Americano</dt>
        <dd>
          Iedereen wisselt constant door. De ideale mix-en-match vorm waarbij je
          elke ronde een <strong>nieuwe partner</strong> en andere tegenstanders
          treft. Geen tactisch gedoe met Elo of ranking, gewoon een ontspannen
          avond waarin je met iedereen een balletje slaat.
        </dd>
      </div>
      <div>
        <dt>Mexicano</dt>
        <dd>
          De stand bepaalt je lot. De ranglijst wordt na elke ronde opgemaakt, en
          per baan speelt de <strong>top met de subtop</strong> (1 met 4 tegen 2
          met 3). Hoe beter je presteert, hoe sterker je tegenstanders. Zorg dat
          alle uitslagen binnen zijn voor je de volgende ronde start!
        </dd>
      </div>
      </dl>
    </div>
  );
}

export default SpeelformaatKaart;
