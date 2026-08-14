// Gedeelde HTTP-laag naar de Playtomic-proxy (/api/playtomic — Vite-proxy in
// dev, Cloudflare Worker in productie).
//
// Losgetrokken van api.ts (#391): dat bestand hangt via het snapshot-leespad
// aan de supabase-client, en de clubkiezer heeft daar niets mee te maken. Wie
// alleen wil zoeken hoort niet de halve databanklaag te importeren.

export const BASE = "/api/playtomic";

/**
 * Playtomic is onbereikbaar of weigert ons (WAF, storing, offline). De UI
 * degradeert hierop naar de reserveerlink (#405) en het leespad mag een
 * verouderde snapshot als vangnet serveren.
 */
export class PlaytomicUnavailableError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "PlaytomicUnavailableError";
    this.status = status;
  }
}

export async function getJson<T>(path: string, foutmelding: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { headers: { Accept: "application/json" } });
  } catch {
    // Netwerkfout / offline: fetch verwerpt zonder respons.
    throw new PlaytomicUnavailableError(
      "Geen verbinding met Playtomic — controleer je internet.",
    );
  }
  if (res.ok) return res.json() as Promise<T>;
  // Statusbewuste, begrijpelijke melding i.p.v. een kale statuscode.
  if (res.status === 429) {
    throw new PlaytomicUnavailableError(
      "Even te veel verzoeken naar Playtomic — probeer zo opnieuw.",
      res.status,
    );
  }
  if (res.status === 403) {
    throw new PlaytomicUnavailableError(
      `${foutmelding}: Playtomic blokkeert onze aanvraag momenteel — probeer het later opnieuw.`,
      res.status,
    );
  }
  if (res.status === 404) {
    throw new PlaytomicUnavailableError(
      `${foutmelding}: niet (meer) gevonden op Playtomic.`,
      res.status,
    );
  }
  if (res.status >= 500) {
    throw new PlaytomicUnavailableError(
      `${foutmelding}: Playtomic heeft een storing — probeer het later opnieuw.`,
      res.status,
    );
  }
  throw new PlaytomicUnavailableError(
    `${foutmelding}: onverwachte fout van Playtomic.`,
    res.status,
  );
}
