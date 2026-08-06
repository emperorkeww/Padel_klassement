// Dev-showcase (#1062): het glasmateriaal op zes achtergronden naast elkaar.
//
// Glas is het enige materiaal in deze app waarvan je de kwaliteit niet aan het
// vlak zelf kunt zien: het hangt volledig af van wat eronder ligt. Een variant
// die er op de effen app-achtergrond prachtig uitziet, kan op de lime-wash van
// het dashboard onleesbaar worden. Vandaar dit raster — vier varianten × zes
// achtergronden, in beide thema's te bekijken met de themawissel.
//
// Alleen geregistreerd in development (App.tsx, import.meta.env.DEV), dus geen
// productiechunk. Zet in devtools ook een keer prefers-reduced-motion,
// prefers-contrast en prefers-reduced-transparency aan: alle drie horen op een
// dicht vlak terug te vallen.

import { useState } from "react";
import { LiquidGlass, type GlasVariant } from "./LiquidGlass";
import "./GlasShowcase.css";

const VARIANTEN: { variant: GlasVariant; uitleg: string }[] = [
  { variant: "subtiel", uitleg: "Grote vlakken en achtergronden." },
  { variant: "standaard", uitleg: "Kaarten en panelen." },
  { variant: "sterk", uitleg: "Overlays en zwevende navigatie." },
  { variant: "interactief", uitleg: "Knoppen en chips; volgt de aanwijzer." },
];

const ACHTERGRONDEN: { id: string; naam: string; uitleg: string }[] = [
  { id: "vlak", naam: "Effen app", uitleg: "--bg, het meest voorkomende geval" },
  { id: "wash", naam: "Lime-wash", uitleg: "zoals .dashboard::before" },
  { id: "accent", naam: "Accent-verloop", uitleg: "zoals .card--next" },
  { id: "kaart", naam: "Kaartverloop", uitleg: "diep en verzadigd, als een FUT-kaart" },
  { id: "streep", naam: "Hoog contrast", uitleg: "harde randen, de zwaarste test" },
  { id: "tekst", naam: "Over tekst", uitleg: "leesbaarheid van wat eronder ligt" },
];

export function GlasShowcase() {
  const [uitgeschakeld, setUitgeschakeld] = useState(false);

  return (
    <div className="glas-showcase">
      <header className="glas-showcase__kop">
        <h1>Glasmateriaal (#1062)</h1>
        <p>
          Vier varianten op zes achtergronden. Beweeg met de muis over de
          interactieve vlakken; op een aanraakscherm hoort daar niets te
          gebeuren.
        </p>
        <label className="glas-showcase__schakelaar">
          <input
            type="checkbox"
            checked={uitgeschakeld}
            onChange={(e) => setUitgeschakeld(e.target.checked)}
          />
          Alles uitgeschakeld tonen
        </label>
      </header>

      {ACHTERGRONDEN.map((achtergrond) => (
        <section
          key={achtergrond.id}
          className={`glas-showcase__scene glas-showcase__scene--${achtergrond.id}`}
          aria-label={achtergrond.naam}
        >
          <p className="glas-showcase__scene-naam">
            {achtergrond.naam} <span>· {achtergrond.uitleg}</span>
          </p>
          <div className="glas-showcase__rij">
            {VARIANTEN.map(({ variant, uitleg }) => (
              <LiquidGlass
                key={variant}
                variant={variant}
                uitgeschakeld={uitgeschakeld}
                className="glas-showcase__paneel"
              >
                <strong>{variant}</strong>
                <span>{uitleg}</span>
              </LiquidGlass>
            ))}
          </div>
          <div className="glas-showcase__rij glas-showcase__rij--vormen">
            <LiquidGlass
              as="button"
              type="button"
              variant="interactief"
              vorm="pil"
              uitgeschakeld={uitgeschakeld}
              className="glas-showcase__pil"
            >
              Pil-knop
            </LiquidGlass>
            <LiquidGlass
              as="button"
              type="button"
              variant="interactief"
              vorm="cirkel"
              uitgeschakeld={uitgeschakeld}
              className="glas-showcase__cirkel"
              aria-label="Ronde knop"
            >
              +
            </LiquidGlass>
            <LiquidGlass
              variant="sterk"
              vorm="paneel"
              className="glas-showcase__breed"
            >
              <h2>Groter contentpaneel</h2>
              <p>
                Een langere lap tekst, want de echte vraag bij glas is niet of
                het vlak mooi is maar of dit stukje proza er nog leesbaar op
                staat — in licht én in donker, op alle zes achtergronden.
              </p>
            </LiquidGlass>
          </div>
        </section>
      ))}
    </div>
  );
}

export default GlasShowcase;
