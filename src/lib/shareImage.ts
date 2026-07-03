// Gedeelde canvas-deel-logica: teken een afbeelding en deel die via de Web
// Share API (mobiel), het klembord (desktop) of een download (terugval).
// Gebruikt door ShareMatch (uitslag) en ShareEvening (avond-samenvatting).

export type ShareOutcome = "shared" | "clipboard" | "download" | "cancelled";

/** Huisstijlkleuren uit de CSS-variabelen, met vaste terugvalwaarden. */
export function canvasPalette() {
  const css = getComputedStyle(document.documentElement);
  const get = (name: string, fallback: string) =>
    css.getPropertyValue(name).trim() || fallback;
  return {
    bg: get("--surface", "#ffffff"),
    ink: get("--ink", "#1a2620"),
    inkSoft: get("--ink-soft", "#64756c"),
    accent: get("--accent", "#0c8a5f"),
    accentSoft: get("--accent-soft", "#e6f5ee"),
    line: get("--line", "#e4eae4"),
    lime: get("--lime", "#c7e63a"),
    success: get("--success", "#16a34a"),
    gold: get("--gold", "#d4a017"),
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
