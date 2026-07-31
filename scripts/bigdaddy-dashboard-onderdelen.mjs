// Snijdt de artwork-onderdelen van de Big Daddy-dashboardkaart uit het
// onderdelenblad `bigdaddy-onderdelen.webp` (#834).
//
// Gebruik:
//   node scripts/bigdaddy-dashboard-onderdelen.mjs [--preview]
//
// Waarom niet één master zoals bij de FUT-kaart: die kaart heeft een vaste
// verhouding (100 : 139), dus daar kan één gedeelde transform alle lagen
// registreren. De dashboardkaart is vloeiend — breedte volgt de viewport,
// hoogte volgt de inhoud — en is op desktop 2,1 : 1 en op een telefoon 0,6 : 1.
// Eén master zou daar vervormen of uit de hoeken lopen. Dit is dus de aanpak van
// `glazenwasser-onderdelen.py`: élk onderdeel een eigen, strak op zijn alfa
// bijgesneden WebP, dat los wordt geschaald en aan één rand of hoek verankerd.
//
// Twee regels die dat oplegt, en die uit de kaartdocs komen:
//
//   - een snee die midden in een massa ligt is overal dekkend; alleen uitdoven
//     van de randen maakt daar een zachte rechthoek van. Zo'n snee krijgt een
//     gelobd silhouetmasker;
//   - het bijsnijden gebeurt ná veer en masker, op de alfa zelf. Een onderdeel
//     met een transparante rand eromheen zou zijn eigen anker verschuiven zodra
//     het opnieuw wordt gesneden.
//
// Het script schrijft naast de WebP's een manifest met de natuurlijke maat van
// elk onderdeel. De layout leest dat manifest, zodat een opnieuw gesneden asset
// zonder bijgewerkte layout in de tests omvalt in plaats van op een screenshot.

import { fileURLToPath } from "node:url";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const BLAD = resolve(
  here,
  "../src/features/rating/components/bigdaddy/assets/bigdaddy-onderdelen.webp",
);
const UIT = resolve(here, "../src/features/dashboard/components/bigdaddy/assets");
const MANIFEST = resolve(
  here,
  "../src/features/dashboard/components/bigdaddy/onderdelen.json",
);

// Het onderdelenblad.
const BLAD_B = 1024;
const BLAD_H = 1536;

/** Bladprocent → bladpixel. */
const bx = (p) => Math.round((BLAD_B * p) / 100);
const by = (p) => Math.round((BLAD_H * p) / 100);

// Per onderdeel:
//   snee    [x0, y0, x1, y1] in procenten van het onderdelenblad
//   breedte doelbreedte in pixels — twee keer de grootste maat waarop de CSS het
//           onderdeel ooit toont (`clamp()`-bovengrens), zodat het op een
//           retina-scherm scherp blijft en geen byte zwaarder is dan dat
//   veer    [links, boven, rechts, onder] in sneepixels: hoeveel van die rand
//           naar transparant uitdooft
//   masker  optioneel SVG-pad in sneecoördinaten dat het object vrijstelt
//   waas    blur (px) op de maskerrand
const ONDERDELEN = [
  {
    naam: "medaillon",
    // Het gevleugelde hartmedaillon met strik. In de referentie ligt het twee
    // keer op de middenas: bovenop de bovenrand en onderaan op de onderrand.
    snee: [28, 79, 68, 99.5],
    breedte: 320,
    veer: [26, 20, 26, 14],
  },
  {
    naam: "teddy",
    // De volledige gekroonde teddy met cape en hartstaf. Nooit halveren: hij
    // hoort als één leesbaar object op de flank — dezelfde eis als op de
    // FUT-kaart, waar een masker op halve hoogte hem doormidden knipte.
    snee: [0, 66.5, 28, 94],
    breedte: 420,
    // De cape raakt de linkerrand van het blad, dus dáár is het object zelf al
    // afgesneden. Een smalle veer maakt van die snede een zichtbare rechte kant
    // op de kaart; een brede laat hem oplossen.
    veer: [30, 34, 30, 22],
  },
  {
    naam: "hoekhart",
    // De topfleur van de kroon: een geslepen hart in een gouden zetting. Dat is
    // hetzelfde juweel dat de referentie in de hoeken en als hangertje aan de
    // rechterflank gebruikt — één snee, drie plekken.
    snee: [41.5, 1.5, 58.5, 11.5],
    breedte: 260,
    veer: [14, 10, 14, 16],
  },
  {
    naam: "lint-flank",
    // De satijnwikkel van de rechterflank. Hij weeft: het bovenstuk ligt vóór
    // de lijst, het midden erachter. Daarom wordt hij twee keer gerenderd — één
    // keer in het kaartvlak, één keer in de voorlaag met een masker — uit
    // dezelfde bron en op hetzelfde anker.
    snee: [79, 30.5, 100, 62],
    breedte: 300,
    veer: [30, 26, 16, 40],
  },
  {
    naam: "lint-bodem",
    // De lintlus die in de referentie onder de teddy vandaan langs de onderrand
    // loopt, en gespiegeld in de rechteronderhoek. Bewust de vláttere passage
    // onderaan het blad: een lus die even hoog is als breed wordt op een kaart
    // van 2 : 1 een torentje in de hoek in plaats van een sleep langs de rand.
    // De snee blijft tussen de
    // teddy en het medaillon: een onderdeel dat zelf al een asset is, hoort niet
    // in de uitsnede van zijn buurman — anders staat er straks een tweede
    // teddypoot in de hoek.
    snee: [15, 91.5, 40, 99.5],
    breedte: 460,
    veer: [26, 20, 26, 10],
  },
];

