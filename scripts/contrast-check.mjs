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
  ["success", "surface", 4.5, "winst-tekst op kaart"],
  ["success", "success-soft", 4.5, "winst-tekst op winstvlak"],
  ["danger", "surface", 4.5, "verlies-tekst op kaart"],
  ["danger", "danger-soft", 4.5, "verlies-tekst op verliesvlak"],
  ["warn", "warn-soft", 4.5, "waarschuwing op waarschuwingsvlak"],
  ["gold", "gold-soft", 3.0, "goud-badge (groot/UI)"],
  ["platina", "platina-soft", 3.0, "platina-tierbadge (groot/UI)"],
  ["diamant", "diamant-soft", 3.0, "diamant-tierbadge (groot/UI)"],
  ["lime-deep", "surface", 3.0, "lime-tekstaccent (groot/UI)"],
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

if (darkFailures > 0) {
  console.error(`\n${darkFailures} donkere contrastpa(a)r(en) onder de drempel.`);
  process.exit(1);
}
console.log("\nDonker thema voldoet aan AA (licht: zie eventuele let-op-regels).");
