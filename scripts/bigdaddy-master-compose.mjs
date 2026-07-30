// Bouwt `bigdaddy-master.webp` uit het onderdelenblad `bigdaddy-onderdelen.webp`
// (#834).
//
// Het onderdelenblad is het oudere Big Daddy-ringartwork: dezelfde kroon, wolken,
// ballonnen, linten, teddy, pluchen ster en het gevleugelde hartmedaillon, al met
// een schoon alfakanaal. Die ring hing als één dichte krans óm de kaart, waardoor
// het gouden frame links en rechts volledig verdween en de kroon een derde van
// het kaartvlak bedekte. `docs/referentie_big_daddy.png` doet het omgekeerd: het
// frame blijft rondom leesbaar en de objecten raken het frame alleen plaatselijk.
//
// Dit script snijdt de objecten daarom los uit het blad en zet ze terug op de
// posities die de referentie aanhoudt, gemeten als fractie van het kaartvlak.
// Daardoor is de compositie reproduceerbaar en navolgbaar: elke plaatsing hier
// heeft een meetbare tegenhanger in de referentie.
//
// Gebruik:
//   node scripts/bigdaddy-master-compose.mjs [--preview]
//
// `--preview` zet er bovendien een keurplaat naast (donkere achtergrond, het
// kaartvlak als kader) in de scratch-map die je meegeeft via PREVIEW_UIT.

import { fileURLToPath } from "node:url";
import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const ASSETS = resolve(here, "../src/features/rating/components/bigdaddy/assets");
const BLAD = resolve(ASSETS, "bigdaddy-onderdelen.webp");
const DOEL = resolve(ASSETS, "bigdaddy-master.webp");

// Het onderdelenblad.
const BLAD_B = 1024;
const BLAD_H = 1536;

// Het mastercanvas in kaartmaten. De kaart heeft aspect 100/139; het canvas
// hangt links/rechts 20% en boven 22% / onder 14% buiten de kaart. Die marges
// zijn precies de --bigdaddy-master-*-waarden in BigDaddyEffect.css.
const KAART_B = 914;
const KAART_H = Math.round((KAART_B * 139) / 100); // 1270
const MARGE_L = 0.2;
const MARGE_T = 0.22;
const CANVAS_B = Math.round(KAART_B * 1.4); // 1280
const CANVAS_H = Math.round(KAART_H * 1.36); // 1727
const KAART_X = Math.round(KAART_B * MARGE_L); // 183
const KAART_Y = Math.round(KAART_H * MARGE_T); // 279

/** Kaartfractie → canvaspixel. u langs de kaartbreedte, v langs de kaarthoogte. */
const px = (u) => Math.round(KAART_X + u * KAART_B);
const py = (v) => Math.round(KAART_Y + v * KAART_H);

/** Bladprocent → bladpixel. */
const bx = (p) => Math.round((BLAD_B * p) / 100);
const by = (p) => Math.round((BLAD_H * p) / 100);