/** Vloeiende 0→1-overgang; smoothstep houdt de veerrand vrij van een bandje. */
const soepel = (t) => {
  const k = Math.min(1, Math.max(0, t));
  return k * k * (3 - 2 * k);
};

/** Vermenigvuldigt het alfakanaal van een RGBA-buffer met een factor per pixel.
 *  Met de hand, om dezelfde reden als in bigdaddy-master-compose.mjs: sharps
 *  `dest-in` liet de gemaskeerde randen in dit pijplijntje ongemoeid. */
function schaalAlfa(rgba, breedte, hoogte, factor) {
  for (let y = 0; y < hoogte; y += 1) {
    for (let x = 0; x < breedte; x += 1) {
      const i = (y * breedte + x) * 4 + 3;
      if (rgba[i] === 0) continue;
      const f = factor(x, y);
      rgba[i] = f >= 1 ? rgba[i] : Math.round(rgba[i] * f);
    }
  }
  return rgba;
}

/** Kleinste rechthoek waarin de alfa nog meetelt. De drempel ligt bewust net
 *  boven nul: de geveerde rand loopt naar 0 en een bbox op `> 0` zou de hele
 *  snee teruggeven, inclusief de lucht die we net hebben weggeveerd. */
function alfaVak(rgba, breedte, hoogte, drempel = 6) {
  let x0 = breedte;
  let y0 = hoogte;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < hoogte; y += 1) {
    for (let x = 0; x < breedte; x += 1) {
      if (rgba[(y * breedte + x) * 4 + 3] < drempel) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) throw new Error("onderdeel is volledig transparant");
  return { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}

async function bouwOnderdeel(o) {
  const [x0, y0, x1, y1] = o.snee;
  const left = bx(x0);
  const top = by(y0);
  const width = bx(x1) - left;
  const height = by(y1) - top;

  const { data } = await sharp(BLAD)
    .extract({ left, top, width, height })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let rgba = data;

  if (o.veer) {
    const [l, t, r, b] = o.veer;
    rgba = schaalAlfa(rgba, width, height, (x, y) =>
      Math.min(
        l ? soepel(x / l) : 1,
        t ? soepel(y / t) : 1,
        r ? soepel((width - 1 - x) / r) : 1,
        b ? soepel((height - 1 - y) / b) : 1,
      ),
    );
  }

  if (o.masker) {
    const waas = o.waas ?? 8;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><path d="${o.masker}" fill="#fff"/></svg>`;
    const grijs = await sharp(Buffer.from(svg))
      .blur(waas)
      .extractChannel(3)
      .raw()
      .toBuffer();
    rgba = schaalAlfa(rgba, width, height, (x, y) => grijs[y * width + x] / 255);
  }

  // Strak bijsnijden op de alfa: het onderdeel is vanaf hier zijn eigen doos, en
  // de CSS verankert die doos aan een rand of hoek.
  const vak = alfaVak(rgba, width, height);
  const doelH = Math.max(1, Math.round((o.breedte * vak.height) / vak.width));
  const buf = await sharp(rgba, { raw: { width, height, channels: 4 } })
    .extract(vak)
    .resize({ width: o.breedte, height: doelH, fit: "fill" })
    .webp({ quality: 80, alphaQuality: 90 })
    .toBuffer();

  await writeFile(resolve(UIT, `bd-${o.naam}.webp`), buf);
  return {
    naam: o.naam,
    bestand: `bd-${o.naam}.webp`,
    breedte: o.breedte,
    hoogte: doelH,
    kb: +(buf.length / 1024).toFixed(1),
  };
}

await mkdir(UIT, { recursive: true });
const manifest = [];
for (const o of ONDERDELEN) manifest.push(await bouwOnderdeel(o));

await writeFile(
  MANIFEST,
  `${JSON.stringify(
    {
      _: "Gegenereerd door scripts/bigdaddy-dashboard-onderdelen.mjs — niet met de hand bijwerken.",
      onderdelen: manifest.map(({ kb: _kb, ...rest }) => rest),
    },
    null,
    2,
  )}\n`,
);

const totaal = manifest.reduce((som, m) => som + m.kb, 0);
for (const m of manifest)
  console.log(`${m.bestand.padEnd(22)} ${m.breedte}×${m.hoogte}  ${m.kb} kB`);
console.log(`totaal ${totaal.toFixed(1)} kB`);

if (process.argv.includes("--preview")) {
  // Keurplaat: alle onderdelen naast elkaar op een donkere achtergrond, zodat
  // een rechte snederand of een halve gloed meteen opvalt.
  const uit = process.env.PREVIEW_UIT ?? resolve(here, "../bd-dashboard-preview.png");
  const H = 460;
  const delen = [];
  let x = 20;
  for (const m of manifest) {
    const b = Math.round((m.breedte * H) / m.hoogte);
    delen.push({
      input: await sharp(resolve(UIT, m.bestand))
        .resize({ height: H })
        .png()
        .toBuffer(),
      left: x,
      top: 20,
    });
    x += b + 20;
  }
  await sharp({
    create: { width: x, height: H + 40, channels: 4, background: "#241018" },
  })
    .composite(delen)
    .png()
    .toFile(uit);
  console.log(uit);
}
