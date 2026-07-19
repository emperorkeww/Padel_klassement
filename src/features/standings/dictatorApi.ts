import { supabase } from "@/lib/supabase/client";
import { cached } from "@/lib/supabase/queryCache";

// De Troon met machtsbehoud (#545): de zittende dictator en de regeerduur komen
// uit `dictator_termijnen`, een server-side replay-tabel (zie de migratie). De
// UI leest hier enkel uit — wie de troon houdt is DB-bepaald, niet client-side
// afgeleid uit de rating-snapshot.

export interface HuidigeDictator {
  /** profile_id van de zittende dictator (== Row.key in het klassement). */
  profileId: string;
  /** Wanneer de lopende termijn begon (ISO). */
  begonOp: string;
  /** Rating waarmee de troon (opnieuw) geclaimd werd. */
  claimRating: number;
}

/** De zittende dictator: de enige lopende troon-termijn (`eindigde_op is null`),
 *  of null als de troon vacant is — dan valt de UI terug op de waarnemend
 *  dictator (#530). */
export function getHuidigeDictator(): Promise<HuidigeDictator | null> {
  return cached("dictator:huidig", async () => {
    const { data, error } = await supabase
      .from("dictator_termijnen")
      .select("profile_id, begon_op, claim_rating")
      .is("eindigde_op", null)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      profileId: data.profile_id,
      begonOp: data.begon_op,
      claimRating: data.claim_rating,
    };
  });
}

export interface Regeerduur {
  /** Totale regeertijd in ms, som over alle termijnen (de lopende telt tot nu). */
  totaalMs: number;
  /** Aantal ambtstermijnen (afgesloten + evt. lopende). */
  termijnen: number;
  /** True als deze speler nú op de troon zit (een lopende termijn heeft). */
  zittend: boolean;
}

/** Regeerduur-samenvatting voor een profiel (#545): som van alle troon-termijnen
 *  plus het aantal ambtstermijnen. Null als de speler nooit dictator was — dan
 *  toont het profiel geen erepalmpje. */
export function getRegeerduur(profileId: string): Promise<Regeerduur | null> {
  return cached(`dictator:regeerduur:${profileId}`, async () => {
    const { data, error } = await supabase
      .from("dictator_termijnen")
      .select("begon_op, eindigde_op")
      .eq("profile_id", profileId);
    if (error) throw error;
    if (!data || data.length === 0) return null;
    const nu = Date.now();
    let totaalMs = 0;
    let zittend = false;
    for (const t of data) {
      const start = new Date(t.begon_op).getTime();
      const eind = t.eindigde_op ? new Date(t.eindigde_op).getTime() : nu;
      totaalMs += Math.max(0, eind - start);
      if (!t.eindigde_op) zittend = true;
    }
    return { totaalMs, termijnen: data.length, zittend };
  });
}
