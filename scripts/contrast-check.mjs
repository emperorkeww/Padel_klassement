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
  ["accent", "accent-soft", 4.5, "accenttekst op accentvlak (badges)"],
  ["accent-ink", "accent", 4.5, "knoptekst op accentknop"],
  ["accent-ink", "accent-hover", 4.5, "knoptekst op de knop onder de muis"],
  ["accent-ink", "accent-strong", 4.5, "knoptekst op de ingedrukte knop"],
  ["lef", "surface", 4.5, "lef-tekst op kaart"],
  ["lef", "lef-soft", 4.5, "lef-tekst op lef-vlak"],
  ["lef-ink", "lef", 4.5, "knoptekst op ingezette lef-knop"],
  ["dorst", "surface", 4.5, "traktatie-tekst op kaart (#1004)"],
  ["dorst", "dorst-soft", 4.5, "traktatie-tekst op dorstvlak (#1004)"],
  ["dorst-ink", "dorst", 4.5, "knoptekst op ingeloste traktatie-knop (#1004)"],
  ["joker", "surface", 4.5, "joker-tekst op kaart (#1003)"],
  ["joker", "joker-soft", 4.5, "joker-tekst op jokervlak (#1003)"],
  ["joker-ink", "joker", 4.5, "kaarttekst op gespeelde joker (#1003)"],
  ["success", "surface", 4.5, "winst-tekst op kaart"],
  ["success", "success-soft", 4.5, "winst-tekst op winstvlak"],
  ["danger", "surface", 4.5, "verlies-tekst op kaart"],
  ["danger", "danger-soft", 4.5, "verlies-tekst op verliesvlak"],
  ["warn", "warn-soft", 4.5, "waarschuwing op waarschuwingsvlak"],
  ["coach-diep", "coach-soft", 4.5, "coach/bounty-tekst op coachvlak (#941)"],
  // De open-poll-stip in het maandraster (#1112). Grafisch merkteken, dus 3:1 —
  // maar hij ligt op twee vlakken: een lege dag (--surface) en een dag met
  // speeldagen (--surface-2). Beide moeten kloppen.
  ["poll", "surface", 3.0, "open-poll-stip op de rasterkaart (#1112)"],
  ["poll", "surface-2", 3.0, "open-poll-stip op een dag met speeldagen (#1112)"],
  ["poll-diep", "poll-soft", 4.5, "tekst van de open-poll-chip (#1112)"],
  ["slof", "slof-soft", 3.0, "slof-tierbadge (groot/UI)"],
  ["karton", "karton-soft", 3.0, "karton-tierbadge (groot/UI)"],
  ["hout", "hout-soft", 3.0, "hout-tierbadge (groot/UI)"],
  ["gold", "gold-soft", 3.0, "goud-badge (groot/UI)"],
  ["platina", "platina-soft", 3.0, "platina-tierbadge (groot/UI)"],
  ["diamant", "diamant-soft", 3.0, "diamant-tierbadge (groot/UI)"],
  ["meester", "meester-soft", 3.0, "meester-tierbadge (groot/UI)"],
  ["legende", "legende-soft", 3.0, "legende-tierbadge (groot/UI)"],
  ["lime-deep", "surface", 3.0, "lime-tekstaccent (groot/UI)"],
  ["lime-deep", "lime-soft", 4.5, "serve-chip: 'begint' op lime-vlak (#435)"],
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
  ["bg", "sidebar-bg", 3, "navigatie zakt weg onder de pagina"],
  ["surface-2", "surface", 3, "subtiel vlak binnen een kaart"],
  ["surface-elevated", "surface", 3, "verhoogd vlak (hero, sheets)"],
  ["surface-hover", "surface", 4, "hover is voelbaar"],
  ["surface-active", "surface", 4, "gekozen item is voelbaar"],
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
// De matchkaart legt per actief effect een doorschijnende kleurlaag over
// --surface: lef paars, joker blauw, inzet amber. Die lagen stapelen — bij een
// match met alle drie liggen er drie tinten over dezelfde tekst.
//
// Dat is precies het soort tekort dat een tokenpaar níét vangt: elk paar los
// (--ink-soft-strong op --surface) haalt AA met gemak, en pas de stapeling duwt
// het eronder. Daarom rekenen we hier de samenstelling na in plaats van de
// tokens: --surface, dan laag voor laag alpha-compositing, en dan de tekst.
//
// De drempel bewaakt de piek uit ui.css (--fx-piek). Staat die hier lager dan
// in de CSS, dan meet dit niets; loopt de CSS erop vooruit, dan valt CI om — en
// dat is de bedoeling, want dan is de kaart onleesbaar geworden.
const SWIRL_PIEK = { licht: 0.06, donker: 0.05 };
const SWIRL_LAGEN = ["lef", "joker", "dorst"];

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
    // --ink-soft-strong draagt de teamnamen op een effectkaart; --ink de score
    // en de winnaarsnaam. --ink-soft staat er bewust niet bij: die haalt het
    // getint niet meer, en dáárom schakelt de kaart naar -strong.
    for (const [fg, min, wat] of [
      ["ink-soft-strong", 4.5, "teamnamen"],
      ["ink", 4.5, "score en winnaar"],
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
  islandFailures > 0 ||
  divisieFailures > 0 ||
  swirlFailures > 0
) {
  if (darkFailures > 0)
    console.error(`\n${darkFailures} donkere contrastpa(a)r(en) onder de drempel.`);
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
