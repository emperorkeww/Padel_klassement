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
      .is("read_at", null);
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

/** "Alles gelezen" voor wie de teller weg wil. De update raakt alleen je eigen
 *  rijen (RLS) en alleen read_at (kolomgrant). */
export async function markeerAllesGelezen(): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);
  if (error) throw error;
  invalidate("meldingen");
}
