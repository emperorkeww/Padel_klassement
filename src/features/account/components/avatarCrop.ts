// Rekenkant van het avatar-uitsnijden (#921), los van het component zodat de
// omrekening en het canvas-tekenen te toetsen zijn zonder te renderen — en
// zodat fast refresh niet struikelt over een non-component-export.

/** Zijde van de uitsnede in pixels. Ruim genoeg voor een retina-avatar, klein
 *  genoeg om niet megabytes te uploaden. */
export const AVATAR_ZIJDE = 512;

/** Zijde van het preview-kader in CSS-pixels; moet gelijk zijn aan
 *  `.avatar-crop__kader` in ProfileSettings.css. Het slepen gebeurt in
 *  schermpixels, het uitsnijden in canvaspixels — zonder deze verhouding
 *  landt de uitsnede ergens anders dan waar je hem zag. */
export const KADER_ZIJDE = 220;

/** x en y zijn canvaspixels (dus al omgerekend vanaf het preview-kader). */
export type Uitsnede = { zoom: number; x: number; y: number };

/** Sleepafstand in schermpixels → canvaspixels. */
export function naarCanvas(zoom: number, pos: { x: number; y: number }): Uitsnede {
  const factor = AVATAR_ZIJDE / KADER_ZIJDE;
  return { zoom, x: pos.x * factor, y: pos.y * factor };
}

/**
 * Tekent de gekozen uitsnede op een canvas en geeft er een JPEG-blob van terug.
 * Losse functie zodat de rekenkant te toetsen is zonder de UI te renderen.
 */
export async function snijUit(
  bron: HTMLImageElement,
  uitsnede: Uitsnede,
  zijde = AVATAR_ZIJDE,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = zijde;
  canvas.height = zijde;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Bijsnijden lukt niet in deze browser.");

  // De preview toont het beeld "cover" in een vierkant kader; dezelfde
  // rekensom hier, zodat wat je ziet is wat je krijgt.
  const basis = Math.max(
    zijde / bron.naturalWidth,
    zijde / bron.naturalHeight,
  );
  const schaal = basis * uitsnede.zoom;
  const breedte = bron.naturalWidth * schaal;
  const hoogte = bron.naturalHeight * schaal;
  ctx.drawImage(
    bron,
    (zijde - breedte) / 2 + uitsnede.x,
    (zijde - hoogte) / 2 + uitsnede.y,
    breedte,
    hoogte,
  );

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Bijsnijden mislukte.")),
      "image/jpeg",
      0.9,
    );
  });
}

