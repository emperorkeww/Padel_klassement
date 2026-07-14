// Deelt platte tekst met de vriendengroep: het native deelvenster waar dat kan
// (mobiel), anders naar het klembord. Tegenhanger van sharePng (afbeeldingen).
// De aanroeper handelt toastmeldingen en het sluiten van het deelvenster
// (AbortError) af.

export type TextShareOutcome = "shared" | "clipboard";

/**
 * Deelt `text` (optioneel met een losse `url`). Met een url gaat die als apart
 * veld mee naar het deelvenster en wordt hij op het klembord onder de tekst
 * gezet; zonder url delen/kopiëren we enkel de tekst (handig als de links al in
 * de tekst staan). Gooit door bij fouten, inclusief AbortError.
 */
export async function shareOrCopyText({
  title,
  text,
  url,
}: {
  title: string;
  text: string;
  url?: string;
}): Promise<TextShareOutcome> {
  if (typeof navigator.share === "function") {
    await navigator.share(url ? { title, text, url } : { title, text });
    return "shared";
  }
  await navigator.clipboard.writeText(url ? `${text}\n${url}` : text);
  return "clipboard";
}