// De compositie, van achter naar voor. Per onderdeel:
//   snee   [x0, y0, x1, y1] in procenten van het onderdelenblad
//   naar   { u, v, b } linkerbovenhoek + breedte als kaartfractie (hoogte volgt
//          uit de beeldverhouding van de snee, dus geen vervorming)
//   veer   [links, boven, rechts, onder] in sneepixels: hoeveel van die rand
//          naar transparant uitdooft. Zonder veer eindigt de gloed van een snee
//          in een zichtbare rechte rand.
//   masker optioneel SVG-pad in sneecoördinaten dat het object vrijstelt
//   waas   optionele blur (px) op de maskerrand
//   voor   welk deel van dit onderdeel vóór het frame mag komen: `true` voor het
//          hele object, of een lijst vakken in onderdeelfracties
//          ({ x0, y0, x1, y1 }) om er maar een paar partijen uit te lichten.
//          Hieruit genereert dit script `bigdaddy-front-mask.svg`, zodat het
//          frontmasker niet los van de compositie kan verlopen.
//   kleur  optionele { verzadiging, helderheid } — het onderdelenblad is aan de
//          wolkzijde bleker dan de referentie; een kleine correctie zet die
//          weer in het roze van de rest van de compositie
//   spiegel/alfa/hoek optioneel
const VEER = 46;
const HEEL = [{ x0: 0, y0: 0, x1: 1, y1: 1 }];
const ONDERDELEN = [
  {
    naam: "rook-links",
    // Magenta rook met goudstof langs de linkerflank. In de referentie is de
    // ruimte tussen wolk, ballon en teddy nooit zwart: er hangt altijd waas.
    // Halftransparant en achteraan, dus het blijft achtergrond.
    snee: [0, 38, 20, 76],
    naar: { u: -0.19, v: 0.14, b: 0.3 },
    masker:
      "M 100 20 C 160 40 196 140 190 320 C 196 500 170 620 110 656 C 40 660 4 560 8 360 C 4 160 40 30 100 20 Z",
    waas: 30,
    alfa: 0.62,
  },
  {
    naam: "wolk-links",
    // Wolkenmassa linksboven. In de referentie kijkt die maar een klein stuk
    // links buiten de kaart uit en blijft hij ónder de bovenrand hangen.
    snee: [9, 9, 25, 27],
    naar: { u: -0.17, v: -0.19, b: 0.36 },
    // Deze snee ligt midden in de wolkenmassa en is dus overal dekkend: een
    // veer alleen zou er een zachte rechthoek van maken. Het gelobde silhouet
    // geeft de snede weer een wolkcontour; de lobben in het artwork zelf doen
    // de rest.
    masker:
      "M 8 150 C 8 96 38 72 62 84 C 70 42 118 38 130 76 C 158 64 178 92 172 132 C 180 182 168 238 140 260 C 96 278 38 266 16 232 C 2 208 2 176 8 150 Z",
    waas: 22,
    kleur: { verzadiging: 1.55, helderheid: 0.9 },
  },
  {
    naam: "wolk-rechts",
    // Wolk tussen kroonpunt en ballonnen; vult de rechterbovenhoek achter het
    // frame.
    snee: [72, 7, 87, 28],
    naar: { u: 0.58, v: -0.13, b: 0.3 },
    masker:
      "M 6 142 C 4 92 30 64 56 78 C 66 38 112 36 124 74 C 152 74 158 108 150 148 C 158 208 142 270 112 294 C 70 312 22 292 10 250 C 0 214 2 174 6 142 Z",
    waas: 22,
    kleur: { verzadiging: 1.4, helderheid: 0.94 },
  },
  {
    naam: "ballonnen",
    // Hartballon, gouden sterballon en de strik met linten: hangt over de
    // rechterbovenhoek, net als in de referentie.
    snee: [77, 2, 100, 40],
    naar: { u: 0.76, v: -0.23, b: 0.28 },
    veer: [VEER, 20, 20, VEER],
    voor: HEEL,
  },
  {
    naam: "hart-ballon-links",
    // Dezelfde hartballon gespiegeld op halve kaarthoogte links — het tweede
    // ballonaccent uit de referentie.
    snee: [80, 2, 97, 17],
    naar: { u: -0.13, v: 0.26, b: 0.22 },
    spiegel: true,
    veer: [16, 16, 40, 40],
    voor: HEEL,
  },
  {
    naam: "lint-rechts",
    // De rechterflank in één stuk: satijnlint, strikstaarten, pluchen ster en
    // de neonharten. Eén snee houdt hun onderlinge lichtlogica intact.
    snee: [67, 26, 100, 80],
    naar: { u: 0.82, v: 0.12, b: 0.38 },
    veer: [VEER, VEER, 30, VEER],
    // Boven- en sterpartij ervóór, het middenstuk erachter: zo weeft het satijn
    // zichtbaar om het frame heen in plaats van er als sjaal over te liggen.
    voor: [
      { x0: 0, y0: 0, x1: 1, y1: 0.3 },
      { x0: 0, y0: 0.56, x1: 1, y1: 1 },
    ],
  },
  {
    naam: "kroon",
    // De kroon staat op de bovenrand: alleen de punten en de topfleur komen
    // boven het frame uit, de band rust op het frame.
    snee: [23, 1, 73, 26],
    naar: { u: 0.29, v: -0.14, b: 0.42 },
    voor: HEEL,
    masker:
      "M 232 0 C 262 -6 292 14 292 60 L 300 150 C 340 96 372 118 386 156 C 404 96 448 96 462 150 C 470 220 482 268 496 300 L 500 372 C 380 400 132 400 20 372 L 26 296 C 44 264 52 214 58 150 C 78 96 118 96 134 156 C 150 116 182 96 220 150 Z",
    waas: 10,
  },
  {
    naam: "teddy",
    // De volledige gekroonde teddy met cape en hartstaf, plus het lint dat
    // linksonder onder hem doorloopt. Nooit halveren: hij hoort als één
    // leesbaar object op de buitenflank.
    snee: [0, 63, 32, 99],
    naar: { u: -0.2, v: 0.39, b: 0.38 },
    veer: [16, VEER, VEER, VEER],
    voor: HEEL,
  },
  {
    naam: "lint-onder-rechts",
    snee: [58, 76, 100, 100],
    naar: { u: 0.62, v: 0.8, b: 0.48 },
    veer: [VEER, VEER, 24, VEER],
    voor: [{ x0: 0, y0: 0.24, x1: 1, y1: 1 }],
  },
  {
    naam: "lint-onder-links",
    // Gespiegelde lintpartij: in de referentie loopt het satijn ook linksonder
    // langs de schildpunt door, anders eindigt de compositie daar abrupt.
    snee: [62, 88, 90, 100],
    naar: { u: -0.15, v: 0.81, b: 0.42 },
    spiegel: true,
    veer: [VEER, VEER, VEER, VEER],
    voor: [{ x0: 0.3, y0: 0.1, x1: 1, y1: 1 }],
  },
  {
    naam: "medaillon",
    // Het gevleugelde hartmedaillon in de schildpunt.
    snee: [24, 80, 66, 100],
    naar: { u: 0.27, v: 0.87, b: 0.37 },
    veer: [VEER, VEER, VEER, 24],
    voor: HEEL,
  },
];

