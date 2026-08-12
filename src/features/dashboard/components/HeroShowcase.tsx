// Dev-showcase (#771): alle varianten van de dashboard player card naast elkaar —
// de vijf permanente thema's, de twee tijdelijke overlays en de combinaties
// daarvan, plus een stress-case met lange teksten.
//
// Zelfde reden als de kaart-showcase (#664): seed-data levert nooit alle
// statussen tegelijk op, dus een visuele review van de zeven ontwerpen was niet
// reproduceerbaar. Deze route rendert de presentationele DashboardHero met
// synthetische props. Alleen geregistreerd in development (App.tsx,
// import.meta.env.DEV) — geen productiechunk.

import { DashboardHero, type HeroStatus } from "./DashboardHero";
import type { Badge } from "@/features/profiles/badges";
import type { HeroOverlay, HeroPermanent } from "../heroThema";
import "./HeroShowcase.css";

/** Een volle badgekast (#939): de rij toont er zes en telt de rest als "+N",
 *  precies de situatie waarin ze op 390px na vijf cirkels brak. */
const BADGES: Badge[] = [
  ["🎯", "Scherpschutter", "Tien matches met een setwinst op nul."],
  ["🧱", "Muur", "Vijf keer een wedstrijd zonder verloren game."],
  ["🌪️", "Comeback", "Gewonnen na een 0-4 achterstand."],
  ["🧊", "IJskoud", "Drie tiebreaks op rij gewonnen."],
  ["🚀", "Raket", "Vijftig Elo in één avond gepakt."],
  ["🦉", "Nachtuil", "Twintig matches na tienen 's avonds."],
  ["🐐", "Legende", "Honderd matches gespeeld."],
].map(([emoji, naam, omschrijving]) => ({
  id: naam.toLowerCase(),
  naam,
  emoji,
  omschrijving,
  behaald: true,
}));

/** Realistische editie-regels: exact de vormen die editieLabel produceert,
 *  inclusief de langste varianten als stress-case. */
const LABELS: HeroStatus["labels"] = {
  kampioen: { emoji: "🏆", label: "Kampioen Q2 2026" },
  inform: { emoji: "⚡", label: "In-Form · +48" },
  onfire: { emoji: "🔥", label: "On Fire · 6 op rij" },
};

const BASIS: HeroStatus = {
  dictator: false,
  bigDaddy: false,
  kampioen: false,
  inForm: false,
  onFire: false,
  piet: false,
  pias: false,
  piasWaar: "in Vrijdagavond Padel",
  schild: false,
  thema: null,
  overlay: null,
  labels: LABELS,
};

/** De vlag die bij een permanent thema hoort — zonder die vlag is er geen crest
 *  en dus ook geen statusbadge om te beoordelen. */
const VLAG: Record<NonNullable<HeroPermanent>, keyof HeroStatus> = {
  dictator: "dictator",
  bigdaddy: "bigDaddy",
  kampioen: "kampioen",
  pias: "pias",
  piet: "piet",
};

function status(
  thema: HeroPermanent,
  overlay: HeroOverlay = null,
  extra: Partial<HeroStatus> = {},
): HeroStatus {
  return {
    ...BASIS,
    ...(thema ? { [VLAG[thema]]: true } : {}),
    ...(overlay === "inform" ? { inForm: true } : {}),
    ...(overlay === "onfire" ? { onFire: true } : {}),
    thema,
    overlay,
    ...extra,
  };
}

/** Eén rating midden in elke band, zodat élke divisie langskomt. 994 (Blaaskaak)
 *  is de divisie uit de referentieontwerpen en dus de standaard hieronder. */
const DIVISIES: ReadonlyArray<readonly [rating: number, naam: string]> = [
  [550, "Sletje van de baan"],
  [650, "Stofzuiger"],
  [750, "Ballenraper"],
  [850, "Bankvuller"],
  [994, "Blaaskaak"],
  [1050, "Wannabe"],
  [1150, "Glazenwasser"],
  [1250, "Eeuwige belofte"],
  [1350, "Forever second"],
  [1450, "GOAT (toptier, premium glans)"],
];

function Kaart({
  titel,
  uitleg,
  status: s,
  naam = "Remco",
  rating = 994,
  briefing = "Bijna 🤡 Wannabe: nog 6 Elo. M'n notitieboekje ligt al open op de felicitatiepagina.",
  badges = [],
}: {
  titel: string;
  uitleg: string;
  status: HeroStatus;
  naam?: string;
  rating?: number | null;
  briefing?: string | null;
  badges?: Badge[];
}) {
  return (
    <section className="hero-showcase__geval">
      <h2 className="hero-showcase__titel">{titel}</h2>
      <p className="hero-showcase__uitleg">{uitleg}</p>
      <DashboardHero
        myId="p1"
        profile={undefined}
        naam={naam}
        rating={rating}
        ratingGames={24}
        heeftStand
        loading={false}
        status={s}
        earnedBadges={badges}
        form={["W", "W", "W", "L", "W"]}
        briefing={briefing}
      />
    </section>
  );
}

