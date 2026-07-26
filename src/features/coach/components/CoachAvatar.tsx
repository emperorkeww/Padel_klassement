import { useState } from "react";
import type { CoachMood } from "@/features/coach/roastTone";
import "./CoachAvatar.css";

export type { CoachMood };

// Het vaste gezicht van Coach Rudy (#211): een handgetekende illustratie op élk
// coach-oppervlak (feed-bubble, profiel, kennismaking, dashboard, …).
//
// De illustraties staan als losse afbeeldingen in ./rudi_avatars/ met de
// conventie  rudi-<stemming>[-<n>].<ext>  :
//   - <stemming>  matcht een CoachMood (portret | trots | mild | gemeen |
//     radioactief) en koppelt zo de illustratie aan de aard van de reactie.
//   - optioneel -<n>  laat meerdere varianten binnen één stemming cyclen.
// Bv. rudi-portret.png, rudi-gemeen.png, rudi-gemeen-2.png.
//
// Vite pakt ze allemaal op via import.meta.glob en bundelt ze (gehashte URL's),
// dus zodra je een bestand toevoegt/hernoemt volgens de conventie doet het
// automatisch mee — geen code aanpassen nodig. Haal een nieuwe illustratie wél
// eerst door `node scripts/optimize-assets.mjs <bestand>`: de originelen waren
// PNG's van ~2 MB op 1254px voor een koppie dat maximaal 66px groot wordt
// getoond (#732).
const modules = import.meta.glob("./rudi_avatars/*.{png,jpg,jpeg,webp}", {
  eager: true,
  import: "default",
  query: "?url",
}) as Record<string, string>;

const DEFAULT_MOOD: CoachMood = "portret";

// Leid de stemming af uit de bestandsnaam (het stuk direct na "rudi-", zonder de
// optionele -<n>-variant). Onbekende/afwijkende namen vallen op portret terug.
function moodOf(path: string): string {
  const file = path.split("/").pop() ?? "";
  const m = file.match(/^rudi-([a-z]+)/i);
  return m ? m[1].toLowerCase() : DEFAULT_MOOD;
}

// Het variantnummer uit de -<n>-suffix; de basisnaam (zonder suffix) telt als 0
// en komt dus altijd eerst. Zo blijft de "vaste" keuze (bv. rudi-portret.png op
// de ontmoetingsbanner) de basis-illustratie, ook als je later varianten toevoegt.
function variantOf(path: string): number {
  const file = path.split("/").pop() ?? "";
  const m = file.match(/^rudi-[a-z]+-(\d+)/i);
  return m ? parseInt(m[1], 10) : 0;
}

// Groepeer alle illustraties per stemming, gesorteerd op variantnummer (basis
// eerst), zodat de cyclus en de vaste keuze stabiel/voorspelbaar zijn.
const BY_MOOD: Record<string, string[]> = {};
for (const path of Object.keys(modules)) {
  const mood = moodOf(path);
  (BY_MOOD[mood] ??= []).push(path);
}
for (const mood of Object.keys(BY_MOOD)) {
  BY_MOOD[mood] = BY_MOOD[mood]
    .sort((a, b) => variantOf(a) - variantOf(b) || a.localeCompare(b))
    .map((path) => modules[path]);
}

// Per stemming een teller: opeenvolgende avatars van dezelfde stemming pakken de
// vólgende variant, zodat ze netjes door de set cyclen i.p.v. overal hetzelfde
// koppie te tonen.
const counters: Record<string, number> = {};

function pick(mood: CoachMood, fixed: boolean): string {
  const pool = BY_MOOD[mood]?.length ? BY_MOOD[mood] : BY_MOOD[DEFAULT_MOOD];
  if (!pool || pool.length === 0) return "";
  // Vaste plekken (bv. de ontmoetingsbanner) tonen altijd dezelfde illustratie.
  if (fixed) return pool[0];
  const i = counters[mood] ?? 0;
  counters[mood] = i + 1;
  return pool[i % pool.length];
}

export function CoachAvatar({
  size = 28,
  mood = DEFAULT_MOOD,
  fixed = false,
  className,
}: {
  /** Diameter in px. */
  size?: number;
  /** Welke reactie het icoon uitbeeldt; kiest de bijpassende illustratie. */
  mood?: CoachMood;
  /** Altijd dezelfde illustratie van deze stemming (geen cyclus) — voor vaste
   *  plekken zoals de ontmoetingsbanner. */
  fixed?: boolean;
  className?: string;
}) {
  // Eén keuze per mount: stabiel over re-renders, maar wél variatie tussen
  // losse avatars dankzij de module-teller.
  const [src] = useState(() => pick(mood, fixed));

  return (
    <span
      className={`coach-avatar${className ? ` ${className}` : ""}`}
      style={{ width: size, height: size }}
    >
      {src ? (
        <img
          className="coach-avatar__img"
          src={src}
          width={size}
          height={size}
          alt="Coach Rudy"
          loading="lazy"
          decoding="async"
        />
      ) : null}
    </span>
  );
}

export default CoachAvatar;
