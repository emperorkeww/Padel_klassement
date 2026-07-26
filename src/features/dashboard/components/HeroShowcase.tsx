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
import type { HeroOverlay, HeroPermanent } from "../heroThema";
import "./HeroShowcase.css";

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

function Kaart({
  titel,
  uitleg,
  status: s,
  naam = "Remco",
  briefing = "Bijna 🤡 Wannabe: nog 6 Elo. M'n notitieboekje ligt al open op de felicitatiepagina.",
}: {
  titel: string;
  uitleg: string;
  status: HeroStatus;
  naam?: string;
  briefing?: string | null;
}) {
  return (
    <section className="hero-showcase__geval">
      <h2 className="hero-showcase__titel">{titel}</h2>
      <p className="hero-showcase__uitleg">{uitleg}</p>
      <DashboardHero
        myId="p1"
        profile={undefined}
        naam={naam}
        rating={994}
        ratingGames={24}
        rank={6}
        heeftStand
        loading={false}
        status={s}
        earnedBadges={[]}
        form={["W", "W", "W", "L", "W"]}
        briefing={briefing}
        generateCta={{ to: "/groepen", label: "Wedstrijden genereren" }}
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
        uitleg="Kwartaaltitel van de hele club (premium ontwerp volgt in #781)."
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
        uitleg="Tijdelijke overlay: tint, glans en badge over de basiskaart."
        status={status(null, "inform")}
      />
      <Kaart
        titel="8 · On Fire-overlay op de divisiekaart"
        uitleg="Kan voor meerdere spelers tegelijk actief zijn."
        status={status(null, "onfire")}
      />

      <h2 className="hero-showcase__sectie">Overlay boven een permanent thema</h2>
      <Kaart
        titel="In-Form over de piaskaart"
        uitleg="Het kraftkarton blijft staan; de badge vertelt het nieuws van deze week."
        status={status("pias", "inform")}
      />
      <Kaart
        titel="On Fire over de Big Daddy-kaart"
        uitleg="Kroon blijft de kaart, de reeks ligt erover."
        status={status("bigdaddy", "onfire")}
      />

      <h2 className="hero-showcase__sectie">Randgevallen</h2>
      <Kaart
        titel="Roast-schild op de pias"
        uitleg="Het schild dooft het schande-thema: kaart terug naar de divisie, chip blijft neutraal (📊)."
        status={status(null, null, { pias: true, schild: true })}
      />
      <Kaart
        titel="Meerdere titels tegelijk"
        uitleg="Eén badge, de rest als chips — kleur is nooit de enige indicator."
        status={status("bigdaddy", "inform", { piet: true, kampioen: true })}
      />
      <Kaart
        titel="Lange naam en lang coachbericht"
        uitleg="Stress-case voor clamp() en de wrap van de titelrij."
        status={status("dictator", "onfire", { pias: true })}
        naam="Bartholomeus-Alexander"
        briefing="Zes op een rij, en tóch nog steeds die tweede opslag als een verontschuldiging. Ik heb je vorige week horen zeggen dat je nu écht gaat trainen; mijn notitieboekje staat vol met diezelfde belofte, in vier verschillende handschriften."
      />
      <Kaart
        titel="Zonder rating en zonder coachbericht"
        uitleg="Lege staat: geen briefing, geen chips."
        status={status(null)}
        briefing={null}
      />
    </div>
  );
}

export default HeroShowcase;
