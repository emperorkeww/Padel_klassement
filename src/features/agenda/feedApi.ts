import { supabase } from "@/lib/supabase/client";

/* ------------------------------------------------------------------ */
/* Agenda-abonnement (#1099): één feed-URL per speler.                 */
/*                                                                     */
/* Bewust géén querycache: er is precies één rij, hij verandert alleen  */
/* door een handeling van de gebruiker zelf, en een verouderde link is  */
/* hier erger dan een extra query.                                      */
/* ------------------------------------------------------------------ */

/** Het token van je lopende agenda-link, of null als je er geen hebt. */
export async function getMyFeedToken(): Promise<string | null> {
  const { data, error } = await supabase
    .from("calendar_feeds")
    .select("token")
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  return data?.[0]?.token ?? null;
}

/** Geeft een nieuwe link uit en trekt alle vorige in. Ook de eerste keer. */
export async function rotateFeedToken(): Promise<string> {
  const { data, error } = await supabase.rpc("rotate_calendar_feed");
  if (error) throw error;
  return data as string;
}

/** Stopt het abonnement zonder een nieuwe link uit te geven. */
export async function revokeFeedTokens(): Promise<void> {
  const { error } = await supabase.rpc("revoke_calendar_feeds");
  if (error) throw error;
}

/**
 * De URL die je in je agenda-app plakt.
 *
 * `.ics` aan het eind is geen eis van de spec maar wel van de gewoonte: een
 * paar agenda-apps kijken naar de extensie voordat ze de content-type
 * vertrouwen, en de rest maalt er niet om.
 */
export function feedUrl(token: string, base = import.meta.env.VITE_SUPABASE_URL): string {
  return `${String(base).replace(/\/+$/, "")}/functions/v1/calendar-feed/${token}.ics`;
}

/**
 * Dezelfde URL met het webcal-schema. Eén tik op mobiel opent daarmee meteen
 * de agenda-app met de abonneervraag, in plaats van het bestand te downloaden
 * — precies het verschil tussen "volgt vanzelf" en "één momentopname".
 */
export function webcalUrl(token: string, base = import.meta.env.VITE_SUPABASE_URL): string {
  return feedUrl(token, base).replace(/^https?:/, "webcal:");
}
