// Herkennen wanneer een crash eigenlijk "er is nieuwe versie" is (#733).
//
// Alle routes zijn lazy(), dus elke pagina is een aparte gehashte chunk. Wordt
// er gedeployed terwijl een tab openstaat, dan bestaan de oude bestanden niet
// meer en gooit de dynamische import. Een PWA die de oude service worker
// bewust laat draaien (#463) loopt daar vaker dan gemiddeld tegenaan: de
// nieuwe SW ruimt bij activatie de oude asset-cache op.
//
// Voor de gebruiker is dat geen crash maar een verouderde tab. Deze module
// levert de detectie; de fallback maakt er een andere boodschap van.

// De echte teksten van de browsers. Puur stringwerk, dus makkelijk stil
// kapot — vandaar de tests met letterlijke meldingen per browser.
const PATRONEN = [
  /failed to fetch dynamically imported module/i, // Chrome/Edge
  /error loading dynamically imported module/i, // Firefox
  /importing a module script failed/i, // Safari
  /unable to preload css/i, // Vite's CSS-preload-helper
  // De SPA-fallback serveert index.html voor een pad dat niet bestaat — ook
  // voor een verdwenen /assets/*.js. De browser weigert dat uit te voeren.
  /is not a valid javascript mime type/i,
  /expected a javascript(-or-wasm)? module script/i,
];

/** Hoe lang een `vite:preloadError` nog meetelt als verklaring voor een
 *  crash. Kort: de afgewezen import volgt direct op het event. */
const PRELOAD_VENSTER_MS = 10_000;

let preloadFoutOp = 0;

/** Onthoudt dat Vite zojuist een chunk niet kon preloaden. Zo herkennen we
 *  ook een fout die zelf geen bruikbare melding meer draagt. */
export function markeerPreloadFout(): void {
  preloadFoutOp = Date.now();
}

/** Koppelt de detectie aan Vite's `vite:preloadError`. Bewust een expliciete
 *  init i.p.v. een import-neveneffect, zodat tests de module schoon kunnen
 *  gebruiken. Geeft een opruimfunctie terug. */
export function initChunkErrorDetectie(): () => void {
  const bij = () => markeerPreloadFout();
  window.addEventListener("vite:preloadError", bij);
  return () => window.removeEventListener("vite:preloadError", bij);
}

/** Is deze fout het gevolg van een chunk die niet (meer) te laden is? */
export function isChunkLoadError(fout: unknown): boolean {
  if (Date.now() - preloadFoutOp < PRELOAD_VENSTER_MS) return true;
  if (!fout) return false;
  // Webpack-stijl naam; sommige libraries gooien die nog.
  if (fout instanceof Error && fout.name === "ChunkLoadError") return true;
  const melding = fout instanceof Error ? fout.message : String(fout);
  return PATRONEN.some((p) => p.test(melding));
}

// ── Herlaad-guard ───────────────────────────────────────────────────────────
// Herladen is hier de enige echte oplossing, maar als het níet helpt (denk aan
// een CDN die nog oude HTML serveert) wil je de gebruiker niet blijven vragen
// om te herladen. Na een recente poging valt de fallback terug op de gewone
// crash-weergave, die óók "opnieuw proberen" biedt.

const SLEUTEL = "vamos:chunk-herlaad";
const HERHAAL_VENSTER_MS = 60_000;

/** Legt vast dat we zojuist om een chunk-fout hebben herladen. */
export function onthoudHerlaadpoging(): void {
  try {
    sessionStorage.setItem(SLEUTEL, String(Date.now()));
  } catch {
    /* private mode / storage vol: dan maar zonder guard */
  }
}

/** Hebben we het net al geprobeerd? Dan helpt nóg een keer herladen niet. */
export function herlaadNetGeprobeerd(): boolean {
  try {
    const op = Number(sessionStorage.getItem(SLEUTEL) ?? 0);
    return op > 0 && Date.now() - op < HERHAAL_VENSTER_MS;
  } catch {
    return false;
  }
}
