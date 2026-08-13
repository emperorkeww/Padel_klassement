import { supabase } from "@/lib/supabase/client";
import { cached, invalidate } from "@/lib/supabase/queryCache";

/** Eén rij uit public.notifications (#1090). Zelfde vorm als de push die de
 *  Edge Functions versturen: titel, body, deep-link en tag. */
export interface Melding {
  id: string;
  soort: string;
  title: string;
  body: string;
  /** Dezelfde url als de push draagt, zodat "via de melding" en "via de bel"
   *  op hetzelfde scherm uitkomen. */
  url: string;
  tag: string;
  created_at: string;
  read_at: string | null;
  /** Weggeveegd (#1273). Zulke rijen komen niet meer in een lijst of teller;
   *  de rij blijft staan tot prune_notifications hem na 90 dagen opruimt. */
  dismissed_at?: string | null;
}

/** Hoeveel meldingen het paneel toont. Wie verder wil bladeren gaat naar
 *  /meldingen. */
export const PANEEL_LIMIET = 20;

/** Hoeveel meldingen /meldingen per keer bijlaadt. */
export const PAGINA = 50;

/** De recentste meldingen. RLS beperkt tot je eigen rijen — er is geen filter
 *  op user_id nodig en die zou ook niets extra's afschermen. */
export function getMeldingen(limiet = PANEEL_LIMIET): Promise<Melding[]> {
  return cached(`meldingen:lijst:${limiet}`, async () => {
    const { data, error } = await supabase
      .from("notifications")
      .select("id, soort, title, body, url, tag, created_at, read_at")
      // Weggeveegde rijen bestaan nog (#1273), maar niet meer voor jou.
      .is("dismissed_at", null)
      .order("created_at", { ascending: false })
      .limit(limiet);
    if (error) throw error;
    return (data ?? []) as Melding[];
  });
}

/**
 * De volledige lijst voor /meldingen, in stappen van PAGINA.
 *
 * Bewust het venster vanaf nul opnieuw ophalen in plaats van pagina's aan
 * elkaar te plakken: de lijst staat op created_at desc, en met realtime erbij
 * schuift er tijdens het bladeren zomaar een nieuwe melding bovenaan bij. Losse
 * pagina's zouden dan een rij dubbel tonen of er een overslaan. Dit venster is
 * hooguit een paar honderd rijen (de retentie ruimt op na 90 dagen), dus dat
 * kost niets.
 *
 * Retourneert ook of er nog meer ís: precies een volle pagina betekent
 * "waarschijnlijk meer", en dan verschijnt de knop.
 */
export function getMeldingenVenster(
  paginas: number,
): Promise<{ meldingen: Melding[]; meer: boolean }> {
  const tot = paginas * PAGINA;
  return cached(`meldingen:venster:${paginas}`, async () => {
    const { data, error } = await supabase
      .from("notifications")
      .select("id, soort, title, body, url, tag, created_at, read_at")
      .is("dismissed_at", null)
      .order("created_at", { ascending: false })
      // +1 om te wéten of er meer is, in plaats van het te gokken aan een
      // volle pagina. De extra rij wordt hieronder weer afgeknipt.
      .range(0, tot);
    if (error) throw error;
    const rijen = (data ?? []) as Melding[];
    return { meldingen: rijen.slice(0, tot), meer: rijen.length > tot };
  });
}

/**
 * Het aantal ongelezen meldingen, voor de teller in de balk.
 *
 * Een eigen count en niet "tel de ongelezen in de lijst": die lijst is
 * afgekapt op de recentste twintig, dus wie een nieuwe melding leest terwijl er
 * dertig oudere ongelezen onderin staan zou de teller zien terugvallen.
 * `head: true` haalt geen rijen op — alleen het getal.
 */
export function getOngelezenAantal(): Promise<number> {
  return cached("meldingen:ongelezen", async () => {
    const { count, error } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .is("read_at", null)
      .is("dismissed_at", null);
    if (error) throw error;
    return count ?? 0;
  });
}

/** Markeert één melding als gelezen. Bewust per item: het paneel openen mag
 *  niet betekenen dat je alles kwijt bent. */
export async function markeerGelezen(id: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .is("read_at", null);
  if (error) throw error;
  invalidate("meldingen");
}

/**
 * "Alles gelezen" voor wie de teller weg wil. De update raakt alleen je eigen
 * rijen (RLS) en alleen read_at (kolomgrant).
 *
 * Geeft sinds #1273 de geraakte ids terug, zodat "ongedaan maken" precies die
 * rijen kan terugzetten — en niet alles wat er intussen bij kwam.
 */
export async function markeerAllesGelezen(): Promise<string[]> {
  const { data, error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null)
    .is("dismissed_at", null)
    .select("id");
  if (error) throw error;
  invalidate("meldingen");
  return (data ?? []).map((r) => (r as { id: string }).id);
}

/** Ongedaan maken van "alles gelezen" (#1273). Geen botsing op de tag-index
 *  mogelijk: deze rijen wáren zojuist samen ongelezen. */
export async function zetAllesOngelezen(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: null })
    .in("id", ids);
  if (error) throw error;
  invalidate("meldingen");
}

/**
 * Terug op ongelezen (#1273).
 *
 * Kan botsen op de partiële unieke index (user_id, tag) where read_at is null:
 * staat er inmiddels een nieuwe óngelezen melding met dezelfde tag, dan zouden
 * er twee open rijen voor één gebeurtenis komen. Postgres geeft dan 23505 —
 * de aanroeper vertaalt dat in gewone taal.
 */
export async function markeerOngelezen(id: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: null })
    .eq("id", id);
  if (error) throw error;
  invalidate("meldingen");
}

/**
 * Wegvegen (#1273), zacht: de rij blijft staan met een dismissed_at.
 *
 * Ook read_at wordt gezet als die nog leeg was. Niet uit netheid: de tag-index
 * hierboven houdt één óngelezen rij per tag vast, en een weggeveegde-maar-
 * ongelezen rij zou die plek bezet houden — het volgende bericht over dezelfde
 * gebeurtenis werd dan stilletjes in de rij gevouwen die jij net had weggeveegd.
 */
export async function veegWeg(melding: Pick<Melding, "id" | "read_at">): Promise<void> {
  const nu = new Date().toISOString();
  const { error } = await supabase
    .from("notifications")
    .update({ dismissed_at: nu, read_at: melding.read_at ?? nu })
    .eq("id", melding.id);
  if (error) throw error;
  invalidate("meldingen");
}

/** "Ongedaan maken" na het wegvegen: alleen dismissed_at terug op null. De
 *  leesmarkering blijft — je hébt hem gezien. */
export async function zetTerug(id: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ dismissed_at: null })
    .eq("id", id);
  if (error) throw error;
  invalidate("meldingen");
}
