// Kaartenlegenda (#763): wat betekenen de kaarten op de Kaarten-tab? De wand
// toont gouden frames, kroon-schilden en regels als "⚡ In-Form · +48" zonder
// ergens uit te leggen wat dat is of hoe je het krijgt; de Divisies-tab heeft
// zijn uitleg al (TierLegend, #127) en de enige plek met álle varianten naast
// elkaar was de dev-showcase op /dev/kaarten (#664).
//
// Alles komt uit dezelfde bron als de échte kaart — tierLegend/tierFor voor de
// divisies, EDITIE_PRIORITEIT + editieLabel/editieVoorwaarde voor de edities —
// zodat de legenda niet stil gaat liegen zodra een editie of skin verandert.
// De voorbeeldkaarten dragen de naam en avatar van de kijker zelf: "zo ziet
// jóuw kaart eruit als je hem verdient".

import { useState, type ReactNode } from "react";
import { Avatar } from "@/ui/Avatar";
import {
  FutKaart,
  FutKaartVoorkant,
} from "@/features/rating/components/FutKaart";
import { TIER_BANDEN, tierFor, tierLegend, type Tier } from "@/features/rating/tiers";
import type { Profile } from "@/types";
import {
  EDITIE_PRIORITEIT,
  editieLabel,
  editieVoorwaarde,
  type Editie,
  type EditieContext,
} from "../edities";
import "./KaartLegenda.css";

/** Rating waarop een divisie-voorbeeldkaart getekend wordt: net boven de
 *  ondergrens van de band, zodat elke divisie zichtbaar wordt met een
 *  sub-niveau erbij (zelfde truc als de dev-showcase). */
function voorbeeldRating(key: string): number {
  const band = TIER_BANDEN.find((b) => b.key === key);
  return (band?.min ?? 1000) + 50;
}

/** Neutrale middendivisie voor de editiekaarten: de editie-skin overschrijft
 *  frame, liner en vlak, dus de divisie eronder mag niet de aandacht trekken. */
const EDITIE_RATING = 1050;

/** De speler in de voorbeeld-context: geen echte id, alleen een sleutel om de
 *  labels mee op te bouwen. */
const IK = "legenda";

/** Lege context: `editieLabel` geeft dan de kale editienaam terug ("🏆
 *  Kampioen", "🔥 On Fire") zonder de voorbeeldwaarden. Dat is wat het kopje
 *  onder de kaart nodig heeft — anders leest "🔥 On Fire · 6 op rij" als een
 *  vaste eis in plaats van als de regel van déze voorbeeldkaart. */
const LEEG_CTX: EditieContext = {
  dictatorId: null,
  iconKey: null,
  kampioen: null,
  inForm: null,
  onFire: {},
  pias: null,
  piet: null,
};

/** Synthetische context met realistische waarden, zodat `editieLabel` hier
 *  exact de regels produceert die op de echte kaart staan — geen tweede set
 *  hardgecodeerde labels die stil uit de pas kan lopen. */
const VOORBEELD_CTX: EditieContext = {
  dictatorId: null,
  iconKey: IK,
  kampioen: { playerId: IK, seasonLabel: "Q2 2026" },
  inForm: { playerId: IK, delta: 48, matches: 4 },
  onFire: { [IK]: 6 },
  pias: {
    isoYear: 2026,
    isoWeek: 27,
    weekStart: "2026-06-29",
    playerId: IK,
    reden: "afdroging",
    ernst: 12,
    waarde: 12,
    winChance: null,
    beschermd: false,
  },
  piet: {
    playerId: IK,
    reden: "afdroging",
    ernst: 12,
    detail: "",
    since: "2026-06-28",
    beschermd: false,
  },
};

function LegendaKaart({
  tier,
  elo,
  editie = null,
  editieRegel = null,
  naam,
  profile,
  titel,
  uitleg,
}: {
  tier: Tier | null;
  elo: number;
  editie?: Editie;
  editieRegel?: ReactNode;
  naam: string;
  profile?: Profile;
  titel: string;
  uitleg: string;
}) {
  return (
    <li className="kaart-legenda__cel">
      {/* De kaart is de illustratie; titel en uitleg eronder dragen de
          betekenis. Zonder aria-hidden leest een schermlezer zeventien keer
          dezelfde naam en rating voor. */}
      <span className="kaart-legenda__kaart" aria-hidden="true">
        <FutKaart
          tier={tier}
          editie={editie}
          voor={
            <FutKaartVoorkant
              elo={elo}
              tier={tier}
              naam={naam}
              avatar={<Avatar profile={profile} name={naam} size={38} />}
              editie={editieRegel}
            />
          }
        />
      </span>
      <span className="kaart-legenda__titel">{titel}</span>
      <span className="kaart-legenda__uitleg">{uitleg}</span>
    </li>
  );
}

export function KaartLegenda({
  naam,
  profile,
}: {
  /** Naam van de kijker: die staat op elke voorbeeldkaart. */
  naam: string;
  profile?: Profile;
}) {
  // Pas renderen als het paneel open is: zeventien kaarten met clip-paths en
  // gradients hoeven niet te bestaan zolang niemand kijkt.
  const [open, setOpen] = useState(false);
  const divisies = tierLegend();
  return (
    <details
      className="explainer kaart-legenda"
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary>Wat betekenen de kaarten?</summary>
      <div className="explainer__body">
        {open && (
          <>
            <p className="kaart-legenda__intro">
              Je kaart volgt je divisie: hoe hoger je rating, hoe zwaarder het
              materiaal en hoe brutaler de schildvorm. Presteer je iets
              bijzonders — of juist iets gênants — dan komt daar een speciale
              editie overheen. Je draagt er altijd maar één: de zeldzaamste
              wint.
            </p>

            <h3 className="kaart-legenda__kop">Divisies</h3>
            <ul className="kaart-legenda__raster">
              {divisies.map((d) => {
                const rating = voorbeeldRating(d.key);
                return (
                  <LegendaKaart
                    key={d.key}
                    tier={tierFor(rating)}
                    elo={rating}
                    naam={naam}
                    profile={profile}
                    titel={`${d.emoji} ${d.naam}`}
                    uitleg={`Rating ${d.range}`}
                  />
                );
              })}
            </ul>

            <h3 className="kaart-legenda__kop">Speciale kaarten</h3>
            <ul className="kaart-legenda__raster">
              {EDITIE_PRIORITEIT.map((editie) => (
                <LegendaKaart
                  key={editie}
                  tier={tierFor(EDITIE_RATING)}
                  elo={EDITIE_RATING}
                  editie={editie}
                  editieRegel={editieLabel(editie, VOORBEELD_CTX, IK)}
                  naam={naam}
                  profile={profile}
                  titel={editieLabel(editie, LEEG_CTX) ?? editie}
                  uitleg={editieVoorwaarde(editie) ?? ""}
                />
              ))}
            </ul>
            <p className="kaart-legenda__noot">
              De volgorde hierboven is ook de rangorde: verdien je er meer dan
              één, dan draag je de bovenste. De zittende dictator draagt nooit
              een editie — zijn troonkaart is al het zwaarste materiaal dat er
              is. En let op de reikwijdte: de 🤡 en de 🃏 op de kaart gelden
              voor de héle club, terwijl de pias in de groepsbanner en op je
              dashboard die van jouw groep is.
            </p>
          </>
        )}
      </div>
    </details>
  );
}

export default KaartLegenda;
