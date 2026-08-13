// WCAG-contrastcheck voor de token-paren van het lichte én donkere thema.
// Parseert src/app/index.css (:root en :root[data-theme="dark"]) en rekent de
// relevante tekst/vlak-combinaties door. Faalt (exit 1) zodra een paar onder
// zijn drempel komt: 4.5 voor normale tekst, 3.0 voor groot/UI.
//
// Gebruik: node scripts/contrast-check.mjs

import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/app/index.css", import.meta.url), "utf8");

function tokensOf(block) {
  const out = {};
  for (const m of block.matchAll(/--([\w-]+):\s*([^;]+);/g)) {
    out[m[1]] = m[2].trim();
  }
  return out;
}

const rootBlock = css.match(/:root\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
const darkBlock = css.match(/:root\[data-theme="dark"\]\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
// Eén niveau var()-indirectie oplossen, zodat een token dat naar een ander
// token wijst (--focus-ring: var(--lime)) ook gemeten wordt en niet stil
// wegvalt. Per thema, want de verwijzing wijst per thema een andere kant op.
function resolve(tokens) {
  const out = { ...tokens };
  for (const [k, v] of Object.entries(out)) {
    const ref = /^var\((--[\w-]+)\)$/.exec(v);
    if (ref) out[k] = out[ref[1].slice(2)] ?? v;
  }
  return out;
}

const light = resolve(tokensOf(rootBlock));
const dark = resolve({ ...tokensOf(rootBlock), ...tokensOf(darkBlock) });

// Een kleurwaarde → [r, g, b, a] in 0–255 / 0–1. Kent hex (#rgb, #rrggbb) en
// rgb()/rgba(). Tot #1074 kende het script alleen hex, en sloeg het al het
// andere stilletjes over — precies de randen en overlays die op donker de
// hiërarchie dragen, dus die vielen buiten de bewaking.
function parseColor(value) {
  const v = value.trim();
  if (v.startsWith("#")) {
    const h = v.slice(1);
    const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h;
    if (full.length !== 6) return null;
    return [...[0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)), 1];
  }
  const m = /^rgba?\(([^)]+)\)$/.exec(v);
  if (!m) return null;
  const parts = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
  if (parts.length < 3 || parts.some(Number.isNaN)) return null;
  return [parts[0], parts[1], parts[2], parts[3] ?? 1];
}

/** Een half-doorzichtige kleur op zijn ondergrond leggen (alpha-compositing). */
function composite(fg, bg) {
  if (fg[3] >= 1) return fg;
  return [0, 1, 2].map((i) => fg[i] * fg[3] + bg[i] * (1 - fg[3])).concat(1);
}

