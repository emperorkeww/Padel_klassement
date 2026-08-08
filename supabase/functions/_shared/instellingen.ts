// De schakelaars uit public.app_settings lezen (#1049).
//
// Tot nu toe had de app precies één vlag — VITE_DEFAULT_DICTATOR — en die zit
// in de build: omzetten is een deploy. Deze drie zijn direct om te zetten
// vanuit het beheerpaneel:
//
//   ai_portretten   de OpenAI-aanroepen, inclusief een dagbudget als rem
//   playtomic       de egress-hop, als Playtomic ons weer blokkeert (#385)
//   push            alle uitgaande web-push in één keer
//
// FAIL-OPEN, en dat is hier bewust andersom dan bij cronAuth.ts. Daar is een
// ontbrekend geheim een reden om te weigeren, want dat is een beveiligingsgate.
// Dit is er geen: een storing in de tabel — of een migratie die nog niet gedraaid
// heeft — mag geen pushmeldingen tegenhouden die het gisteren nog deden. Alleen
// een expliciete `{"aan": false}` zet iets uit.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

/**
 * Hoe lang een gelezen waarde blijft gelden binnen dezelfde function-instance.
 *
 * Edge-instances worden hergebruikt, dus zonder cache doet elke pushmelding een
 * extra query. Een minuut is kort genoeg dat een omgezette kill switch meteen
 * voelt alsof hij werkt, en lang genoeg om een burst van honderd meldingen niet
 * honderd keer dezelfde rij te laten lezen.
 */
const CACHE_MS = 60_000;

const cache = new Map<string, { waarde: Record<string, unknown> | null; tot: number }>();

/** Alleen voor tests: gooit de instance-cache weg. */
export function vergeetInstellingen(): void {
  cache.clear();
}

/**
 * De beslissing zelf, als pure functie — zodat de randgevallen zonder databank
 * te toetsen zijn. Zie de fail-open-redenering hierboven.
 */
export function staatAan(waarde: unknown): boolean {
  if (waarde === null || typeof waarde !== "object" || Array.isArray(waarde)) {
    return true;
  }
  const aan = (waarde as Record<string, unknown>).aan;
  // Alleen een echte `false` zet uit. "false" als string, 0 of null zijn
  // rommel en horen niet stilzwijgend de app plat te leggen.
  return aan !== false;
}

/**
 * Leest één schakelaar. Faalt de query, dan geldt "aan" — zie hierboven.
 *
 * `nu` is injecteerbaar zodat de cache in tests te sturen is zonder de klok te
 * vervalsen.
 */
export async function isAan(
  admin: SupabaseClient,
  sleutel: string,
  nu: number = Date.now(),
): Promise<boolean> {
  const gecached = cache.get(sleutel);
  if (gecached && gecached.tot > nu) return staatAan(gecached.waarde);

  const { data, error } = await admin
    .from("app_settings")
    .select("waarde")
    .eq("sleutel", sleutel)
    .maybeSingle();

  if (error) {
    console.error(`[instellingen] ${sleutel} lezen faalde`, error.message);
    // Niet cachen: een storing mag niet een minuut lang blijven plakken.
    return true;
  }

  const waarde = (data?.waarde ?? null) as Record<string, unknown> | null;
  cache.set(sleutel, { waarde, tot: nu + CACHE_MS });
  return staatAan(waarde);
}
