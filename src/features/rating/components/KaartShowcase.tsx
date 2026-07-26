// Dev-showcase (#664): alle FUT-kaartvarianten naast elkaar — tiers, edities,
// contextmaten, de donkere varianten en de achterkant. Seed-data levert nooit
// alle edities tegelijk op, dus een visuele review van de kaart was tot nu
// toe niet reproduceerbaar; deze route rendert de puur presentationele
// FutKaart met synthetische props. Alleen geregistreerd in development
// (App.tsx, import.meta.env.DEV) — geen productiechunk.

import { useEffect, useRef, type ReactNode } from "react";
import {
  FutKaart,
  FutKaartDefs,
  FutKaartVoorkant,
  type FutPlaystyle,
} from "@/features/rating/components/FutKaart";
import { FormChips } from "@/features/rating/components/FormChips";
import { tierFor, type Tier } from "@/features/rating/tiers";
import { drawKaart } from "@/features/profiles/profielPoster";
import { Avatar } from "@/ui/Avatar";
import "./KaartShowcase.css";

/** Midden-in-de-band ratings zodat élke tier (en subLabel II) verschijnt. */
const TIER_RATINGS = [550, 650, 750, 850, 950, 1050, 1150, 1250, 1350, 1450, 1650];

/** Realistische editie-regels: exact de vormen die editieLabel produceert —
 *  inclusief de langste varianten (pias #654, Piet #665) als stress-case. */
const EDITIES: ReadonlyArray<{ editie: Editie; label: string }> = [
  { editie: "icon", label: "👑 Big Daddy" },
  { editie: "kampioen", label: "🏆 Kampioen Q2 2026" },
  { editie: "inform", label: "⚡ In-Form · +48" },
  { editie: "onfire", label: "🔥 On Fire · 6 op rij" },
  { editie: "pias", label: "🤡 Pias · −12 games" },
  { editie: "piet", label: "🃏 Piet · 3/7" },
];

type Editie = NonNullable<Parameters<typeof FutKaart>[0]["editie"]>;

const CHIPS: FutPlaystyle[] = [
  { id: "a", naam: "Smash", emoji: "💥" },
  { id: "b", naam: "Lob", emoji: "🎯" },
  { id: "c", naam: "Muur", emoji: "🧱" },
];

/** De échte contextmaten (issue #664): veld-min t/m preview/hero-max. */
const MATEN = [96, 116, 124, 130, 150, 190, 210] as const;

function Kaart({
  kw,
  tier,
  editie = null,
  editieLabel = null,
  naam = "Alice Anders",
  elo,
  chips,
  omgedraaid = false,
}: {
  kw: number;
  tier: Tier | null;
  editie?: Editie | null;
  editieLabel?: string | null;
  naam?: string;
  elo?: number | null;
  chips?: FutPlaystyle[];
  omgedraaid?: boolean;
}) {
  return (
    <FutKaart
      tier={tier}
      editie={editie}
      omgedraaid={omgedraaid}
      className="kaart-showcase__kaart"
      // Zelfde overlay als de echte callers, zodat de hover-/focus-stijl
      // hier ook te beoordelen is.
      voorOverlay={
        <button
          type="button"
          className="fut-kaart__flip"
          aria-label={`Showcase-kaart ${naam}`}
        />
      }
      voor={
        <FutKaartVoorkant
          elo={elo ?? (tier?.min != null ? tier.min + 50 : 1050)}
          tier={tier}
          naam={naam}
          avatar={<Avatar name={naam} size={Math.round(kw * 0.38)} />}
          editie={editieLabel}
          playstyles={chips}
        />
      }
      achter={
        <>
          <span className="fut-kaart__stats-rij">
            <span className="fut-kaart__stats-label">Vorm</span>
            <FormChips form={["W", "W", "L", "D", "W"]} size="sm" />
          </span>
          <span className="fut-kaart__stats-rij">
            <span className="fut-kaart__stats-label">Balans</span>
            <span>12W · 3G · 5V</span>
          </span>
          <span className="fut-kaart__stats-rij">
            <span className="fut-kaart__stats-label">Klassement</span>
            <span>#4</span>
          </span>
        </>
      }
    />
  );
}

