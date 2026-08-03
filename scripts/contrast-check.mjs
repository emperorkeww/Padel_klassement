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
const light = tokensOf(rootBlock);
const dark = { ...light, ...tokensOf(darkBlock) };

function luminance(hex) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const v = parseInt(full.slice(i, i + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(fg, bg) {
  const [a, b] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
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
  ["lef", "surface", 4.5, "lef-tekst op kaart"],
  ["lef", "lef-soft", 4.5, "lef-tekst op lef-vlak"],
  ["lef-ink", "lef", 4.5, "knoptekst op ingezette lef-knop"],
  ["dorst", "surface", 4.5, "traktatie-tekst op kaart (#1004)"],
  ["dorst", "dorst-soft", 4.5, "traktatie-tekst op dorstvlak (#1004)"],
  ["dorst-ink", "dorst", 4.5, "knoptekst op ingeloste traktatie-knop (#1004)"],
  ["success", "surface", 4.5, "winst-tekst op kaart"],
  ["success", "success-soft", 4.5, "winst-tekst op winstvlak"],
  ["danger", "surface", 4.5, "verlies-tekst op kaart"],
  ["danger", "danger-soft", 4.5, "verlies-tekst op verliesvlak"],
  ["warn", "warn-soft", 4.5, "waarschuwing op waarschuwingsvlak"],
  ["coach-diep", "coach-soft", 4.5, "coach/bounty-tekst op coachvlak (#941)"],
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
  ["toast-ink", "success", 3.0, "toast-tekst op succes-toast (groot/UI)"],
  ["toast-ink", "danger", 4.5, "toast-tekst op fout-toast (blijft staan)"],
  ["toast-ink", "ink", 4.5, "toast-tekst op info-toast"],
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
    if (!f?.startsWith("#") || !b?.startsWith("#")) continue;
    const c = contrast(f, b);
    const ok = c >= min;
    if (!ok && strict) darkFailures++;
    console.log(
      `${ok ? "  ok  " : strict ? "  FAIL" : "  let-op"} ${c.toFixed(2).padStart(5)} ≥ ${min}  ${fg} op ${bg} (${label})`,
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

if (darkFailures > 0 || islandFailures > 0 || divisieFailures > 0) {
  if (darkFailures > 0)
    console.error(`\n${darkFailures} donkere contrastpa(a)r(en) onder de drempel.`);
  if (islandFailures > 0)
    console.error(`${islandFailures} kaart-eiland-pa(a)r(en) onder de drempel.`);
  if (divisieFailures > 0)
    console.error(`${divisieFailures} divisiepa(a)r(en) onder de drempel.`);
  process.exit(1);
}
console.log(
  "\nDonker thema en de kaart-eilanden voldoen aan AA (licht: zie eventuele let-op-regels).",
);
