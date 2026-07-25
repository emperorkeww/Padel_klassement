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
 *  inclusief de langste varianten (pias/Piet, #654) als stress-case. */
const EDITIES: ReadonlyArray<{ editie: Editie; label: string }> = [
  { editie: "icon", label: "👑 Big Daddy" },
  { editie: "kampioen", label: "🏆 Kampioen Q2 2026" },
  { editie: "inform", label: "⚡ In-Form · +48" },
  { editie: "onfire", label: "🔥 On Fire · 6 op rij" },
  { editie: "pias", label: "🤡 Pias · −12 games" },
  { editie: "piet", label: "🃏 Zwarte Piet · sinds 3/7" },
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
const POSTER_MARGE = 48; // ruimte voor de slagschaduw van het frame

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
        rank: 4,
        form: [],
        topBadge: null,
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
              editieLabel="🃏 Zwarte Piet · sinds 28/12"
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
