import { useState } from "react";
import { Avatar } from "@/ui/Avatar";
import { Aankondiging } from "@/ui/Aankondiging";
import { PageTabs, TabPanel } from "@/ui/PageTabs";
import { tap } from "@/lib/utils/haptics";
import {
  afwezigLabel,
  zichtbareSpelers,
  type KiesbareSpeler,
  type KiezerFilter,
} from "@/features/groups/spelersKiezer";
import type { Profile } from "@/types";
import "./SpelersKiezer.css";

// "Wie speelt er mee?" — de deelnemersselectie van de speeldag (#1089).
//
// Hiervóór was dit een platte rij pillen met álle groepsleden: geen teller,
// geen zoekveld, geen manier om te zien wie eruit lag. Bij een groep van
// twintig las dat als een muur, en de enige manier om te controleren of je
// niemand vergeten was, was ze allemaal langslopen.
//
// De kaart beantwoordt nu drie vragen tegelijk: hoevéél er meedoen (teller +
// balk), wie je zoekt (zoekveld + filtertabs) en wie er níét bij is (de voet).
// Alle afgeleide waarden komen uit één bron — de `gekozen`-set van de parent —
// zodat een tik op een chip overal tegelijk doorwerkt.
//
// Puur presentatie: de selectie zelf leeft bij de parent, want die schrijft
// hem ook weg naar de generator. Wat hier wél lokaal blijft is de zoekterm en
// de filtertab: dat is hoe je naar de lijst kíjkt, niet wat je erover besluit.

const FILTERS: { id: KiezerFilter; label: string }[] = [
  { id: "alles", label: "Iedereen" },
  { id: "aan", label: "Aanwezig" },
  { id: "uit", label: "Afwezig" },
];

export function SpelersKiezer({
  spelers,
  profielen,
  gekozen,
  moment,
  herkomst,
  onToggle,
  onAlles,
  onHerstel,
}: {
  /** Alle kiesbare spelers, in de volgorde waarin ze getoond worden. */
  spelers: KiesbareSpeler[];
  /** Profielen per speler-id — voor de foto of de initialen in de chip. */
  profielen: Record<string, Profile>;
  /** Wie er aan staat. Speler-id's, niet namen: namen zijn niet uniek. */
  gekozen: ReadonlySet<string>;
  /** Starttijd van het moment ("20:00"), of null zonder speeldag-poll. */
  moment: string | null;
  /** Waar deze selectie vandaan komt (poll van vandaag, of alle leden). Staat
   *  niet in de handoff, maar het antwoord op "waarom staan déze namen aan?"
   *  hoort bij de lijst en nergens anders. */
  herkomst?: string | null;
  onToggle: (id: string) => void;
  /** Alles aan (`true`) of alles uit (`false`). */
  onAlles: (aan: boolean) => void;
  /** Zet iedereen weer op aanwezig. */
  onHerstel: () => void;
}) {
  const [zoek, setZoek] = useState("");
  const [filter, setFilter] = useState<KiezerFilter>("alles");

  const totaal = spelers.length;
  const afwezig = spelers.filter((s) => !gekozen.has(s.id));
  const aan = totaal - afwezig.length;
  const allesAan = totaal > 0 && afwezig.length === 0;
  const zichtbaar = zichtbareSpelers(spelers, { zoek, filter, gekozen });

  return (
    <section className="card kiezer" aria-labelledby="kiezer-titel">
      <div className="kiezer__kop">
        <div>
          <p className="kiezer__eyebrow">
            Vandaag{moment ? ` · ${moment}` : ""}
          </p>
          <h2 className="card__title kiezer__titel" id="kiezer-titel">
            Wie speelt er mee?
          </h2>
        </div>
        <p className="kiezer__teller">
          <span className="kiezer__teller-getal">{aan}</span>
          <span className="kiezer__teller-uit">van {totaal} aan</span>
        </p>
      </div>

      {/* Puur een visuele echo van de teller hierboven — die staat al als tekst
          in de kaart, dus een screenreader hoeft dit vlak niet nog eens. */}
      <div className="kiezer__balk" aria-hidden="true">
        <span
          className="kiezer__balk-vul"
          style={{ width: `${totaal === 0 ? 0 : (aan / totaal) * 100}%` }}
        />
      </div>

      <div className="kiezer__zoekrij">
        <label className="kiezer__zoek">
          <span className="sr-only">Zoek een naam</span>
          <input
            className="input"
            type="search"
            placeholder="Zoek een naam"
            value={zoek}
            onChange={(e) => setZoek(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="kiezer__alles"
          disabled={totaal === 0}
          onClick={() => {
            tap();
            onAlles(!allesAan);
          }}
        >
          {allesAan ? "Alles uit" : "Alles aan"}
        </button>
      </div>

      <PageTabs
        variant="segment"
        tabs={FILTERS.map((f) => ({
          ...f,
          count:
            f.id === "alles" ? totaal : f.id === "aan" ? aan : afwezig.length,
        }))}
        value={filter}
        onChange={setFilter}
        ariaLabel="Filter de spelers"
        idPrefix="kiezer"
      />

      {herkomst && <p className="kiezer__herkomst">{herkomst}</p>}

      <TabPanel id={filter} idPrefix="kiezer">
        {zichtbaar.length === 0 ? (
          <p className="kiezer__leeg">Geen spelers gevonden.</p>
        ) : (
          <div className="kiezer__chips">
            {zichtbaar.map((speler) => {
              const isAan = gekozen.has(speler.id);
              return (
                <button
                  key={speler.id}
                  type="button"
                  role="switch"
                  aria-checked={isAan}
                  className="kiezer__chip"
                  onClick={() => {
                    tap();
                    onToggle(speler.id);
                  }}
                >
                  {/* Naam expliciet mee: de tint volgt dan dezelfde tekst als
                      de chip toont, ook voor gasten zonder profiel. De foto
                      komt nog steeds uit het profiel als die er is. */}
                  <Avatar
                    profile={profielen[speler.id]}
                    name={speler.naam}
                    size={24}
                  />
                  <span className="kiezer__chip-naam">{speler.naam}</span>
                  {/* De markering herhaalt wat aria-checked al zegt, maar
                      visueel: kleur alleen zou het verschil tussen aan en uit
                      dragen, en dat mag nooit het enige signaal zijn. */}
                  <span className="kiezer__chip-merk" aria-hidden="true">
                    {isAan ? "✓" : "＋"}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </TabPanel>

      {/* Zoeken en filteren veranderen de lijst zonder dat de focus verspringt;
          zonder deze regel hoor je niet hoeveel er overblijft (#924). */}
      <Aankondiging
        sleutel={`${filter}|${zoek}`}
        bericht={
          zichtbaar.length === 1
            ? "1 speler gevonden"
            : `${zichtbaar.length} spelers gevonden`
        }
      />

      {afwezig.length > 0 && (
        <div className="kiezer__voet">
          <p className="kiezer__afwezig">
            Afwezig:{" "}
            <b>{afwezigLabel(afwezig.map((s) => s.naam))}</b>
          </p>
          <button
            type="button"
            className="kiezer__herstel"
            onClick={() => {
              tap();
              onHerstel();
            }}
          >
            Herstel
          </button>
        </div>
      )}
    </section>
  );
}

export default SpelersKiezer;
