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
    gold: "#d4a017",
    goldSoft: "#faf3dd",
    silver: "#8c98a4",
    silverSoft: "#eef1f4",
    bronze: "#b0722d",
    bronzeSoft: "#f7ece0",
    platina: "#4e7d8f",
    platinaSoft: "#e9f2f6",
    diamant: "#4f46e5",
    diamantSoft: "#eceafc",
  };
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