/** De kaart zoals de deel-poster hem tekent (#666), op canvas — naast de
 *  DOM-kaart hierboven de enige manier om "export = live" met het oog te
 *  controleren; seed-data levert nooit alle zes edities tegelijk. Zelfde maten
 *  als op de poster (kaart 560px breed op de donkere court-gloed), alleen
 *  teruggeschaald naar de weergavebreedte ernaast. */
const POSTER_KAART_W = 560;
// Ruimte voor de slagschaduw én voor de ornamentlaag (#710): die reikt tot 30
// kaart-units naast en 38 boven het schild, dus met de oude 48px sneed het
// canvas de hoorns en linten er stil af.
const POSTER_MARGE = 180;

function PosterKaart({
  tier,
  editie,
  editieLabel = null,
  naam = "Alice Anders",
  breedte,
}: {
  tier: Tier | null;
  editie: Editie | null;
  editieLabel?: string | null;
  naam?: string;
  breedte: number;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const w = POSTER_KAART_W + POSTER_MARGE * 2;
  const h = Math.round(POSTER_KAART_W * 1.39) + POSTER_MARGE * 2;
  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    // Zelfde donkere ondergrond als de poster, zodat het frame net zo leest.
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#0b241a";
    ctx.fillRect(0, 0, w, h);
    drawKaart(
      ctx,
      {
        name: naam,
        avatarUrl: null,
        rating: tier?.min != null ? tier.min + 50 : 1050,
        tier,
        editie,
        editieTekst: editieLabel,
      },
      null,
      POSTER_MARGE,
      POSTER_MARGE,
      POSTER_KAART_W,
    );
  }, [tier, editie, editieLabel, naam, w, h]);
  return (
    <canvas
      ref={ref}
      width={w}
      height={h}
      // De kaart zélf komt zo op `breedte` uit, gelijk aan de DOM-kaart ernaast.
      style={{ width: `${(breedte * w) / POSTER_KAART_W}px`, height: "auto" }}
      aria-label={`Posterkaart ${naam}${editie ? ` (${editie})` : ""}`}
    />
  );
}

function Sectie({
  titel,
  children,
}: {
  titel: string;
  children: ReactNode;
}) {
  return (
    <section className="kaart-showcase__sectie">
      <h2>{titel}</h2>
      <div className="kaart-showcase__rij">{children}</div>
    </section>
  );
}

