import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";

// Bundelbudget (#732). De illustraties en audio kwamen als ruwe AI-output
// binnen — 33 MB in dist/assets, waarvan 21 MB alleen al aan avatars die op
// 66px getoond worden. Na de conversie naar WebP en mono-audio zit dat rond de
// 6 MB; deze test bewaakt dat het niet stilletjes terugkruipt.
//
// Draait alleen ná een build; CI bouwt vóór `npm test`.
// Nieuwe assets comprimeren met: node scripts/optimize-assets.mjs <bestand>
//
// Het pad via een variabele opbouwen: de letterlijke vorm
// `new URL("…", import.meta.url)` herkent Vite als asset-referentie en
// herschrijft hij naar een http-URL, waar fileURLToPath op stukloopt.
const pad = (p: string) => fileURLToPath(new URL(p, import.meta.url));
const ASSETS = pad("../../../dist/assets");

// Ruime marge boven de huidige ~9,0 MB: genoeg lucht voor een nieuwe route of
// een handvol avatars, krap genoeg om één ongecomprimeerde 2 MB-PNG te vangen.
// Verhoogd van 8 naar 9 bij de pias-breakout en van 9 naar 10 toen de
// Ballenraper-master erbij kwam. Bij de Glazenwasser ging hij eerst naar 11,
// maar dat bleek te ruim: nadat de master zijn kaartvlak leeg kreeg (de tekst
// wordt eroverheen getekend) zakte hij van 0,35 naar 0,19 MB en staat het
// geheel op 9,99 MB. Terug naar 10,5 — genoeg lucht voor een volgende master,
// krap genoeg om er een te vangen die niet gecomprimeerd is. Het
// grote-kaartartwork (gw-frame.webp e.a.) telt hier níét in mee: dat hangt achter
// een DEV-only route en valt bij een productiebuild weg. De kaarteffect-masters (dictator, on fire,
// storm, big daddy, ballenraper, wannabe, goat, pias, piet, blaaskaak) zijn
// samen ~2,6 MB en zijn de enige structurele groei sinds #732. Ze staan al op
// hun compressiegrens (WebP met alpha, 600–1024 px breed); zakt er nog meer
// resolutie af, dan wordt het artwork zichtbaar zacht op een 450px-kaart. De
// per-bestandsgrens hieronder blijft het echte vangnet voor ongecomprimeerde
// bronbestanden.
//
// Stand na de In-Form-dashboardkaart (#834): 10,48 MB, dus nog 19 kB lucht. Die
// twee onderdelen (242 kB) zijn al teruggesneden tot de `clamp()`-bovengrens van
// hun eigen CSS — 600 px voor een kolom die op de breedste layout (940 px) 432 px
// toont. De huisregel "snij op twee keer de toonmaat, voor retina" is daarmee
// bewust losgelaten; verder squeezen kost zichtbare scherpte en levert kilobytes
// op. Wie hierna iets toevoegt hoort dus déze grens te verhogen, niet dat
// artwork nog kleiner te maken.
//
// Zo gebeurd bij de QR op de speeldagposter (#886): de encoder
// (qrcode-generator, ~22 kB) paste niet meer in die 19 kB lucht. Geen artwork
// dus maar code, en daarmee de eerste post die niet terug te snijden valt door
// harder te comprimeren. Verhoogd naar 10,6 MB — ruim 100 kB lucht, nog altijd
// krap genoeg om één ongecomprimeerde PNG te vangen.
//
// Die 100 kB bleek er niet te zijn: `develop` stond op 10,5992 MB, dus 800 byte
// onder de grens. Daarmee liet elke volgende PR — ook een van vijf regels — de
// build struikelen op een budget dat over artwork gaat, niet over code. De
// aankondigingsregio van #924 (~600 byte) was de eerste die er tegenaan liep.
// Nu 10,75 MB, met ~150 kB echte lucht. Meet de stand vóór het verhogen; de
// tekst hierboven ging uit van een reserve die er niet was.
//
// Die ~150 kB was er alwéér niet: `main` stond gemeten op 10,7171 MB, dus 33 kB
// onder de grens — de raming ging uit van de stand op het moment van verhogen en
// niet van wat er daarna nog bij kwam. De release erna liep er meteen tegenaan,
// 8,6 kB over. Opbouw van die 42,3 kB groei, gemeten door de assetlijsten van
// main en develop naast elkaar te leggen:
//   glazenwasser.webp   +39,9 kB  (herbouwde FUT-kaart, PR #1040)
//   AdminPaneel.js/.css  +8,1 kB  (adminpaneel #1036, een lazy route)
//   index.css/compare.js -5,7 kB  netto
// Het artwork is dus opnieuw de post die telt, en die staat al op zijn
// compressiegrens. Nu 11,0 MB, gemeten vanaf 10,7584 MB: ~248 kB echte lucht,
// nog steeds ruim onder de per-bestandsgrens die een ongecomprimeerde bron vangt.
// Voor de volgende die dit leest: méét, en verhoog vanaf de gemeten stand — niet
// vanaf de vorige grens.
//
// En weer: die 248 kB was 2,4 kB. `develop` stond gemeten op 10,9977 MB, dus de
// stemkaart van #1196 (netto +3,2 kB: Dashboard.js +1,8, StemRij.js/.css +1,6,
// Dashboard.css +0,6, Agenda -1,1 — de rij verhuisde naar een eigen chunk) liep
// er als eerste tegenaan. Weer code, geen artwork. Nu 11,1 MB, gemeten vanaf
// 11,0009 MB: ~100 kB lucht, en dit keer is dat een meting en geen raming.
const TOTAAL_MAX_MB = 11.1;
// Bovengrens per bestand: de twee audiofragmenten (2,14 MB) zijn de zwaarste
// die hier thuishoren.
const BESTAND_MAX_MB = 2.5;

const MB = (bytes: number) => bytes / 1024 / 1024;

describe.skipIf(!existsSync(ASSETS))("bundelbudget dist/assets", () => {
  const bestanden = existsSync(ASSETS)
    ? readdirSync(ASSETS).map((naam) => ({
        naam,
        mb: MB(statSync(`${ASSETS}/${naam}`).size),
      }))
    : [];

  it("blijft als geheel onder het budget", () => {
    const totaal = bestanden.reduce((som, b) => som + b.mb, 0);
    expect(bestanden.length).toBeGreaterThan(0);
    expect(totaal).toBeLessThan(TOTAAL_MAX_MB);
  });

  it("bevat geen enkel bestand boven de bovengrens", () => {
    const teZwaar = bestanden
      .filter((b) => b.mb > BESTAND_MAX_MB)
      .map((b) => `${b.naam} (${b.mb.toFixed(2)} MB)`);
    expect(teZwaar).toEqual([]);
  });
});
