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
 * Dezelfde URL met het webcal-schema. Eén tik opent op iOS meteen Apple Agenda
 * met de abonneervraag, in plaats van het bestand te downloaden — precies het
 * verschil tussen "volgt vanzelf" en "één momentopname".
 *
 * Als tik alleen op iOS: Android kent `webcal:` niet, daar doet deze link
 * niets (#1117). Voor dat pad is `googleCalendarUrl()` er — die geeft dezelfde
 * webcal-vorm door aan Google in plaats van aan het toestel.
 */
export function webcalUrl(token: string, base = import.meta.env.VITE_SUPABASE_URL): string {
  return feedUrl(token, base).replace(/^https?:/, "webcal:");
}

/**
 * Google's eigen "agenda via URL toevoegen"-route (#1117).
 *
 * Dit is wat Android redt: de Google Agenda-app claimt `webcal:` niet, maar
 * vangt deze link wél af — en anders opent de web-UI met dezelfde vraag.
 *
 * `cid` krijgt de **webcal**-vorm mee (#1197). Bij #1117 stond hier de
 * https-vorm, met de redenering dat Google de feed toch serverside ophaalt.
 * Dat is precies waar het misging: `cid` betekent voor Google in de eerste
 * plaats een agenda-*id*, en pas een feed-URL als het schema dat zegt. Met
 * https komt de abonneervraag niet, en dan gebeurt er dus niets — het stille
 * falen dat #1117 juist wilde wegnemen.
 *
 * De feed zelf blijft https; `webcal:` is hier alleen het signaal aan Google.
 * Url-encoden mag: Google decodeert de query-parameter gewoon, en zonder
 * encoding zou het pad de query-scheiding niet overleven.
 */
export function googleCalendarUrl(
  token: string,
  base = import.meta.env.VITE_SUPABASE_URL,
): string {
  return `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcalUrl(token, base))}`;
}
