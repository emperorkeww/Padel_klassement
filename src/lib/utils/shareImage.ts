// Gedeelde canvas-deel-logica: teken een afbeelding en deel die via de Web
// Share API (mobiel), het klembord (desktop) of een download (terugval).
// Gebruikt door ShareMatch (uitslag) en ShareEvening (avond-samenvatting).

export type ShareOutcome = "shared" | "clipboard" | "download" | "cancelled";

/**
 * Huisstijlkleuren voor de deel-posters — bewust vastgepind op het LICHTE
 * palet i.p.v. de live CSS-variabelen. De posters bevatten lichte literals
 * (zebra-strepen, wit) en worden buiten de app bekeken; in dark mode zouden
 * live tokens ze donker en inconsistent maken (issue #125).
 */
export function canvasPalette() {
  return {
    bg: "#ffffff",
    ink: "#1a2620",
    inkSoft: "#64756c",
    accent: "#0c8a5f",
    accentSoft: "#e6f5ee",
    line: "#e4eae4",
    lime: "#c7e63a",
    success: "#16a34a",
    slof: "#7f7a6f",
    slofSoft: "#f2f0ea",
    karton: "#a87d42",
    kartonSoft: "#f6efe0",
    hout: "#77441d",
    houtSoft: "#efe3d5",
    successSoft: "#eaf8ef",
    zebra: "#f5f8f5",
    coach: "#e0821c",
    coachSoft: "#fdf0dc",
    coachLine: "#f0d3a3",
    coachInk: "#5a3410",
    gold: "#d4a017",
    goldSoft: "#faf3dd",
    silver: "#8595a8",
    silverSoft: "#eef1f4",
    bronze: "#b45f1d",
    bronzeSoft: "#f8ead9",
    platina: "#2f9ab8",
    platinaSoft: "#e6f3f7",
    diamant: "#3b6ce8",
    diamantSoft: "#e9eefc",
    meester: "#7c3aed",
    meesterSoft: "#f0ebfe",
    legende: "#c2185b",
    legendeSoft: "#fce7ef",
    dictator: "#8a1c3b",
    dictatorSoft: "#f7ecd0",
  };
}

/** Afgerond-rechthoek-pad (met terugval als ctx.roundRect ontbreekt). */
export function rrect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  const anyCtx = ctx as CanvasRenderingContext2D & {
    roundRect?: (x: number, y: number, w: number, h: number, r: number) => void;
  };
  if (typeof anyCtx.roundRect === "function") {
    anyCtx.roundRect(x, y, w, h, rr);
    return;
  }
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/**
 * Kapt tekst af op maxWidth met een echte ellipsis. Gebruik dit i.p.v. de
 * `maxWidth`-parameter van ctx.fillText: die perst de letters horizontaal samen
 * in plaats van af te kappen, wat lange namen onleesbaar maakt (#421).
 */
export function ellipsize(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let kort = text;
  while (kort.length > 0 && ctx.measureText(`${kort}…`).width > maxWidth) {
    kort = kort.slice(0, -1);
  }
  return kort ? `${kort}…` : "…";
}

/**
 * Breekt tekst af binnen maxWidth tot maximaal maxLines regels; wat niet past
 * krijgt een ellipsis op de laatste regel. Tegenhanger van wrapCentered voor
 * links uitgelijnde blokken.
 */
export function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (let i = 0; i < words.length; i++) {
    const test = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(test).width > maxWidth && line) {
      if (lines.length === maxLines - 1) {
        // Laatste toegestane regel: alles wat nog rest erop, en afkappen.
        return [...lines, ellipsize(ctx, [line, ...words.slice(i)].join(" "), maxWidth)];
      }
      lines.push(line);
      line = words[i];
    } else {
      line = test;
    }
  }
  if (line) lines.push(ellipsize(ctx, line, maxWidth));
  return lines;
}

/** Gecentreerde tekst met regelafbreking binnen maxWidth. */
export function wrapCentered(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  const startY = y - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((l, i) => ctx.fillText(l, x, startY + i * lineHeight));
}

/** De font-specs die de posters tekenen (Outfit is variabel, 400..800). */
const POSTER_FONTS = [
  "500 40px Outfit",
  "600 40px Outfit",
  "700 40px Outfit",
  "800 40px Outfit",
  "italic 500 40px Outfit",
  // Nunito (#895): de rating van de "Sletje van de baan"-kaart staat in
  // --font-rounded. Zonder deze laadbeurt valt juist het grootste cijfer van
  // die kaart terug op system-ui, met andere metrics.
  "900 40px Nunito",
];

/**
 * Wacht tot Outfit klaarstaat vóór we tekenen (#421). Canvas triggert zélf geen
 * font-load en Outfit komt met `display=swap` van Google Fonts, dus zonder deze
 * stap valt een vroege deel-klik terug op system-ui: andere metrics, en dus
 * kloppen alle gemeten afkappingen niet meer. `fonts.load` forceert de laadbeurt,
 * `fonts.ready` wacht ook op wat de app zelf al aan het laden was. Faalt er iets
 * (of ontbreekt de FontFaceSet, zoals in jsdom), dan tekenen we gewoon door —
 * een poster in de terugvalletter is beter dan geen poster.
 */
async function waitForFonts(): Promise<void> {
  const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
  if (!fonts) return;
  try {
    await Promise.all(POSTER_FONTS.map((f) => fonts.load(f)));
    await fonts.ready;
  } catch {
    /* terugval op system-ui */
  }
}

/** Tekent via `draw` op een canvas en deelt het resultaat als PNG. */
export async function sharePng(
  draw: (ctx: CanvasRenderingContext2D) => void,
  { width = 1080, height = 1080, filename = "vamos.png", title = "Vamos!" } = {},
): Promise<ShareOutcome> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas niet beschikbaar.");
  await waitForFonts();
  draw(ctx);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!blob) throw new Error("Afbeelding maken mislukt.");
  const file = new File([blob], filename, { type: "image/png" });

  try {
    // 1) Web Share met bestand (mobiel).
    if (
      typeof navigator.canShare === "function" &&
      navigator.canShare({ files: [file] })
    ) {
      await navigator.share({ files: [file], title });
      return "shared";
    }

    // 2) Klembord (desktop met clipboard-write).
    const ClipboardItemCtor = (
      window as unknown as { ClipboardItem?: typeof ClipboardItem }
    ).ClipboardItem;
    if (navigator.clipboard && ClipboardItemCtor) {
      await navigator.clipboard.write([
        new ClipboardItemCtor({ "image/png": blob }),
      ]);
      return "clipboard";
    }

    // 3) Download als laatste redmiddel.
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    return "download";
  } catch (err) {
    // Gebruiker die het deelvenster sluit is geen fout.
    if (err instanceof DOMException && err.name === "AbortError")
      return "cancelled";
    throw err;
  }
}