/** Vloeiende 0→1-overgang; smoothstep houdt de veerrand vrij van een bandje. */
const soepel = (t) => {
  const k = Math.min(1, Math.max(0, t));
  return k * k * (3 - 2 * k);
};

/** Vermenigvuldigt het alfakanaal van een RGBA-buffer met een factor per pixel.
 *  Bewust met de hand: sharps `dest-in` liet de gemaskeerde randen in dit
 *  pijplijntje ongemoeid, en een verkeerd gemaskeerd onderdeel valt pas op de
 *  kaart op. */
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

  if (o.kleur) {
    // Verzadiging/helderheid met de hand: sharps `modulate` gooit in dit
    // pijplijntje het alfakanaal plat, waardoor het onderdeel als dichte
    // rechthoek op de master zou landen.
    const s = o.kleur.verzadiging ?? 1;
    const h = o.kleur.helderheid ?? 1;
    for (let i = 0; i < rgba.length; i += 4) {
      if (rgba[i + 3] === 0) continue;
      const luma = 0.2126 * rgba[i] + 0.7152 * rgba[i + 1] + 0.0722 * rgba[i + 2];
      for (let k = 0; k < 3; k += 1) {
        const v = (luma + (rgba[i + k] - luma) * s) * h;
        rgba[i + k] = v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
      }
    }
  }

  if (o.veer) {
    // Per rand naar binnen uitdoven. Zonder dit eindigt de rook/gloed van een
    // snee in een rechte lijn en leest het onderdeel als een opgeplakt vierkant.
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
    // Silhouetmasker: SVG-pad in sneecoördinaten, met een zachte rand zodat het
    // object niet met een scherpe knip uit zijn omgeving wordt gelicht.
    const waas = o.waas ?? 8;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><path d="${o.masker}" fill="#fff"/></svg>`;
    const grijs = await sharp(Buffer.from(svg))
      .blur(waas)
      .extractChannel(3)
      .raw()
      .toBuffer();
    rgba = schaalAlfa(rgba, width, height, (x, y) => grijs[y * width + x] / 255);
  }

  if (o.alfa != null) {
    rgba = schaalAlfa(rgba, width, height, () => o.alfa);
  }

  let buf = await sharp(rgba, { raw: { width, height, channels: 4 } })
    .png()
    .toBuffer();

  if (o.spiegel) buf = await sharp(buf).flop().png().toBuffer();

  const doelB = Math.round(o.naar.b * KAART_B);
  const doelH = Math.round((doelB * height) / width);
  buf = await sharp(buf)
    .resize({ width: doelB, height: doelH, fit: "fill" })
    .png()
    .toBuffer();

  if (o.hoek) {
    buf = await sharp(buf)
      .rotate(o.hoek, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
  }

  return {
    laag: { input: buf, left: px(o.naar.u), top: py(o.naar.v) },
    vak: { x: px(o.naar.u), y: py(o.naar.v), b: doelB, h: doelH },
  };
}

const lagen = [];
const vakken = [];
for (const o of ONDERDELEN) {
  const { laag, vak } = await bouwOnderdeel(o);
  lagen.push(laag);
  if (o.voor) vakken.push({ naam: o.naam, vak, voor: o.voor });
}

const master = await sharp({
  create: {
    width: CANVAS_B,
    height: CANVAS_H,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
})
  .composite(lagen)
  .png()
  .toBuffer();

await sharp(master).webp({ quality: 80, alphaQuality: 90 }).toFile(DOEL);
console.log(`${DOEL} — ${CANVAS_B}x${CANVAS_H}`);

// ── De twee maskers volgen uit dezelfde geometrie ──────────────────────────────
// Ze zijn afgeleid, geen handwerk: een frontmasker dat niet met de compositie
// meeschuift, laat een object halveren of legt juist de kaartinhoud toe.

/** Afgeronde rechthoek als pad; de radius houdt de occlusie organisch. */
const bolVak = (x, y, b, h) => {
  const r = Math.round(Math.min(b, h) * 0.3);
  return `M${x + r} ${y} H${x + b - r} Q${x + b} ${y} ${x + b} ${y + r} V${y + h - r} Q${x + b} ${y + h} ${x + b - r} ${y + h} H${x + r} Q${x} ${y + h} ${x} ${y + h - r} V${y + r} Q${x} ${y} ${x + r} ${y} Z`;
};

const frontPaden = vakken.flatMap(({ naam, vak, voor }) =>
  voor.map((s) => {
    const x = Math.round(vak.x + s.x0 * vak.b);
    const y = Math.round(vak.y + s.y0 * vak.h);
    const b = Math.round((s.x1 - s.x0) * vak.b);
    const h = Math.round((s.y1 - s.y0) * vak.h);
    // Iets ruimer dan het onderdeel: de zachte maskerrand mag de gloed rond het
    // object niet afknippen, want dan ontstaat er tóch een rechte kant.
    const marge = Math.round(Math.min(b, h) * 0.06);
    return `    <!-- ${naam} -->\n    <path d="${bolVak(x - marge, y - marge, b + 2 * marge, h + 2 * marge)}" />`;
  }),
);

const frontSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS_B} ${CANVAS_H}">
  <!-- Gegenereerd door scripts/bigdaddy-master-compose.mjs — niet met de hand
       bijwerken. Elke vorm hoort bij een onderdeel met een \`voor\`-selectie:
       complete objecten mogen vóór het frame komen, de wolken en het middenstuk
       van het rechterlint blijven eronder. -->
  <defs>
    <filter id="soft" x="-10%" y="-10%" width="120%" height="120%">
      <feGaussianBlur stdDeviation="12" />
    </filter>
  </defs>
  <g fill="#fff" filter="url(#soft)">
${frontPaden.join("\n")}
  </g>
</svg>
`;
await writeFile(resolve(ASSETS, "bigdaddy-front-mask.svg"), frontSvg);

// Het binnenmasker is de omgekeerde vorm: alleen de randgebonden feestwaas mag
// in het schild, het midden blijft vrij voor rating, avatar, naam en editie.
const holte = {
  x: px(0.09),
  y: py(0.1),
  b: Math.round(0.82 * KAART_B),
  h: Math.round(0.8 * KAART_H),
};
const insideSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS_B} ${CANVAS_H}">
  <!-- Gegenereerd door scripts/bigdaddy-master-compose.mjs — niet met de hand
       bijwerken. Eén pad met fill-rule="evenodd": CSS-maskers lezen de alfa, dus
       een zwart vlak zou hier niets verbergen. -->
  <defs>
    <filter id="soft" x="-8%" y="-8%" width="116%" height="116%">
      <feGaussianBlur stdDeviation="30" />
    </filter>
  </defs>
  <path fill="#fff" fill-rule="evenodd" filter="url(#soft)"
    d="M${px(-0.06)} ${py(-0.04)} H${px(1.06)} V${py(1.04)} H${px(-0.06)} Z
       ${bolVak(holte.x, holte.y, holte.b, holte.h)}" />
</svg>
`;
await writeFile(resolve(ASSETS, "bigdaddy-inside-mask.svg"), insideSvg);
console.log("maskers bijgewerkt");

if (process.argv.includes("--preview")) {
  const uit = process.env.PREVIEW_UIT ?? resolve(here, "../bigdaddy-preview.png");
  const kader = `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_B}" height="${CANVAS_H}"><rect x="${KAART_X}" y="${KAART_Y}" width="${KAART_B}" height="${KAART_H}" fill="none" stroke="#33ffdd" stroke-width="4" stroke-dasharray="18 12"/></svg>`;
  await sharp({
    create: {
      width: CANVAS_B,
      height: CANVAS_H,
      channels: 4,
      background: "#120a12",
    },
  })
    .composite([{ input: master }, { input: Buffer.from(kader) }])
    .png()
    .toFile(uit);
  console.log(uit);
}
