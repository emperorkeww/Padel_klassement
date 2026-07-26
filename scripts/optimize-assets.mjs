// Assets comprimeren vóór ze de repo in gaan (#732).
//
// De illustraties en audio kwamen als ruwe AI-output binnen: PNG's van ~2 MB
// op 1254px terwijl ze op 66px getoond worden, en MP3's met een ingebedde
// albumcover van 1,6 MB. Samen was dat 33 MB in dist/assets.
//
// Dit script doet de conversie eenmalig en reproduceerbaar, zodat een nieuwe
// Rudi-avatar (CoachAvatar.tsx pikt elk bestand in rudi_avatars/ automatisch op)
// niet opnieuw als 2 MB binnenkomt. Bewust géén build-plugin: dan blijft de
// zware bron in src staan en betaalt elke build en elke worktree ervoor.
//
// Gebruik:
//   node scripts/optimize-assets.mjs src/features/coach/components/rudi_avatars/rudi-nieuw.png
//   node scripts/optimize-assets.mjs --behoud-bron src/.../dictator-portret-groen-uniform.png
//
// Vereist ImageMagick (`magick`) en ffmpeg op het PATH.

import { execFileSync } from "node:child_process";
import { existsSync, statSync, unlinkSync } from "node:fs";
import { basename } from "node:path";

// Presets per soort asset. De breedte is ~3× de grootste weergavegrootte, zodat
// het ook op een 3×-DPR-scherm scherp blijft zonder onzinnige overhead.
const PRESETS = {
  // Coach Rudy's koppen: grootste weergave is 66px (CoachIntro).
  avatar: { breedte: 384, kwaliteit: 80 },
  // Dictator-illustraties: het troonkader is max 280px bij 4/5.
  troon: { breedte: 1000, kwaliteit: 78 },
  // Los bronmateriaal dat (nog) niet in de UI hangt: ruimer bewaren.
  illustratie: { breedte: 1200, kwaliteit: 80 },
};

function preset(pad) {
  if (pad.includes("rudi_avatars")) return PRESETS.avatar;
  if (basename(pad).startsWith("dictator-portret-groen-uniform")) {
    return PRESETS.troon;
  }
  return PRESETS.illustratie;
}

const MB = (bytes) => `${(bytes / 1048576).toFixed(2)} MB`;

function beeld(pad, behoudBron) {
  const { breedte, kwaliteit } = preset(pad);
  const doel = pad.replace(/\.(png|jpe?g)$/i, ".webp");
  const voor = statSync(pad).size;
  // `>` in de geometrie: nooit opschalen als de bron al kleiner is.
  execFileSync("magick", [
    pad,
    "-resize",
    `${breedte}x${breedte}>`,
    "-quality",
    String(kwaliteit),
    doel,
  ]);
  if (!behoudBron) unlinkSync(pad);
  return { doel, voor, na: statSync(doel).size };
}

function audio(pad) {
  const tijdelijk = `${pad}.tmp.mp3`;
  const voor = statSync(pad).size;
  // -map 0:a + -vn gooit de ingebedde cover eruit (1,6 MB in het volkslied);
  // mono op 96 kbps is ruim genoeg voor een loopend grapfragment.
  execFileSync("ffmpeg", [
    "-y",
    "-v",
    "error",
    "-i",
    pad,
    "-map",
    "0:a",
    "-vn",
    "-ac",
    "1",
    "-b:a",
    "96k",
    tijdelijk,
  ]);
  execFileSync("mv", [tijdelijk, pad]);
  return { doel: pad, voor, na: statSync(pad).size };
}

const args = process.argv.slice(2);
const behoudBron = args.includes("--behoud-bron");
const paden = args.filter((a) => !a.startsWith("--"));

if (paden.length === 0) {
  console.error(
    "Geef één of meer bestanden op.\n" +
      "  node scripts/optimize-assets.mjs <bestand.png|bestand.mp3> [--behoud-bron]",
  );
  process.exit(1);
}

let totaalVoor = 0;
let totaalNa = 0;
for (const pad of paden) {
  if (!existsSync(pad)) {
    console.error(`overgeslagen (bestaat niet): ${pad}`);
    continue;
  }
  const res = /\.mp3$/i.test(pad) ? audio(pad) : beeld(pad, behoudBron);
  totaalVoor += res.voor;
  totaalNa += res.na;
  const pct = Math.round((1 - res.na / res.voor) * 100);
  console.log(`${res.doel}: ${MB(res.voor)} → ${MB(res.na)} (−${pct}%)`);
}
console.log(`\ntotaal: ${MB(totaalVoor)} → ${MB(totaalNa)}`);