export function HeroShowcase() {
  return (
    <div className="hero-showcase">
      <h1 className="hero-showcase__kop">Dashboard player card — #771</h1>
      <p className="hero-showcase__intro">
        Eén component, verwisselbare themalagen. De permanente thema's bepalen het
        materiaal; In-Form en On Fire liggen als tijdelijke overlay erover en laten
        de kaart eronder herkenbaar.
      </p>

      <Kaart
        titel="1 · Standaard (divisie)"
        uitleg="Geen permanent thema: de kaart staat op zijn divisie."
        status={status(null)}
      />
      <Kaart
        titel="2 · Big Daddy"
        uitleg="Actuele nummer één zonder zittende dictator."
        status={status("bigdaddy")}
      />
      <Kaart
        titel="3 · Dictator"
        uitleg="Zittende dictator; ceremonieel commandothema."
        status={status("dictator")}
      />
      <Kaart
        titel="4 · Kampioen"
        uitleg="Kwartaaltitel van de hele club (premium ontwerp met diamantcrest, lauwerkrans en linten)."
        status={status("kampioen")}
      />
      <Kaart
        titel="5 · Pias"
        uitleg="Gevallen joker: de grootste afgang van deze week in een groep."
        status={status("pias")}
      />
      <Kaart
        titel="6 · Schande-token (Zwarte Piet)"
        uitleg="Rondgaande penalty-token; abstract gehouden — spelstukken en zegels."
        status={status("piet")}
      />
      <Kaart
        titel="7 · In-Form-overlay op de divisiekaart"
        uitleg="In-Form draagt zijn eigen kaart: zwart-goud profiel, stormkolom en schildcrest."
        status={status(null, "inform")}
      />
      <Kaart
        titel="8 · On Fire-overlay op de divisiekaart"
        uitleg="Kan voor meerdere spelers tegelijk actief zijn."
        status={status(null, "onfire")}
      />

      <h2 className="hero-showcase__sectie">Overlay boven een permanent thema</h2>
      <Kaart
        titel="In-Form over de Kampioen-kaart"
        uitleg="In-Form neemt vlak en lijst over; de lauwertakken en de diamantcrest blijven staan."
        status={status("kampioen", "inform")}
      />
      <Kaart
        titel="In-Form over de piaskaart"
        uitleg="Zelfde kaart als hierboven, met de narrenkap en het maskermedaillon van de pias erop."
        status={status("pias", "inform")}
      />
      <Kaart
        titel="In-Form over de Big Daddy-kaart"
        uitleg="Ook hier wint In-Form het vlak; teddy, linten en hoekharten blijven van de kroon."
        status={status("bigdaddy", "inform")}
      />
      <Kaart
        titel="On Fire over de Big Daddy-kaart"
        uitleg="On Fire heeft geen eigen ontwerp en blijft de dunne overlay: de kroon blijft de kaart."
        status={status("bigdaddy", "onfire")}
      />

      <h2 className="hero-showcase__sectie">
        De basiskaart per divisie (#771)
      </h2>
      <p className="hero-showcase__uitleg">
        Zelfde recept, ander materiaal: rand, keyline, was en watermerk komen uit
        het register van de divisiekaart (#710).
      </p>
      {DIVISIES.map(([rating, naam]) => (
        <Kaart
          key={rating}
          titel={naam}
          uitleg={`rating ${rating}`}
          status={status(null)}
          rating={rating}
        />
      ))}
      <Kaart
        titel="Zonder rating"
        uitleg="Nog nooit gespeeld: geen divisie, dus de neutrale kaart."
        status={status(null)}
        rating={null}
      />

      <h2 className="hero-showcase__sectie">Randgevallen</h2>
      <Kaart
        titel="Roast-schild op de pias"
        uitleg="Het schild dooft het schande-thema: kaart terug naar de divisie, chip blijft neutraal (📊)."
        status={status(null, null, { pias: true, schild: true })}
      />
      <Kaart
        titel="Meerdere titels tegelijk"
        uitleg="Eén badge, de rest compact als chips, badgerij eronder — kleur is nooit de enige indicator."
        status={status("bigdaddy", "inform", { piet: true, kampioen: true })}
        badges={BADGES}
      />
      <Kaart
        titel="Lange naam en lang coachbericht"
        uitleg="Stress-case voor clamp() en de wrap van de titelrij."
        status={status("dictator", "onfire", { pias: true })}
        naam="Bartholomeus-Alexander"
        briefing="Zes op een rij, en tóch nog steeds die tweede opslag als een verontschuldiging. Ik heb je vorige week horen zeggen dat je nu écht gaat trainen; mijn notitieboekje staat vol met diezelfde belofte, in vier verschillende handschriften."
      />
      <Kaart
        titel="Zonder coachbericht"
        uitleg="Lege staat: geen briefing, geen chips."
        status={status(null)}
        briefing={null}
      />
    </div>
  );
}

export default HeroShowcase;