export function KaartShowcase() {
  const tiers = TIER_RATINGS.map((r) => tierFor(r));
  // Eén tier per schildvorm: vlak, kroon-notch, spitse vleugels, kroon-crest.
  const schildTiers = [750, 1050, 1350, 1450].map((r) => tierFor(r));
  const donker = [
    { tier: tierFor(1050), editie: "inform" as const, label: "⚡ In-Form · +48" },
    { tier: tierFor(1050), editie: "onfire" as const, label: "🔥 On Fire · 6 op rij" },
    { tier: tierFor(1450), editie: null, label: null },
    { tier: tierFor(1650), editie: null, label: null },
  ];
  return (
    <main className="kaart-showcase">
      <FutKaartDefs />
      <h1>FUT-kaart showcase (dev)</h1>
      <p>
        Synthetische kaarten voor visuele review (#664): tiers, edities,
        contextmaten en achterkant. Deze route bestaat alleen in development.
      </p>

      {/* GOAT-variant (#710, hertekend in #772): de kaart met bokhoorns,
          baardfiligraan, geitenwatermerk en het eigen divisie-icoon, op de
          maten waar het ornament het meest te lijden heeft — veldmaat, wand,
          hero — plus de canvas-spiegel ernaast. Bewust bovenaan: dit is de
          variant die je bij elke wijziging aan de ornamentlaag wilt zien. */}
      <Sectie titel="GOAT (#772): hoorns + baardfiligraan — DOM op 116/150/210px, poster rechts">
        {[116, 150, 210].map((kw) => (
          <div
            key={kw}
            className="kaart-showcase__maat"
            style={{ ["--maat" as string]: `${kw}px` }}
          >
            <Kaart kw={kw} tier={tierFor(1450)} naam="Senne" elo={1487} />
            <span className="kaart-showcase__maatlabel">{kw}px</span>
          </div>
        ))}
        <PosterKaart tier={tierFor(1450)} editie={null} editieLabel={null} breedte={210} />
        {/* Onder een editie-skin: de hoorns blijven (ornament hangt aan de
            tier), het geitenwatermerk wijkt voor het editie-vlak. */}
        <div
          className="kaart-showcase__maat"
          style={{ ["--maat" as string]: "150px" }}
        >
          <Kaart
            kw={150}
            tier={tierFor(1450)}
            editie="inform"
            editieLabel="⚡ In-Form · +48"
            naam="Senne"
            elo={1487}
          />
          <span className="kaart-showcase__maatlabel">GOAT + In-Form</span>
        </div>
      </Sectie>

      {/* De drie subniveaus plus de stress-cases uit #772: één kaartvariant,
          verschillende ratings, subLabels en naamlengtes. Hier moet zichtbaar
          zijn dat het baardfiligraan de divisieregel nooit raakt — die staat
          bij GOAT I op "GOAT I" en bij GOAT III op "GOAT III". */}
      <Sectie titel="GOAT × subniveau en naamlengte (#772): III · II · I, lange naam, 96px">
        {[1420, 1490, 1560].map((r) => (
          <div
            key={r}
            className="kaart-showcase__maat"
            style={{ ["--maat" as string]: "150px" }}
          >
            <Kaart kw={150} tier={tierFor(r)} naam="Senne" elo={r} />
            <span className="kaart-showcase__maatlabel">
              {tierFor(r)?.label} · {r}
            </span>
          </div>
        ))}
        <div
          className="kaart-showcase__maat"
          style={{ ["--maat" as string]: "150px" }}
        >
          <Kaart
            kw={150}
            tier={tierFor(1490)}
            naam="Wolfgang Vandenbroucke"
            elo={1490}
          />
          <span className="kaart-showcase__maatlabel">Lange naam</span>
        </div>
        <div
          className="kaart-showcase__maat"
          style={{ ["--maat" as string]: "96px" }}
        >
          <Kaart kw={96} tier={tierFor(1490)} naam="Senne" elo={1490} />
          <span className="kaart-showcase__maatlabel">96px (veldmaat)</span>
        </div>
      </Sectie>

      {/* El Padelissimo (#710): troon-crest, kroon en epauletten achter de
          kaart, lauwerkransen en lakzegel ervóór. Zelfde opzet als de
          GOAT-sectie hierboven, inclusief de canvas-spiegel. */}
      <Sectie titel="El Padelissimo (#710): kroon, epauletten, lauwerkrans, lakzegel — poster rechts">
        {[116, 150, 210].map((kw) => (
          <div
            key={kw}
            className="kaart-showcase__maat"
            style={{ ["--maat" as string]: `${kw}px` }}
          >
            <Kaart kw={kw} tier={tierFor(1650)} naam="Remco" elo={1642} />
            <span className="kaart-showcase__maatlabel">{kw}px</span>
          </div>
        ))}
        <PosterKaart tier={tierFor(1650)} editie={null} editieLabel={null} breedte={210} />
      </Sectie>

      {/* Big Daddy-variant (#710): kroon, linten, ballonnen, confetti en het
          edelsteen-ornament in de punt. Twee tiers omdat de schildvorm van de
          divísie komt: 1387 geeft de spitse vleugels, 1487 de kroon-crest — de
          kroon-in-de-inkeping moet op beide sluitend zitten. */}
      <Sectie titel="Big Daddy (#710): kroon + linten + ballonnen — DOM op 116/150/210px, poster rechts">
        {[116, 150, 210].map((kw) => (
          <div
            key={kw}
            className="kaart-showcase__maat"
            style={{ ["--maat" as string]: `${kw}px` }}
          >
            <Kaart
              kw={kw}
              tier={tierFor(1387)}
              editie="icon"
              editieLabel="👑 Big Daddy"
              naam="Bjorn"
              elo={1387}
            />
            <span className="kaart-showcase__maatlabel">{kw}px</span>
          </div>
        ))}
        <PosterKaart
          tier={tierFor(1387)}
          editie="icon"
          editieLabel="👑 Big Daddy"
          naam="Bjorn"
          breedte={210}
        />
        <div
          className="kaart-showcase__maat"
          style={{ ["--maat" as string]: "150px" }}
        >
          <Kaart
            kw={150}
            tier={tierFor(1487)}
            editie="icon"
            editieLabel="👑 Big Daddy"
            naam="Bjorn"
            elo={1487}
          />
          <span className="kaart-showcase__maatlabel">
            Big Daddy + GOAT (kroon-crest)
          </span>
        </div>
      </Sectie>

      {/* Kampioen-variant (#710): lauwerkrans + medaillelinten achter de kaart
          en de diamantcrest ervóór, op de maten waar de ornamentlaag het
          zwaarst te lijden heeft — plus de canvas-spiegel ernaast. Twee
          schildvormen erbij: het ornament hangt aan de editie, de bovenrand aan
          de divisie, dus de crest moet in élke inkeping landen. */}
      <Sectie titel="Kampioen (#710): lauwerkrans + linten + crest — DOM op 116/150/210px, poster rechts">
        {[116, 150, 210].map((kw) => (
          <div
            key={kw}
            className="kaart-showcase__maat"
            style={{ ["--maat" as string]: `${kw}px` }}
          >
            <Kaart
              kw={kw}
              tier={tierFor(1043)}
              editie="kampioen"
              editieLabel="🏆 Kampioen Q2 2026"
              naam="Tim"
              elo={1043}
            />
            <span className="kaart-showcase__maatlabel">{kw}px</span>
          </div>
        ))}
        <PosterKaart
          tier={tierFor(1043)}
          editie="kampioen"
          editieLabel="🏆 Kampioen Q2 2026"
          naam="Tim"
          breedte={210}
        />
        {[750, 1450].map((r) => (
          <div
            key={r}
            className="kaart-showcase__maat"
            style={{ ["--maat" as string]: "150px" }}
          >
            <Kaart
              kw={150}
              tier={tierFor(r)}
              editie="kampioen"
              editieLabel="🏆 Kampioen Q2 2026"
              naam="Tim"
            />
            <span className="kaart-showcase__maatlabel">
              {r === 750 ? "vlakke bovenrand" : "kroon-crest"}
            </span>
          </div>
        ))}
        <div
          className="kaart-showcase__maat"
          style={{ ["--maat" as string]: "150px" }}
        >
          <Kaart
            kw={150}
            tier={tierFor(1043)}
            editie="kampioen"
            editieLabel="🏆 Kampioen Q2 2026"
            naam="Tim"
            omgedraaid
          />
          <span className="kaart-showcase__maatlabel">omgedraaid (geen crest)</span>
        </div>
      </Sectie>

      {/* Pias-variant (#710): de gevallen joker — narrenkap met asymmetrische
          belletjes, twee jokerlinten en het maskermedaillon op de punt, plus de
          harlekijn-/maskerlaag ín het vlak. Zelfde maten als de GOAT hierboven
          (veld, wand, hero) en de canvas-spiegel ernaast; de kap en de linten
          steken buiten het schild uit, dus dit is de rij waarin je een
          scrollbar of layout shift zou zien. */}
      <Sectie titel="Pias (#710): narrenkap + linten + maskermedaillon — DOM op 116/150/210px, poster rechts">
        {[116, 150, 210].map((kw) => (
          <div
            key={kw}
            className="kaart-showcase__maat"
            style={{ ["--maat" as string]: `${kw}px` }}
          >
            <Kaart
              kw={kw}
              tier={tierFor(1050)}
              editie="pias"
              editieLabel="🤡 Pias · −12 games"
              naam="Remco"
              elo={1050}
            />
            <span className="kaart-showcase__maatlabel">{kw}px</span>
          </div>
        ))}
        <PosterKaart
          tier={tierFor(1050)}
          editie="pias"
          editieLabel="🤡 Pias · −12 games"
          naam="Remco"
          breedte={210}
        />
        {/* Op een GOAT-drager: het editie-ornament wint van de tier-hoorns, en
            op de kroon-crest zit de kap in een ándere bovenrand. */}
        <div
          className="kaart-showcase__maat"
          style={{ ["--maat" as string]: "150px" }}
        >
          <Kaart
            kw={150}
            tier={tierFor(1450)}
            editie="pias"
            editieLabel="🤡 Pias · −12 games"
            naam="Senne"
            elo={1487}
          />
          <span className="kaart-showcase__maatlabel">GOAT + Pias</span>
        </div>
        {/* Alle vier de schildvormen: de kraag moet op elke bovenrand sluiten. */}
        {[750, 1050, 1350, 1450].map((r) => (
          <Kaart
            key={r}
            kw={130}
            tier={tierFor(r)}
            editie="pias"
            editieLabel="🤡 Pias · −12 games"
            chips={CHIPS}
          />
        ))}
      </Sectie>

      {/* Zwarte Piet (#710): de kaart met kettingen, geopende sluitingen,
          pion-crest en gebroken zegel. Twee ornamentlagen (achter én voor de
          kaart), dus dit is de variant die je bij elke wijziging aan die lagen
          wilt zien — mét de canvas-spiegel ernaast, want de poster tekent de
          voor-laag pas ná de content. De schildvorm wisselt met de divisie: de
          Piet gaat door de hele club rond, dus crest en zegel moeten op alle
          vier de bovenranden werken. */}
      <Sectie titel="Zwarte Piet (#710): kettingen + gebroken zegel — DOM op 116/150/210px, poster rechts">
        {[116, 150, 210].map((kw) => (
          <div
            key={kw}
            className="kaart-showcase__maat"
            style={{ ["--maat" as string]: `${kw}px` }}
          >
            <Kaart
              kw={kw}
              tier={tierFor(1050)}
              editie="piet"
              editieLabel="🃏 Piet · 28/6"
              naam="Remco"
              elo={1050}
            />
            <span className="kaart-showcase__maatlabel">{kw}px</span>
          </div>
        ))}
        <PosterKaart
          tier={tierFor(1050)}
          editie="piet"
          editieLabel="🃏 Piet · 28/6"
          naam="Remco"
          breedte={210}
        />
        {schildTiers.map((t, i) => (
          <div
            key={`piet-vorm-${i}`}
            className="kaart-showcase__maat"
            style={{ ["--maat" as string]: "130px" }}
          >
            <Kaart
              kw={130}
              tier={t}
              editie="piet"
              editieLabel="🃏 Piet · 28/12"
              naam="Bartholomeus van Wijngaarden"
              chips={CHIPS}
            />
            <span className="kaart-showcase__maatlabel">{t?.key}</span>
          </div>
        ))}
      </Sectie>

      {/* In-Form (#710): de enige editie met een eigen ornamentlaag, dus de
          enige plek waar de overlay-eigenschap te zien is. Bewust op twee
          tiers met een ánder schild (kroon-notch en troon-crest): de crest,
          de vinnen en het medaillon moeten op élke bovenrand kloppen, en op de
          GOAT/dictator-tiers moet zichtbaar zijn dat het editie-ornament van
          het tier-ornament wint (geen hoorns, geen kroon). */}
      <Sectie titel="In-Form (#710): titanium-overlay op twee tiers — DOM op 116/150/210px, poster rechts">
        {[116, 150, 210].map((kw) => (
          <div
            key={kw}
            className="kaart-showcase__maat"
            style={{ ["--maat" as string]: `${kw}px` }}
          >
            <Kaart
              kw={kw}
              tier={tierFor(1050)}
              editie="inform"
              editieLabel="⚡ In-Form · +48"
              naam="Remco"
              elo={1050}
            />
            <span className="kaart-showcase__maatlabel">{kw}px</span>
          </div>
        ))}
        <PosterKaart
          tier={tierFor(1050)}
          editie="inform"
          editieLabel="⚡ In-Form · +48"
          naam="Remco"
          breedte={210}
        />
        {[
          { r: 1350, label: "punt-schild" },
          { r: 1450, label: "GOAT: editie wint" },
          { r: 1650, label: "dictator: editie wint" },
        ].map((v) => (
          <div
            key={v.r}
            className="kaart-showcase__maat"
            style={{ ["--maat" as string]: "150px" }}
          >
            <Kaart
              kw={150}
              tier={tierFor(v.r)}
              editie="inform"
              editieLabel="⚡ In-Form · +48"
              naam="Senne"
            />
            <span className="kaart-showcase__maatlabel">{v.label}</span>
          </div>
        ))}
        <PosterKaart
          tier={tierFor(1650)}
          editie="inform"
          editieLabel="⚡ In-Form · +48"
          naam="Senne"
          breedte={150}
        />
      </Sectie>

      {/* On Fire (#710): de enige editie met een eigen ornamentlaag, en dus de
          enige plek waar de overlay-eigenschap te zien is — dezelfde crest,
          vinnen en medaillon liggen op een brons-schild (vlakke bovenrand) én
          op een GOAT (kroon-crest, waar de vlamvinnen de bokhoorns vervangen).
          Kijk hier bij elke wijziging aan de editie-vs-tier-regel. */}
      <Sectie titel="On Fire (#710): vlamcrest, vinnen, medaillon — DOM op 116/150/210px, poster rechts">
        {[116, 150, 210].map((kw) => (
          <div
            key={kw}
            className="kaart-showcase__maat"
            style={{ ["--maat" as string]: `${kw}px` }}
          >
            <Kaart
              kw={kw}
              tier={tierFor(1050)}
              editie="onfire"
              editieLabel="🔥 On Fire · 6 op rij"
              naam="Jelle"
              elo={1063}
            />
            <span className="kaart-showcase__maatlabel">{kw}px</span>
          </div>
        ))}
        <PosterKaart
          tier={tierFor(1050)}
          editie="onfire"
          editieLabel="🔥 On Fire · 6 op rij"
          naam="Jelle"
          breedte={210}
        />
      </Sectie>
      <Sectie titel="On Fire × schildvorm (#710): brons · goud · meester · GOAT · El Padelissimo (150px)">
        {[750, 1050, 1350, 1450, 1650].map((r) => (
          <div
            key={r}
            className="kaart-showcase__maat"
            style={{ ["--maat" as string]: "150px" }}
          >
            <Kaart
              kw={150}
              tier={tierFor(r)}
              editie="onfire"
              editieLabel="🔥 On Fire · 12 op rij"
              naam="Jelle"
            />
            <span className="kaart-showcase__maatlabel">
              {tierFor(r)?.label ?? "—"}
            </span>
          </div>
        ))}
      </Sectie>

      <Sectie titel="Alle tiers (116px, geen editie)">
        {tiers.map((t, i) => (
          <Kaart key={i} kw={116} tier={t} chips={CHIPS} />
        ))}
      </Sectie>

      <Sectie titel="Edities × schildvorm (116px)">
        {EDITIES.map((e) =>
          schildTiers.map((t, i) => (
            <Kaart
              key={`${e.editie}-${i}`}
              kw={116}
              tier={t}
              editie={e.editie}
              editieLabel={e.label}
              chips={CHIPS}
            />
          )),
        )}
      </Sectie>

      <Sectie titel="Contextmaten (pias-editie + chips, langste regel)">
        {MATEN.map((kw) => (
          <div key={kw} className="kaart-showcase__maat" style={{ ["--maat" as string]: `${kw}px` }}>
            <Kaart
              kw={kw}
              tier={tierFor(1050)}
              editie="pias"
              editieLabel="🤡 Pias · −12 games"
              chips={CHIPS}
            />
            <span className="kaart-showcase__maatlabel">{kw}px</span>
          </div>
        ))}
      </Sectie>

      {/* #665: de Piet-regel kapte juist op de veld- en wandmaten af, dus
          krijgt hij dezelfde maten-rij als de pias — mét de langst mogelijke
          datum (28/12), de variant waarop de oude vorm sneuvelde. */}
      <Sectie titel="Contextmaten (piet-editie + chips, langste datum)">
        {MATEN.map((kw) => (
          <div key={kw} className="kaart-showcase__maat" style={{ ["--maat" as string]: `${kw}px` }}>
            <Kaart
              kw={kw}
              tier={tierFor(1050)}
              editie="piet"
              editieLabel="🃏 Piet · 28/12"
              chips={CHIPS}
            />
            <span className="kaart-showcase__maatlabel">{kw}px</span>
          </div>
        ))}
      </Sectie>

      <Sectie titel="Donkere varianten naast elkaar (96 / 116 / 130px)">
        {[96, 116, 130].map((kw) =>
          donker.map((d, i) => (
            <div key={`${kw}-${i}`} className="kaart-showcase__maat" style={{ ["--maat" as string]: `${kw}px` }}>
              <Kaart
                kw={kw}
                tier={d.tier}
                editie={d.editie}
                editieLabel={d.label}
                chips={CHIPS}
              />
            </div>
          )),
        )}
      </Sectie>

      <Sectie titel="Live vs. deel-poster (#666): DOM-kaart naast de canvas-kaart">
        {[{ editie: null, label: null }, ...EDITIES].map((e) => (
          <div key={e.editie ?? "geen"} className="kaart-showcase__pariteit">
            <span className="kaart-showcase__maatlabel">
              {e.editie ?? "geen editie"}
            </span>
            <div className="kaart-showcase__pariteit-paar">
              <div
                className="kaart-showcase__maat"
                style={{ ["--maat" as string]: "150px" }}
              >
                <Kaart
                  kw={150}
                  tier={tierFor(1250)}
                  editie={e.editie}
                  editieLabel={e.label}
                />
              </div>
              <PosterKaart
                tier={tierFor(1250)}
                editie={e.editie}
                editieLabel={e.label}
                breedte={150}
              />
            </div>
          </div>
        ))}
      </Sectie>

      <Sectie titel="Achterkant (96 / 130 / 210px)">
        {[96, 130, 210].map((kw) => (
          <div key={kw} className="kaart-showcase__maat" style={{ ["--maat" as string]: `${kw}px` }}>
            <Kaart kw={kw} tier={tierFor(1050)} omgedraaid />
          </div>
        ))}
      </Sectie>

      <Sectie titel="Stress: lange naam + langste editie-regel (96 / 130px)">
        {[96, 130].map((kw) => (
          <div key={kw} className="kaart-showcase__maat" style={{ ["--maat" as string]: `${kw}px` }}>
            <Kaart
              kw={kw}
              tier={tierFor(1250)}
              editie="piet"
              editieLabel="🃏 Piet · 28/12"
              naam="Bartholomeus van Wijngaarden"
              chips={CHIPS}
            />
          </div>
        ))}
      </Sectie>
    </main>
  );
}

export default KaartShowcase;
