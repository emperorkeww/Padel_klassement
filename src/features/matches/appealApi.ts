import { supabase } from "@/lib/supabase/client";
import { cached, invalidate } from "@/lib/supabase/queryCache";
import type { TablesInsert } from "@/lib/supabase/database.types";
import type { AppealReden, PointAppeal, PointAppealVote } from "./appeal";

// Rudy's VAR (#1025): lezen en schrijven rond point_appeals. De guards en
// resolve_point_appeal (supabase/schemas/functions/36_point_appeals.sql) zijn
// de echte poort; appeal.ts spiegelt ze zodat de UI vooraf kan uitleggen wat
// er kan. Hier staat alleen het verkeer.

const KOLOMMEN =
  "id, match_id, claimant_id, set_number, reden, toelichting, status, snapshot_a, snapshot_b, play_date, votes_close_at, resolved_at, created_at";

/**
 * Een toegekend beroep verschuift de uitslag, en daarmee de hele afgeleide
 * keten: ratings, tips, pias, Zwarte Piet, bounty. Na een stem kan de uitspraak
 * dus meteen vallen, en moet alles wat aan een uitslag hangt opnieuw geladen
 * worden. Deze lijst loopt bewust in de pas met invalidateMatchData in api.ts
 * en met CACHE_PREFIXES.matches in useRealtime.ts.
 */
function invalidateNaUitspraak() {
  invalidate(
    "appeals",
    "matches",
    "standings",
    "teams",
    "ratings",
    "match-predictions",
    "prediction-standings",
    "pias",
    "shame",
    "bounties",
  );
}

/** Alle beroepen op één match, nieuwste eerst. */
export function getMatchAppeals(matchId: string): Promise<PointAppeal[]> {
  return cached(`appeals:match:${matchId}`, async () => {
    const { data, error } = await supabase
      .from("point_appeals")
      .select(KOLOMMEN)
      .eq("match_id", matchId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as PointAppeal[];
  });
}

/**
 * Alle beroepen van één speler. Voedt het beroepstegoed (één toekenning per
 * speeldag) en straks de VAR-badges.
 */
export function getPlayerAppeals(playerId: string): Promise<PointAppeal[]> {
  return cached(`appeals:player:${playerId}`, async () => {
    const { data, error } = await supabase
      .from("point_appeals")
      .select(KOLOMMEN)
      .eq("claimant_id", playerId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as PointAppeal[];
  });
}

/**
 * De openstaande zaken die voor jou zichtbaar zijn. RLS beperkt dat al tot je
 * eigen matches en je groepen; wie er daarvan mag stemmen bepaalt de kaart met
 * stemgerechtigden() uit appeal.ts.
 */
export function getOpenAppeals(): Promise<PointAppeal[]> {
  return cached("appeals:open", async () => {
    const { data, error } = await supabase
      .from("point_appeals")
      .select(KOLOMMEN)
      .eq("status", "open")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as PointAppeal[];
  });
}

/** De stemmen van één beroep — mét naam, dat is het punt. */
export function getAppealVotes(appealId: string): Promise<PointAppealVote[]> {
  return cached(`appeals:votes:${appealId}`, async () => {
    const { data, error } = await supabase
      .from("point_appeal_votes")
      .select("appeal_id, voter_id, akkoord, created_at")
      .eq("appeal_id", appealId)
      .order("created_at");
    if (error) throw error;
    return (data ?? []) as PointAppealVote[];
  });
}

/**
 * Tekent beroep aan tegen één punt. De guard vult snapshot, speeldag en
 * stemvenster serverside in; de client stuurt alleen wat hij mag zetten (zie de
 * kolom-grant in policies/point_appeals.sql).
 */
export async function createAppeal(params: {
  matchId: string;
  claimantId: string;
  reden: AppealReden;
  setNumber?: number | null;
  toelichting?: string | null;
}): Promise<void> {
  const { error } = await supabase.from("point_appeals").insert(
    // snapshot_a/-b, play_date en votes_close_at zijn in de Insert-types
    // verplicht (not null zonder default), maar de kolomgrants verbieden de
    // client ze aan te leveren: de guard-trigger leidt ze af uit de match.
    // Vandaar de smalle cast, zoals bij de lef-tip en de toto.
    {
      match_id: params.matchId,
      claimant_id: params.claimantId,
      reden: params.reden,
      set_number: params.setNumber ?? null,
      toelichting: params.toelichting?.trim()
        ? params.toelichting.trim()
        : null,
    } as TablesInsert<"point_appeals">,
  );
  // Ook ná een fout: botst de insert op het tegoed of op het open beroep, dan
  // klopte het beeld dat de client had niet meer en moet die cache hoe dan ook
  // weg (zelfde reden als bij setStake).
  invalidate("appeals");
  if (error) throw error;
}

/**
 * Brengt je stem uit. Valt daarmee de uitspraak, dan corrigeert de trigger de
 * uitslag in dezelfde transactie — vandaar de brede invalidatie.
 */
export async function castAppealVote(params: {
  appealId: string;
  voterId: string;
  akkoord: boolean;
}): Promise<void> {
  const { error } = await supabase.from("point_appeal_votes").insert({
    appeal_id: params.appealId,
    voter_id: params.voterId,
    akkoord: params.akkoord,
  });
  if (error) throw error;
  invalidateNaUitspraak();
}