function luminanceOf(rgb) {
  const [r, g, b] = rgb.slice(0, 3).map((c) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function luminance(hex) {
  return luminanceOf(parseColor(hex) ?? [0, 0, 0, 1]);
}

/** Waarneembare lichtheid (CIE L*, 0–100) — de maat voor vlak-op-vlak. */
function lightness(value) {
  const Y = luminance(value);
  return Y > 216 / 24389 ? 116 * Math.cbrt(Y) - 16 : (24389 / 27) * Y;
}

function contrast(fg, bg) {
  const bgRgb = parseColor(bg);
  const fgRgb = parseColor(fg);
  if (!bgRgb || !fgRgb) return 0;
  // Een doorzichtige voorgrond (rand, overlay) meet je op zijn ondergrond.
  const [a, b] = [luminanceOf(composite(fgRgb, bgRgb)), luminanceOf(bgRgb)].sort(
    (x, y) => y - x,
  );
  return (a + 0.05) / (b + 0.05);
}

// [voorgrond, achtergrond, drempel, omschrijving]
const PAIRS = [
  ["ink", "bg", 4.5, "tekst op app-achtergrond"],
  ["ink", "surface", 4.5, "tekst op kaart"],
  ["ink", "surface-2", 4.5, "tekst op subtiel vlak"],
  ["ink-soft", "bg", 4.5, "gedempte tekst op achtergrond"],
  ["ink-soft", "surface", 4.5, "gedempte tekst op kaart"],
  ["ink-soft-strong", "surface-2", 4.5, "kleine tekst op surface-2 (badges)"],
  ["placeholder", "surface", 4.5, "placeholder in invoerveld"],
  ["accent", "surface", 4.5, "accent als tekst/link op kaart"],
  ["accent-ink", "accent", 4.5, "knoptekst op accentknop"],
  ["accent-ink", "accent-hover", 4.5, "knoptekst op de knop onder de muis"],
  ["accent-ink", "accent-strong", 4.5, "knoptekst op de ingedrukte knop"],
  ["lef", "surface", 4.5, "lef-tekst op kaart"],
  ["lef-ink", "lef", 4.5, "knoptekst op ingezette lef-knop"],
  ["dorst", "surface", 4.5, "traktatie-tekst op kaart (#1004)"],
  ["dorst", "dorst-soft", 4.5, "traktatie-tekst op dorstvlak (#1004)"],
  ["dorst-ink", "dorst", 4.5, "knoptekst op ingeloste traktatie-knop (#1004)"],
  ["joker", "surface", 4.5, "joker-tekst op kaart (#1003)"],
  ["joker-ink", "joker", 4.5, "kaarttekst op gespeelde joker (#1003)"],
  ["success", "surface", 4.5, "winst-tekst op kaart"],
  ["danger", "surface", 4.5, "verlies-tekst op kaart"],
  ["danger", "danger-soft", 4.5, "verlies-tekst op verliesvlak"],
  ["coach-diep", "coach-soft", 4.5, "coach/bounty-tekst op coachvlak (#941)"],
  // De open-poll-stip in het maandraster (#1112). Grafisch merkteken, dus 3:1 —
  // maar hij ligt op twee vlakken: een lege dag (--surface) en een dag met
  // speeldagen (--surface-2). Beide moeten kloppen.
  ["poll", "surface", 3.0, "open-poll-stip op de rasterkaart (#1112)"],
  ["poll", "surface-2", 3.0, "open-poll-stip op een dag met speeldagen (#1112)"],
  ["poll-diep", "poll-soft", 4.5, "tekst van de open-poll-chip (#1112)"],
  // Tier-badges (#1264). Stonden hier op 3,0 als "groot/UI", maar .tier-badge
  // zet --fs-xs (12px) bold en WCAG rekent pas vanaf 18,66px bold als large
  // text: de drempel is dus 4,5. Zes van deze paren stonden daardoor groen
  // terwijl ze onder AA zaten. Brons en zilver ontbraken hier compleet.
  // Alle elf tier-vlakken zijn dekkend gebleven (zie de toelichting in
  // index.css: een tier-badge staat óók op kaart-artwork, en daar laat een
  // tint het artwork door). De vijf die hier ontbreken — platina, diamant,
  // meester, legende, dictator — worden in de soft-sectie hieronder gemeten,
  // samen met de rest van de familie, zodat hun drempel op één plek staat.
  ["slof", "slof-soft", 4.5, "slof-tierbadge (12px bold)"],
  ["karton", "karton-soft", 4.5, "karton-tierbadge (12px bold)"],
  ["hout", "hout-soft", 4.5, "hout-tierbadge (12px bold)"],
  ["bronze", "bronze-soft", 4.5, "brons-tierbadge (12px bold)"],
  ["silver", "silver-soft", 4.5, "zilver-tierbadge (12px bold)"],
  ["gold", "gold-soft", 4.5, "goud-badge (12px bold)"],
  ["lime-deep", "surface", 3.0, "lime-tekstaccent (groot/UI)"],
  // De gekozen spelerspil (#1183). De vulling was dekkend; sinds #1264 is hij
  // op donker een tint van --accent/--lime, dus de spelersnaam-op-pil wordt nu
  // in de soft-sectie gemeten — daar staat --ink als inhoud van beide vlakken.
  // Team A's badge is wit op --accent en staat hierboven al als "knoptekst op
  // accentknop" (4,36 op licht — bekend en geaccepteerd, zie #1074).
  ["lime-ink", "lime-deep", 4.5, "teambadge B op de gekozen pil (#1183)"],
  ["cat-rank", "surface", 3.0, "feed-categorie klassement (groot/UI)"],
  ["cat-champ", "surface", 3.0, "feed-categorie kampioen (groot/UI)"],
  ["cat-roast", "surface", 3.0, "feed-categorie roast (groot/UI)"],
  ["sidebar-ink", "sidebar-bg", 4.5, "navigatielabels"],
  ["sidebar-ink-strong", "sidebar-bg", 4.5, "actief navigatielabel"],
  // Nieuwe surface-rollen (#1074): wat er op de verhoogde en gekozen vlakken
  // staat, moet daar net zo goed leesbaar zijn als op een gewone kaart.
  ["ink", "surface-elevated", 4.5, "tekst op verhoogd vlak (hero, sheets)"],
  ["ink-soft", "surface-elevated", 4.5, "gedempte tekst op verhoogd vlak"],
  ["ink", "surface-hover", 4.5, "tekst op een vlak onder de muis"],
  ["sidebar-ink-strong", "surface-active", 4.5, "label van het gekozen nav-item"],
  ["lime", "surface-active", 4.5, "icoon van het gekozen nav-item"],
  ["accent", "surface-elevated", 4.5, "accent als tekst/link op de hero"],
  ["focus-ring", "surface", 3.0, "focusring op een kaart (groot/UI)"],
  ["focus-ring", "bg", 3.0, "focusring op de achtergrond (groot/UI)"],
  ["focus-ring", "sidebar-bg", 3.0, "focusring in de navigatie (groot/UI)"],
  ["focus-ring", "surface-active", 3.0, "focusring op een gekozen nav-item"],
  // Ratinggrafiek (#1074). De lijn is een UI-element, dus 3,0; de tooltip
  // draagt lopende tekst en een gekleurd delta-cijfer.
  ["chart-up", "surface", 3.0, "stijgende ratinglijn op de kaart (groot/UI)"],
  ["chart-down", "surface", 3.0, "dalende ratinglijn op de kaart (groot/UI)"],
  ["tip-ink", "tip-bg", 4.5, "tekst in de grafiek-tooltip"],
  ["lime", "tip-bg", 3.0, "stijging in de grafiek-tooltip"],
  ["danger-bright", "tip-bg", 3.0, "daling in de grafiek-tooltip"],
  ["toast-ink", "success", 3.0, "toast-tekst op succes-toast (groot/UI)"],
  ["toast-ink", "danger", 4.5, "toast-tekst op fout-toast (blijft staan)"],
  ["toast-ink", "ink", 4.5, "toast-tekst op info-toast"],
  // Omgekeerd paneel (#1089): de speelformaat-kaart draait de pagina om, dus
  // alles wat erop staat heeft een eigen ondergrond en valt buiten de
  // surface-paren hierboven. De actieve tab is het eerste paar omgekeerd — het
  // paneel als tekst op --paneel-om-ink — en heeft dus geen eigen regel nodig.
  ["paneel-om-ink", "paneel-om", 4.5, "titel en waarden op het omgekeerde paneel"],
  ["paneel-om-ink-soft", "paneel-om", 4.5, "beschrijving op het omgekeerde paneel"],
  ["paneel-om-label", "paneel-om", 4.5, "meta-label op het omgekeerde paneel"],
  ["paneel-om-ink-soft", "paneel-om-vlak", 4.5, "inactieve tab op het omgekeerde paneel"],
  ["paneel-om-ink", "paneel-om-vlak", 4.5, "rondegetal en stappers op het geneste vlak"],
  ["lime", "paneel-om", 4.5, "aanbevolen-badge op het omgekeerde paneel"],
  ["lime-ink", "lime", 4.5, "knoptekst op de lime CTA"],
  ["lime-ink", "lime-hover", 4.5, "knoptekst op de lime CTA onder de aanwijzer"],
  // Segmentbalk (#1255): .tabs en .login-tabs staan op het track-paar.
  ["ink-soft", "track", 4.5, "inactieve tab op de segmentbalk (#1255)"],
  ["ink", "track-actief", 4.5, "actieve tab, segment-variant (#1255)"],
  ["accent", "track-actief", 4.5, "actieve tab, pill-variant (#1255)"],
];

// Licht is de bestaande huisstijl: tekorten daar zijn bekend en rapporteren we
// als waarschuwing (aanpakken = bewuste designwijziging, zie issue #74/#125).
// Het donkere thema is nieuw en moet wél hard aan AA voldoen.
let darkFailures = 0;
for (const [name, tokens, strict] of [
  ["licht", light, false],
  ["donker", dark, true],
]) {
  console.log(`\n— Thema: ${name}${strict ? "" : " (informatief)"} —`);
  for (const [fg, bg, min, label] of PAIRS) {
    const f = tokens[fg];
    const b = tokens[bg];
    if (!f || !b || !parseColor(f) || !parseColor(b)) continue;
    const c = contrast(f, b);
    const ok = c >= min;
    if (!ok && strict) darkFailures++;
    console.log(
      `${ok ? "  ok  " : strict ? "  FAIL" : "  let-op"} ${c.toFixed(2).padStart(5)} ≥ ${min}  ${fg} op ${bg} (${label})`,
    );
  }
}

// ---- Surface-ladder (#1074) ----
// Vlak-op-vlak is een andere vraag dan tekst-op-vlak, en de WCAG-verhouding is
// er het verkeerde gereedschap voor: vlak bij zwart domineert de +0,05 in de
// formule, waardoor twee duidelijk verschillende donkere vlakken altijd rond
// 1,1:1 uitkomen. Daarom meten we hier de waarneembare lichtheid (CIE L*): een
// stap van ±4 L* is met het blote oog te zien, ook onderin het bereik.
//
// Dit is precies de categorie die vóór #1074 ontbrak — de tekstparen hierboven
// stonden ruim op groen terwijl kaart, pagina en zijbalk in elkaar overliepen.
// [lichter, donkerder, minimale stap in L*, omschrijving]
const LADDER = [
  ["surface", "bg", 4, "kaart tilt op van de pagina"],
  // Sinds de OLED-omslag (#1243) zijn pagina en zijbalk op donker béíde puur
  // zwart: de pixels gaan echt uit, en de scheiding komt van de zijbalkrand
  // (rgba-wit) en het baanfoto-verloop in DashboardLayout.css — niet van een
  // lichtheidsstap. Het minimum staat daarom op 0 ("mag samenvallen, maar de
  // zijbalk mag nooit lichter worden dan de pagina"); op licht was deze regel
  // altijd al informatief.
  ["bg", "sidebar-bg", 0, "navigatie zakt weg onder de pagina (of valt samen)"],
  ["surface-2", "surface", 3, "subtiel vlak binnen een kaart"],
  ["surface-elevated", "surface", 3, "verhoogd vlak (hero, sheets)"],
  ["surface-hover", "surface", 4, "hover is voelbaar"],
  ["surface-active", "surface", 4, "gekozen item is voelbaar"],
  // Opeenvolgende stappen (#1255). Alles tegen --surface meten liet de drie
  // bovenste niveaus binnen 4,3 L* van elkaar kruipen: elk haalde ruim zijn
  // minimum tegen de kaart terwijl sheet, hover en subtiel vlak onderling
  // hetzelfde vlak waren. Op licht zijn deze twee informatief én misleidend
  // om een andere reden: daar dónkert hover juist (wit → grijs), dus de stap
  // is daar negatief by design.
  ["surface-elevated", "surface-2", 3, "verhoogd vlak boven het subtiele vlak (#1255)"],
  ["surface-hover", "surface-elevated", 3, "hover boven het verhoogde vlak (#1255)"],
  ["line", "surface", 6, "kaartrand is zichtbaar"],
  ["line-strong", "surface", 12, "sterke rand is duidelijk"],
  ["divider", "surface", 3, "separator blijft zwakker dan een kaartrand"],
  ["border-elevated", "surface-elevated", 6, "rand van een verhoogd vlak"],
];

for (const [name, tokens, strict] of [
  ["licht", light, false],
  ["donker", dark, true],
]) {
  console.log(`\n— Surface-ladder: ${name}${strict ? "" : " (informatief)"} —`);
  for (const [hi, lo, min, label] of LADDER) {
    const a = tokens[hi];
    const b = tokens[lo];
    if (!a || !b || !parseColor(a) || !parseColor(b)) continue;
    const d = lightness(a) - lightness(b);
    const ok = d >= min;
    if (!ok && strict) darkFailures++;
    console.log(
      `${ok ? "  ok  " : strict ? "  FAIL" : "  let-op"} ${d.toFixed(1).padStart(5)} L* ≥ ${min}  ${hi} boven ${lo} (${label})`,
    );
  }
}

// ---- Randen op een ratio (#1264) ----
// De ladder hierboven meet randen op L*, en dat is voor een grens de verkeerde
// maat: --line stond ruim 15 L* boven de kaart (ruim door de ladderregel) en
// tegelijk op 1,6:1 (ruim onvoldoende), --divider zelfs op 1,1:1. WCAG 1.4.11
// vraagt 3:1 voor een grens die betekenis draagt — en een kaart die vooral
// dankzij zijn rand bestaat, valt daaronder. De L*-regels blijven staan; ze
// meten iets anders (de waarneembare stap tussen twee vlakken, niet de
// zichtbaarheid van een lijn). De drager is hier geen keuze maar een feit: een
// kaartrand ligt tussen de kaart en de pagina, dus hij moet tegen béíde
// bestaan. Ontbrekende tokens zijn een harde fout, geen stille overslag.
// [rand, drager, minimale ratio, omschrijving]
const RANDEN = [
  ["line", "surface", 3.0, "kaartrand tegen de kaart (1.4.11)"],
  ["line", "bg", 3.0, "kaartrand tegen de pagina (1.4.11)"],
  ["border-elevated", "surface-elevated", 3.0, "rand van een verhoogd vlak (1.4.11)"],
];
// De divider is bewust géén 3:1-grens: hij scheidt rijen bínnen een kaart en
// moet zwakker blijven dan de kaartrand. Onzichtbaar mag hij niet zijn, dus een
// ondergrens plus de eis dat hij onder --line blijft.
const DIVIDER_MIN = 1.4;

let randFailures = 0;
console.log("\n— Randen: ≥3:1 op hun drager, WCAG 1.4.11 (donker) —");
for (const [rand, drager, min, label] of RANDEN) {
  const f = dark[rand];
  const b = dark[drager];
  if (!f || !b || !parseColor(f) || !parseColor(b)) {
    console.error(`  FAIL ${rand} of ${drager} ontbreekt of is onleesbaar`);
    randFailures++;
    continue;
  }
  const c = contrast(f, b);
  const ok = c >= min;
  if (!ok) randFailures++;
  console.log(
    `  ${ok ? "ok  " : "FAIL"} ${c.toFixed(2).padStart(5)} ≥ ${min}  ${rand} op ${drager} (${label})`,
  );
}
{
  const d = contrast(dark["divider"], dark["surface"]);
  const l = contrast(dark["line"], dark["surface"]);
  const ok = d >= DIVIDER_MIN && d < l;
  if (!ok) randFailures++;
  console.log(
    `  ${ok ? "ok  " : "FAIL"} ${d.toFixed(2).padStart(5)} ≥ ${DIVIDER_MIN} én < ${l.toFixed(2)}  divider op surface (zichtbaar, zwakker dan de kaartrand)`,
  );
}

// ---- Betekenisdragende grenzen, in béíde thema's (#1273) ----
// De sectie hierboven rekent alleen op donker: de lichte randen zijn oude
// schuld die te groot is om hier in één keer om te gooien. Voor een lijn die
// niet decoratief is maar het enige verschil tússen twee items, is dat te
// weinig — in het lichte thema stond de scheiding in de meldingenlijst op
// 1,22:1 en viel de rij-indeling volledig op witruimte terug. Zulke lijnen
// krijgen een eigen token en worden hier in beide thema's hard getoetst.
// [rand, drager, minimale ratio, omschrijving]
const GRENZEN = [
  ["melding-scheiding", "surface", 3.0, "scheiding tussen twee meldingen (1.4.11)"],
];

console.log("\n— Betekenisdragende grenzen: ≥3:1, beide thema's —");
for (const [rand, drager, min, label] of GRENZEN) {
  for (const [naam, tokens] of [
    ["licht", light],
    ["donker", dark],
  ]) {
    const f = tokens[rand];
    const b = tokens[drager];
    if (!f || !b || !parseColor(f) || !parseColor(b)) {
      console.error(`  FAIL ${rand} of ${drager} ontbreekt in thema ${naam}`);
      randFailures++;
      continue;
    }
    const c = contrast(f, b);
    const ok = c >= min;
    if (!ok) randFailures++;
    console.log(
      `  ${ok ? "ok  " : "FAIL"} ${c.toFixed(2).padStart(5)} ≥ ${min}  ${rand} op ${drager}, thema ${naam} (${label})`,
    );
  }
}

// ---- Plafond op het meubilair (#1264) ----
// De ladder hierboven kent alleen ondergrenzen, en die zijn met omhoog
// schuiven altijd te halen: sinds #1255 kroop elk niveau een stap op tot de
// app een zwarte pagina met een dikke bleke band erbovenop was. Diepte en
// contrast zijn hier dezelfde knop — elk vlak dat zakt geeft zijn voorgronden
// gratis ruimte — dus krijgt de ladder er een dak bij: het lichtste vlak waar
// gewone content op staat blijft onder L* 19. Boven dat punt verliest het
// zwart eronder zijn werk en zakken de tekstparen mee.
// Alleen donker: op licht is "zo licht mogelijk" juist het uitgangspunt.
const PLAFOND_MAX = 19;
const PLAFOND = ["surface", "surface-2", "surface-elevated", "surface-hover", "surface-active", "track", "track-actief"];

let plafondFailures = 0;
console.log(`\n— Plafond: meubilair blijft onder L* ${PLAFOND_MAX} (donker) —`);
for (const k of PLAFOND) {
  const v = dark[k];
  if (!v || !parseColor(v)) {
    console.error(`  FAIL ${k} ontbreekt of is onleesbaar`);
    plafondFailures++;
    continue;
  }
  const l = lightness(v);
  const ok = l <= PLAFOND_MAX;
  if (!ok) plafondFailures++;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${l.toFixed(1).padStart(5)} L* ≤ ${PLAFOND_MAX}  ${k}`);
}

// ---- Richtingsregel (#1255) ----
// Sommige tokenparen drukken een hiërarchie uit die in béíde thema's dezelfde
// kant op moet wijzen. Dat is precies wat de ladder hierboven níet vangt: die
// meet per thema tegen een vast referentievlak, en ziet het dus niet als twee
// tokens tussen licht en donker stilletjes van volgorde wisselen. Zo werd het
// actieve segment op de segmentbalk een gat: --surface lag op licht bóven
// --surface-2 en op donker erónder. Deze regel is in beide thema's hard —
// een omkering is per definitie een bug, geen bekende licht-schuld.
// [lichter, donkerder, minimale stap in L*, omschrijving]
const RICHTING = [
  ["track-actief", "track", 3, "actief segment ligt op de track"],
];

let richtingFailures = 0;
console.log("\n— Richtingsregel: zelfde hiërarchie in beide thema's —");
for (const [hi, lo, min, label] of RICHTING) {
  for (const [name, tokens] of [
    ["licht", light],
    ["donker", dark],
  ]) {
    const a = tokens[hi];
    const b = tokens[lo];
    if (!a || !b || !parseColor(a) || !parseColor(b)) {
      console.error(`  FAIL ${hi} of ${lo} ontbreekt in thema ${name}`);
      richtingFailures++;
      continue;
    }
    const d = lightness(a) - lightness(b);
    const ok = d >= min;
    if (!ok) richtingFailures++;
    console.log(
      `  ${ok ? "ok  " : "FAIL"} ${d.toFixed(1).padStart(5)} L* ≥ ${min}  ${hi} boven ${lo}, thema ${name} (${label})`,
    );
  }
}

// ---- Soft-vlakken op donker (#1255, herzien in #1264) ----
// Een badge ligt op wisselende dragers — kaart, subtiel vlak, sheet — en mag
// op géén daarvan donkerder zijn dan wat eronder ligt: dat leest als een gat
// (les uit #1074). #1255 goot dat in één regel: "boven het hover-niveau", de
// lichtste drager die er is. Dat werkte, maar dwong de hele familie omhoog en
// als gelijkheid uitgevoerd werd het een plateau — 22 van de 23 op
// L* 21,9-22,2, en daarmee het lichtste meubilair in de app.
//
// #1264 splitst de familie naar mechanisme:
//
//   Tint  — een halfdoorzichtige kleur uit de eigen familie. Die ligt per
//           definitie boven élke drager, dus de eis "boven de lichtste" is
//           overbodig; in plaats daarvan meten we hem óp elke drager: de
//           tekst van de familie moet er overal zijn drempel halen, en de
//           composiet moet zijn kleur nog dragen.
//   Plaat — een dekkende hex, voor families die te gedempt zijn om als waas
//           kleur te dragen (een 15%-waas van --slof over bijna-zwart komt op
//           C* 1 uit). Die moeten wél boven hun lichtste drager liggen.
//
// Plus een plateau-toets: nooit meer dan twee soft-vlakken op dezelfde hoogte.
// Alleen donker: op licht liggen de softs juist ónder de witte kaart — daar
// is "donkerder dan de drager" de normale richting.
// Let op bij uitbreiden: dit selecteert op naam. -soft-tokens die tekst zijn
// in plaats van vlak (--ink-soft) horen in de uitzonderingslijst.
function chromaOf(value) {
  const rgb = parseColor(value);
  if (!rgb) return 0;
  const [r, g, b] = rgb.slice(0, 3).map((c) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  const X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const Y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return Math.hypot(500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z)));
}

// Tekst, geen vlak — die horen niet in deze sectie. Alles wat op -ink-soft
// eindigt is per definitie inkt (ook de kaart-eilanden, die hun eigen sectie
// hebben).
const SOFT_TEKST = new Set(["ink-soft", "paneel-om-ink-soft"]);
const isSoftTekst = (k) => SOFT_TEKST.has(k) || k.endsWith("-ink-soft");
// De dragers waar een soft-vlak in de praktijk op ligt. De hoverstaat staat er
// bewust niet bij: een badge in een gehoverde rij schuift mee omhoog, en bij
// een tint gebeurt dat vanzelf.
const SOFT_DRAGERS = ["surface", "surface-2", "surface-elevated"];
// Welke tekst er op zo'n vlak staat, met zijn drempel. Zonder dit zou een tint
// alleen op chroma getoetst worden — en juist de leesbaarheid is de reden dat
// de alfa niet hoger mag.
const SOFT_INHOUD = {
  "accent-soft": [["accent", 4.5], ["ink", 4.5]],
  "lime-soft": [["lime-deep", 4.5], ["ink", 4.5]],
  "lef-soft": [["lef", 4.5]],
  "joker-soft": [["joker", 4.5]],
  "success-soft": [["success", 4.5]],
  "warn-soft": [["warn", 4.5]],
  "danger-soft": [["danger", 4.5]],
  "coach-soft": [["coach-diep", 4.5]],
  "poll-soft": [["poll-diep", 4.5]],
  "dorst-soft": [["dorst", 4.5]],
  "slof-soft": [["slof", 4.5]],
  "karton-soft": [["karton", 4.5]],
  "hout-soft": [["hout", 4.5]],
  "bronze-soft": [["bronze", 4.5]],
  "silver-soft": [["silver", 4.5]],
  "gold-soft": [["gold", 4.5]],
  "platina-soft": [["platina", 4.5]],
  "diamant-soft": [["diamant", 4.5]],
  "meester-soft": [["meester", 4.5]],
  "legende-soft": [["legende", 4.5]],
  "dictator-soft": [["dictator", 4.5]],
  "bigdaddy-soft": [["bigdaddy", 4.5]],
};

let softFailures = 0;
console.log("\n— Soft-vlakken: tint op élke drager, plaat boven zijn drager (donker) —");
const softHoogtes = [];
{
  const dragers = SOFT_DRAGERS.map((d) => parseColor(dark[d]));
  const lichtsteDrager = Math.max(...SOFT_DRAGERS.map((d) => lightness(dark[d])));
  for (const [k, v] of Object.entries(dark)) {
    const isSoft = k.endsWith("-soft") && !isSoftTekst(k);
    const isAvatar = /^avatar-h\d-bg$/.test(k);
    const rgba = parseColor(v);
    if ((!isSoft && !isAvatar) || !rgba) continue;
    const tint = rgba[3] < 1;
    const inhoud = SOFT_INHOUD[k] ?? [];
    const vlakken = tint ? dragers.map((d) => composite(rgba, d)) : [rgba];
    const hex = (c) => `rgb(${c.slice(0, 3).map(Math.round).join(",")})`;
    const cs = vlakken.map((c) => chromaOf(hex(c)));
    const ls = vlakken.map((c) => lightness(hex(c)));
    const rs = inhoud.flatMap(([t, min]) =>
      vlakken.map((c) => contrast(dark[t], hex(c)) / min),
    );
    const okC = Math.min(...cs) >= 8;
    const okR = rs.length === 0 || Math.min(...rs) >= 1;
    // Een dekkende plaat moet boven de lichtste drager liggen; een tint niet,
    // want die schuift met zijn drager mee.
    const okL = tint || ls[0] >= lichtsteDrager + 1.5;
    if (!okC || !okR || !okL) softFailures++;
    // De avatar-achtergronden staan bewust op één hoogte: acht hues op
    // dezelfde lichtheid, dát is hun onderscheid. Zij tellen niet mee in de
    // plateau-toets, de badge-vlakken wel.
    if (!isAvatar) softHoogtes.push({ k, L: ls[0] });
    console.log(
      `  ${okC && okR && okL ? "ok  " : "FAIL"} ${(tint ? "tint " : "plaat").padEnd(5)} L* ${ls[0].toFixed(1).padStart(5)}${tint ? `→${ls.at(-1).toFixed(1)}` : "     "}  C* ${Math.min(...cs).toFixed(1).padStart(5)} ≥ 8  tekst ${(rs.length ? Math.min(...rs).toFixed(2) : "—").padStart(5)}× drempel  ${k}`,
    );
  }
  // Plateau-toets: het probleem van #1255 was niet één te licht vlak maar de
  // vlakke familie. Drie vlakken binnen een halve L* is geen hiërarchie meer.
  softHoogtes.sort((a, b) => a.L - b.L);
  for (let i = 0; i + 2 < softHoogtes.length; i++) {
    if (softHoogtes[i + 2].L - softHoogtes[i].L <= 0.5) {
      console.log(
        `  FAIL plateau: ${softHoogtes[i].k}, ${softHoogtes[i + 1].k} en ${softHoogtes[i + 2].k} liggen binnen 0,5 L*`,
      );
      softFailures++;
    }
  }
}

// ---- ΔE-afstand tussen accentrollen (#1255) ----
// Op donker zitten vrijwel alle accenten in dezelfde lichtheidsband
// (L* 58-79): lichtheid onderscheidt niets meer, kleur is het enige signaal.
// Twee tokens die iets ánders betekenen maar vrijwel dezelfde kleur hebben,
// zijn dan onzichtbaar verwisseld — chem-laag las als danger, een gehoverde
// knop als success, en acht rollen deelden één amber.
//
// Dit is een gecureerde lijst, geen alle-paren-matrix: alleen paren met
// verschíllende betekenis die samen in beeld kunnen staan. Bewust níet
// opgenomen: tokens uit dezelfde familie (accent vs accent-hover), de
// tier-ladder onderling (karton naast hout is een bewúst doorlopende
// materiaalreeks) en paren die elkaar nooit op hetzelfde scherm treffen.
// Wie een nieuw accenttoken toevoegt: zet zijn buren hier bij.
// ΔE₇₆ ≥ 10 — ruwweg "duidelijk verschillend bij aandachtig kijken".
function labOf(value) {
  const rgb = parseColor(value);
  if (!rgb) return null;
  const [r, g, b] = rgb.slice(0, 3).map((c) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  const X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const Y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}
const DELTA_MIN = 10;
const DELTA_PAREN = [
  // Semantiek vs look-alikes: status mag nooit verward worden met decoratie.
  ["success", "chem-hoog"], ["success", "accent"], ["success", "accent-hover"],
  ["danger", "chem-laag"], ["danger", "legende"], ["danger", "cat-roast"],
  ["warn", "coach"], ["warn", "poll"], ["warn", "dorst"], ["warn", "dictator"],
  ["warn", "dictator-gold"], ["warn", "cat-champ"], ["warn", "effect-inzet"],
  ["warn", "chem-midden"], ["warn", "gold"], ["warn", "lime"],
  // De voormalige ambergroep: acht rollen, elk een eigen laan.
  ["coach", "poll"], ["coach", "dorst"], ["coach", "dictator"],
  ["coach", "cat-champ"], ["coach", "effect-inzet"], ["coach", "chem-midden"],
  ["coach", "chem-laag"],
  ["poll", "dorst"], ["poll", "dictator"], ["poll", "cat-champ"],
  ["poll", "effect-inzet"], ["poll", "chem-midden"],
  ["dorst", "dictator"], ["dorst", "cat-champ"], ["dorst", "chem-midden"],
  ["dorst", "karton"], ["dorst", "gold"],
  // Brons kwam in #1264 mee omhoog en landde daarmee in dezelfde warme band;
  // zijn buren horen daarom vanaf nu bewaakt.
  ["dorst", "bronze"], ["coach", "bronze"], ["poll", "hout"],
  ["dictator", "cat-champ"], ["dictator-gold", "effect-inzet"],
  ["dictator-gold", "cat-champ"],
  ["cat-champ", "chem-midden"], ["cat-champ", "gold"], ["cat-champ", "effect-inzet"],
  ["coach-diep", "poll-diep"],
  // Roze, violet en blauw: één look-alike per hoek.
  ["bigdaddy", "cat-roast"], ["bigdaddy", "legende"],
  ["lef", "meester"], ["effect-lef", "meester"],
  ["joker", "platina"], ["cat-rank", "diamant"], ["cat-rank", "joker"],
  ["chem-hoog", "accent"], ["chem-hoog", "accent-hover"], ["chem-hoog", "platina"],
];

let deltaFailures = 0;
console.log("\n— ΔE tussen accentrollen (donker) —");
for (const [a, b] of DELTA_PAREN) {
  const la = labOf(dark[a]);
  const lb = labOf(dark[b]);
  if (!la || !lb) {
    console.error(`  FAIL ${a} of ${b} ontbreekt of is geen kleur`);
    deltaFailures++;
    continue;
  }
  const d = Math.hypot(la[0] - lb[0], la[1] - lb[1], la[2] - lb[2]);
  const ok = d >= DELTA_MIN;
  if (!ok) deltaFailures++;
  console.log(
    `  ${ok ? "ok  " : "FAIL"} dE ${d.toFixed(1).padStart(5)} ≥ ${DELTA_MIN}  ${a} ~ ${b}`,
  );
}

// ---- Token-eilanden van de dashboard player card (#771) ----
// De thema's van de kaart herdefiniëren de neutrale tokens naar hun eigen
// materiaal (papier, karton, speelkaart). Die hexen staan buiten index.css en
// vielen dus buiten deze check: hun contrast stond alleen als getal in het
// CSS-commentaar, met de hand uitgerekend. Sinds #771 rekent het script mee.
//
// De achtergrond is telkens de dónkerste stop van het verloop — de ongunstigste
// plek op het vlak, waar de tekst tot onderaan doorloopt. Deze eilanden zijn
// bewust thema-onafhankelijk (papier is papier, ook 's nachts), dus ze worden
// één keer gecontroleerd en tellen hard mee.
const heroCss = readFileSync(
  new URL("../src/features/dashboard/components/DashboardHero.css", import.meta.url),
  "utf8",
);
// Sinds #986 draagt de feed dezelfde twee edities als eiland: dezelfde stops,
// dezelfde inkt, dus dezelfde meting.
const feedCss = readFileSync(
  new URL("../src/features/feed/Feed.css", import.meta.url),
  "utf8",
);

function islandTokens(selector, bron = heroCss) {
  const block = bron.match(
    new RegExp(`\\${selector}\\s*\\{([\\s\\S]*?)\\n\\}`),
  )?.[1];
  if (!block) return null;
  const out = tokensOf(block);
  // Eén niveau var()-indirectie oplossen (--ink: var(--lauwer-ink)).
  for (const [k, v] of Object.entries(out)) {
    const ref = /^var\((--[\w-]+)\)$/.exec(v);
    if (ref) out[k] = out[ref[1].slice(2)] ?? v;
  }
  return out;
}

// [selector, omschrijving, [voorgrond, achtergrond, drempel, label]..., bron?]
const ISLANDS = [
  [
    ".hero--pias",
    "Pias-kaart (kraftkarton)",
    [
      ["kraft-ink", "kraft-lo", 4.5, "inkt op de donkerste kartonstop"],
      ["kraft-ink-soft", "kraft-lo", 4.5, "zachte inkt op de donkerste stop"],
      ["kraft-stempel", "kraft-hi", 4.5, "stempelrood op de lichtste stop"],
      ["accent-ink", "kraft-stempel", 4.5, "knoptekst op de stempelknop"],
    ],
  ],
  [
    ".hero--piet",
    "Schande-token (speelkaart)",
    [
      ["kaart-ink", "kaart-lo", 4.5, "inkt op de donkerste kaartstop"],
      ["kaart-ink-soft", "kaart-lo", 4.5, "zachte inkt op de donkerste stop"],
      ["kaart-rood", "kaart-lo", 4.5, "kaartrood op de donkerste stop"],
      ["kaart-bone", "kaart-lak", 4.5, "bot op het lakframe"],
    ],
  ],
  [
    ".hero--kampioen",
    "Kampioen (platina-lauwer)",
    [
      ["lauwer-ink", "lauwer-lo", 4.5, "inkt op de donkerste platinastop"],
      ["lauwer-ink-soft", "lauwer-lo", 4.5, "zachte inkt op de donkerste stop"],
      ["lauwer-bone", "lauwer-groen", 4.5, "bot op de lauwerknop"],
    ],
  ],
  [
    ".hero--overlay-inform",
    "In-Form-overlay (zwart-goud)",
    [
      ["inform-goud", "inform-zwart", 4.5, "goud op de lichtste tintstop"],
      ["inform-zwart-diep", "inform-goud", 4.5, "knoptekst op de gouden knop"],
    ],
  ],
  [
    ".hero--lijst-inform",
    "In-Form-kaart (zwart-goud, eigen vlak)",
    [
      ["if-goud", "if-vlak", 4.5, "goud op het kaartvlak"],
      ["if-goud-soft", "if-vlak", 4.5, "zachte inkt op het kaartvlak"],
      ["if-vlak", "if-goud", 4.5, "knoptekst op de gouden knop"],
    ],
  ],
  [
    ".hero--overlay-onfire",
    "On Fire-overlay (sintel-ember)",
    [
      ["onfire-ember", "onfire-sintel", 4.5, "ember op de lichtste tintstop"],
      ["onfire-sintel-diep", "onfire-ember", 4.5, "knoptekst op de emberknop"],
    ],
  ],
  // De twee editie-kaarten in de feed (#986). Achtergrond is hier de líchtste
  // stop: het verloop van de feedkaart loopt van licht naar donker en de tekst
  // begint bovenaan, dus daar staat de inkt op zijn ongunstigst.
  [
    ".feed-hi--inform",
    "In-Form-feedkaart (zwart-goud)",
    [
      ["ed-ink", "ed-vlak", 4.5, "titel op de lichtste stop"],
      ["ed-accent", "ed-vlak", 4.5, "goud label op de lichtste stop"],
      ["ed-accent-soft", "ed-vlak", 4.5, "tijdstempel op de lichtste stop"],
    ],
    feedCss,
  ],
  [
    ".feed-hi--onfire",
    "On Fire-feedkaart (sintel-ember)",
    [
      ["ed-ink", "ed-vlak", 4.5, "titel op de lichtste stop"],
      ["ed-accent", "ed-vlak", 4.5, "ember label op de lichtste stop"],
      ["ed-accent-soft", "ed-vlak", 4.5, "tijdstempel op de lichtste stop"],
    ],
    feedCss,
  ],
];

let islandFailures = 0;
console.log("\n— Token-eilanden van de dashboardkaart (#771) —");
for (const [selector, omschrijving, pairs, bron] of ISLANDS) {
  const tokens = islandTokens(selector, bron);
  if (!tokens) {
    console.error(`  FAIL blok ${selector} niet gevonden`);
    islandFailures++;
    continue;
  }
  console.log(`  ${omschrijving} (${selector})`);
  for (const [fg, bg, min, label] of pairs) {
    const f = tokens[fg];
    const b = tokens[bg];
    if (!f?.startsWith("#") || !b?.startsWith("#")) {
      console.error(`    FAIL ${fg} of ${bg} ontbreekt of is geen hex`);
      islandFailures++;
      continue;
    }
    const c = contrast(f, b);
    if (c < min) islandFailures++;
    console.log(
      `    ${c >= min ? "ok  " : "FAIL"} ${c.toFixed(2).padStart(5)} ≥ ${min}  ${fg} op ${bg} (${label})`,
    );
  }
}

// ---- Divisieregisters van de FUT-kaart (#924) ----
// Elke divisiekaart zet naam, rating en stats rechtstreeks op zijn eigen
// materiaal: negen registers met vaste hexen (tokenregime #710), elk in een
// eigen bestand. De contrastcijfers stonden daar met de hand uitgerekend in het
// commentaar — precies de situatie die #771 voor de dashboardkaart opruimde.
//
// Het kaartvlak loopt van --kaart-hi via --kaart-mid naar --kaart-lo. Beide
// bovenste stops tellen hard mee: daar staat de tekst (eloblok, naamplaat,
// divisieregel). --kaart-lo blijft informatief, en dat is geen slordigheid maar
// meetkunde: het vlak heeft 24% bodempadding, dus de donkerste stop valt in de
// lege schildpunt waar geen letter komt. Karton en platina schrijven dat met
// zoveel woorden in hun eigen commentaar, mét het cijfer op de hoogte waar de
// regel wél staat. Zou lo hard meetellen, dan zou dit script twee bewust
// genomen ontwerpbesluiten omverwerpen op een plek zonder tekst.
//
// Beide richtingen worden gecontroleerd zonder dat het script hoeft te weten
// welk register licht of donker is: bij een licht register is --kaart-mid de
// ongunstigste, bij een donker (brons) juist --kaart-hi.
//
// De speciale edities (dictator, GOAT, In Form, On Fire, Big Daddy, pias, piet)
// staan hier bewust NIET tussen: hun kaartvlak is geen tweekleurig verloop maar
// een stapel van vier tot negen lagen met halftransparante texturen. Wat daar
// achter de tekst ligt volgt pas uit de gerenderde kaart — dat vraagt een
// meting op pixels, niet op CSS. Zie #924.
const DIVISIES = [
  ["slof", "Slof (vilt)"],
  ["karton", "Karton"],
  ["hout", "Hout"],
  ["brons", "Brons"],
  ["zilver", "Zilver"],
  ["goud", "Wannabe (goud)"],
  ["platina", "Platina"],
  ["diamant", "Diamant"],
  ["meester", "Meester"],
];

// [voorgrond, achtergrond, drempel, hard, label]
const DIVISIE_PAREN = [
  ["kaart-ink", "kaart-hi", 4.5, true, "inkt op de lichtste stop"],
  ["kaart-ink", "kaart-mid", 4.5, true, "inkt op de middenstop"],
  ["kaart-ink", "kaart-lo", 4.5, false, "inkt op de donkerste stop (schildpunt)"],
  ["kaart-ink-soft", "kaart-hi", 4.5, true, "zachte inkt op de lichtste stop"],
  ["kaart-ink-soft", "kaart-mid", 4.5, true, "zachte inkt op de middenstop"],
  ["kaart-ink-soft", "kaart-lo", 4.5, false, "zachte inkt op de donkerste stop (schildpunt)"],
];

let divisieFailures = 0;
console.log("\n— Divisieregisters van de FUT-kaart (#924) —");
for (const [naam, omschrijving] of DIVISIES) {
  const bestand = new URL(
    `../src/features/rating/components/divisies/${naam}.css`,
    import.meta.url,
  );
  const blok = readFileSync(bestand, "utf8").match(
    new RegExp(`\\.fut-kaart--${naam}\\s*\\{([\\s\\S]*?)\\n\\}`),
  )?.[1];
  if (!blok) {
    console.error(`  FAIL blok .fut-kaart--${naam} niet gevonden in ${naam}.css`);
    divisieFailures++;
    continue;
  }
  const tokens = tokensOf(blok);
  console.log(`  ${omschrijving} (.fut-kaart--${naam})`);
  for (const [fg, bg, min, hard, label] of DIVISIE_PAREN) {
    const f = tokens[fg];
    const b = tokens[bg];
    if (!f?.startsWith("#") || !b?.startsWith("#")) {
      console.error(`    FAIL ${fg} of ${bg} ontbreekt of is geen hex`);
      divisieFailures++;
      continue;
    }
    const c = contrast(f, b);
    const ok = c >= min;
    if (!ok && hard) divisieFailures++;
    console.log(
      `    ${ok ? "  ok  " : hard ? "  FAIL" : "  let-op"} ${c.toFixed(2).padStart(5)} ≥ ${min}  ${fg} op ${bg} (${label})`,
    );
  }
}

// ---- Effect-swirls op de matchkaart (#1151) ----
// De matchkaart legt per actief effect een doorschijnende SVG-ribbon over
// --surface: lef paars, joker blauw, inzet amber. De vier strokes van één
// ribbon compositen in de smalle kern tot maximaal circa 13%; in donker dimt
// de hele SVG naar 78% en resteert circa 10%. Bij een drievoudige kruising
// liggen alle drie die maxima over dezelfde tekst.
//
// Dat is precies het soort tekort dat een tokenpaar níét vangt: elk paar los
// (--ink-soft-strong op --surface) haalt AA met gemak, en pas de stapeling duwt
// het eronder. Daarom rekenen we hier de samenstelling na in plaats van de
// tokens: --surface, dan laag voor laag alpha-compositing, en dan de tekst.
//
// De drempel bewaakt de samengestelde kern uit MatchEffectSurface.css. Staat
// die hier lager dan de CSS, dan meet dit niets; loopt de CSS erop vooruit,
// dan valt CI om — en dat is de bedoeling, want dan is de kaart onleesbaar.
const SWIRL_PIEK = { licht: 0.13, donker: 0.1 };
const SWIRL_LAGEN = ["effect-lef", "effect-joker", "effect-inzet"];

/** --surface met N effectlagen erover, elk op de piekdekking. */
function swirlVlak(tokens, lagen, alpha) {
  let bg = parseColor(tokens.surface);
  for (const laag of lagen) {
    const kleur = parseColor(tokens[laag]);
    if (!kleur) continue;
    bg = composite([kleur[0], kleur[1], kleur[2], alpha], bg);
  }
  return `rgb(${bg.slice(0, 3).map(Math.round).join(", ")})`;
}

let swirlFailures = 0;
console.log("\n— Effect-swirls op de matchkaart (#1151) —");
for (const [naam, tokens] of [
  ["licht", light],
  ["donker", dark],
]) {
  const alpha = SWIRL_PIEK[naam];
  console.log(`  ${naam} (piek ${(alpha * 100).toFixed(0)}% per laag)`);
  for (let n = 1; n <= SWIRL_LAGEN.length; n++) {
    const lagen = SWIRL_LAGEN.slice(0, n);
    const vlak = swirlVlak(tokens, lagen, alpha);
    // --ink draagt op effectkaarten alle kleine tekst: juist op de kruising van
    // twee of drie heldere kernen haalt de gewone gedempte tekst geen AA meer.
    for (const [fg, min, wat] of [
      ["ink", 4.5, "teamnamen, datum en score"],
    ]) {
      const c = contrast(tokens[fg], vlak);
      const ok = c >= min;
      if (!ok) swirlFailures++;
      console.log(
        `    ${ok ? "  ok  " : "  FAIL"} ${c.toFixed(2).padStart(5)} ≥ ${min}  ${fg} op ${lagen.join("+")} (${wat}, ${n} ${n === 1 ? "laag" : "lagen"})`,
      );
    }
  }
}

if (
  darkFailures > 0 ||
  randFailures > 0 ||
  plafondFailures > 0 ||
  richtingFailures > 0 ||
  softFailures > 0 ||
  deltaFailures > 0 ||
  islandFailures > 0 ||
  divisieFailures > 0 ||
  swirlFailures > 0
) {
  if (darkFailures > 0)
    console.error(`\n${darkFailures} donkere contrastpa(a)r(en) onder de drempel.`);
  if (randFailures > 0)
    console.error(`${randFailures} rand(en) onder de 1.4.11-drempel of verkeerd om.`);
  if (plafondFailures > 0)
    console.error(`${plafondFailures} meubilairvlak(ken) boven het lichtheidsplafond.`);
  if (richtingFailures > 0)
    console.error(`${richtingFailures} richtingspa(a)r(en) omgekeerd of te vlak.`);
  if (softFailures > 0)
    console.error(`${softFailures} soft-vlak(ken) onder hover of te grijs.`);
  if (deltaFailures > 0)
    console.error(`${deltaFailures} accentpa(a)r(en) te dicht op elkaar (ΔE).`);
  if (islandFailures > 0)
    console.error(`${islandFailures} kaart-eiland-pa(a)r(en) onder de drempel.`);
  if (divisieFailures > 0)
    console.error(`${divisieFailures} divisiepa(a)r(en) onder de drempel.`);
  if (swirlFailures > 0)
    console.error(`${swirlFailures} effect-swirl-pa(a)r(en) onder de drempel.`);
  process.exit(1);
}
console.log(
  "\nDonker thema en de kaart-eilanden voldoen aan AA (licht: zie eventuele let-op-regels).",
);
