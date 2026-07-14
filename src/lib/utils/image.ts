// Client-side verkleinen van profielfoto's vóór upload: avatars worden
// nergens groter dan ~72px getoond, dus een 256px-vierkant volstaat ruim.
// Dat maakt de upload én elke latere download ~100× kleiner dan een
// origineel telefoonkiekje.

const MAX_SIZE = 256;
const QUALITY = 0.85;

export type ProcessedImage = { blob: Blob; ext: string };

export async function downscaleImage(file: File): Promise<ProcessedImage> {
  // from-image: EXIF-rotatie van telefoonfoto's respecteren.
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const scale = Math.min(1, MAX_SIZE / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas niet beschikbaar.");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, w, h);

    // WebP waar het kan; browsers zonder WebP-encoder leveren PNG.
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", QUALITY),
    );
    if (!blob) throw new Error("Kon de afbeelding niet verwerken.");
    const ext = blob.type === "image/webp" ? "webp" : "png";
    return { blob, ext };
  } finally {
    bitmap.close();
  }
}
