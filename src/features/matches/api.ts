import { supabase } from "@/lib/supabase/client";
import { cached, invalidate } from "@/lib/supabase/queryCache";
import type { TablesUpdate } from "@/lib/supabase/database.types";
import type { Match, Profile, Team } from "@/types";
import { displayName } from "@/features/profiles/api";

// Alles wat een uitslag raakt: matchlijsten, standen (views), teams (nieuwe
// paren bij het loggen), ratings (trigger herrekent ze) en tips (de
// grading-trigger beoordeelt ze bij een uitslag of correctie, #116).
function invalidateMatchData() {
  invalidate(
    "matches",
    "standings",
    "teams",
    "ratings",
    "match-predictions",
    "prediction-standings",
  );
}

// Per-set uitslag: paar [games team A, games team B].
export type SetScore = [number, number];

/** Leest de optionele per-set uitslag van een match veilig uit (jsonb-kolom).
 *  Ongeldige/halfvolle data wordt genegeerd. */
export function readSetScores(match: Match): SetScore[] | null {
  const raw = match.set_scores;
  if (!Array.isArray(raw)) return null;
  const sets = raw.filter(
    (s): s is SetScore =>
      Array.isArray(s) &&
      s.length === 2 &&
      typeof s[0] === "number" &&
      typeof s[1] === "number",
  );
  return sets.length > 0 ? sets : null;
}

/** "6-4 3-6 7-5" voor weergave; lege input geeft een lege string. */
export function formatSetScores(sets: SetScore[] | null | undefined): string {
  if (!sets || sets.length === 0) return "";
  return sets.map(([a, b]) => `${a}-${b}`).join(" ");
}

/** Eén bewerkbare set-rij in de UI; lege strings = nog niet ingevuld. */
export type SetPair = { a: string; b: string };

export const emptySet = (): SetPair => ({ a: "", b: "" });

/** Bewerkbare rijen -> [games A, games B]-paren. Half-lege of ongeldige rijen
 *  vallen weg, zodat een lege set-invoer gewoon "geen set-stand" betekent. */
export function toSetScores(sets: SetPair[]): SetScore[] {
  const out: SetScore[] = [];
  for (const s of sets) {
    if (s.a === "" || s.b === "") continue;
    const a = Number(s.a);
    const b = Number(s.b);
    if (Number.isFinite(a) && Number.isFinite(b) && a >= 0 && b >= 0)
      out.push([a, b]);
  }
  return out;
}

export function getMatch(id: string): Promise<Match | null> {
  return cached(`matches:one:${id}`, async () => {
    const { data, error } = await supabase
      .from("matches")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data;
  });
}

export function getTeamsMap(): Promise<Record<string, Team>> {
  return cached("teams:all", async () => {
    const { data, error } = await supabase.from("teams").select("*");
    if (error) throw error;
    return Object.fromEntries((data ?? []).map((t) => [t.id, t]));
  });
}

/** Alleen de opgegeven teams — voor pagina's die er maar enkele nodig hebben. */
export function getTeamsByIds(ids: string[]): Promise<Record<string, Team>> {
  const wanted = [...new Set(ids)].sort();
  if (wanted.length === 0) return Promise.resolve({});
  return cached(`teams:ids:${wanted.join(",")}`, async () => {
    const { data, error } = await supabase
      .from("teams")
      .select("*")
      .in("id", wanted);
    if (error) throw error;
    return Object.fromEntries((data ?? []).map((t) => [t.id, t]));
  });
}

export function getGroupMatches(groupId: string): Promise<Match[]> {
  return cached(`matches:group:${groupId}`, async () => {
    const { data, error } = await supabase
      .from("matches")
      .select("*")
      .eq("group_id", groupId)
      .order("round_number", { ascending: false })
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data ?? [];
  });
}

/** Recente matches waarin een speler meedeed (via zijn teams). */
export function getPlayerMatches(
  playerId: string,
  limit = 20,
): Promise<Match[]> {
  return cached(`matches:player:${playerId}:${limit}`, async () => {
    const { data: teamRows, error: te } = await supabase
      .from("teams")
      .select("id")
      .or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`);
    if (te) throw te;
    const ids = (teamRows ?? []).map((t) => t.id);
    if (ids.length === 0) return [];

    const list = ids.join(",");
    const { data, error } = await supabase
      .from("matches")
      .select("*")
      .or(`team_a_id.in.(${list}),team_b_id.in.(${list})`)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  });
}

/** Afgeronde matches binnen [start, einde) — voor de seizoensstand. */
export function getCompletedMatchesBetween(
  startIso: string,
  endIso: string,
): Promise<Match[]> {
  return cached(`matches:between:${startIso}:${endIso}`, async () => {
    const { data, error } = await supabase
      .from("matches")
      .select("*")
      .eq("status", "completed")
      .gte("played_at", startIso)
      .lt("played_at", endIso);
    if (error) throw error;
    return data ?? [];
  });
}

/** Datum van de allereerste match (bepaalt de seizoenslijst); null zonder matches. */
export function getFirstMatchDate(): Promise<string | null> {
  return cached("matches:first", async () => {
    const { data, error } = await supabase
      .from("matches")
      .select("played_at, created_at")
      .order("created_at", { ascending: true })
      .limit(1);
    if (error) throw error;
    const first = data?.[0];
    return first ? (first.played_at ?? first.created_at) : null;
  });
}

export function getRecentMatches(limit = 20): Promise<Match[]> {
  return cached(`matches:recent:${limit}`, async () => {
    const { data, error } = await supabase
      .from("matches")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  });
}

/** Laatst gespeelde uitslagen (alleen afgeronde matches), nieuwste eerst. */
export function getRecentResults(limit = 6): Promise<Match[]> {
  return cached(`matches:results:${limit}`, async () => {
    const { data, error } = await supabase
      .from("matches")
      .select("*")
      .eq("status", "completed")
      .order("played_at", { ascending: false, nullsFirst: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  });
}

/** Maakt een gastspeler aan (naam-only, geen account) en geeft zijn id terug.
 *  De gast is eigendom van de ingelogde gebruiker en kan meteen in een match. */
export async function createGuestPlayer(name: string): Promise<string> {
  const { data, error } = await supabase.rpc("create_guest_player", {
    p_name: name,
  });
  if (error) throw error;
  // De gecachte profielenlijst is nu verouderd: wissen zodat de gast overal
  // (spelerskiezer, groep-leden) meteen met zijn naam verschijnt i.p.v. "Onbekend".
  invalidate("profiles");
  return data as string;
}

/** Logt een afgeronde match via de SECURITY DEFINER RPC. */
export async function createCompletedMatch(params: {
  a1: string;
  a2: string;
  b1: string;
  b2: string;
  winner: "a" | "b" | "draw";
  scoreA?: number | null;
  scoreB?: number | null;
  groupId?: string | null;
  setScores?: SetScore[] | null;
}): Promise<string> {
  const { data, error } = await supabase.rpc("create_completed_match", {
    p_a1: params.a1,
    p_a2: params.a2,
    p_b1: params.b1,
    p_b2: params.b2,
    p_winner: params.winner,
    p_score_a: params.scoreA ?? undefined,
    p_score_b: params.scoreB ?? undefined,
    p_group_id: params.groupId ?? undefined,
    p_set_scores: params.setScores ?? undefined,
  });
  if (error) throw error;
  invalidateMatchData();
  return data as string;
}

/** Plant een match vooraf (status 'scheduled') via de SECURITY DEFINER RPC.
 *  playedAt is het optionele geplande tijdstip; de uitslag volgt later via
 *  setMatchResult (inline op de kaart "Te spelen"). */
export async function createPlannedMatch(params: {
  a1: string;
  a2: string;
  b1: string;
  b2: string;
  playedAt?: string | null;
  groupId?: string | null;
  setScores?: SetScore[] | null;
}): Promise<string> {
  const { data, error } = await supabase.rpc("create_planned_match", {
    p_a1: params.a1,
    p_a2: params.a2,
    p_b1: params.b1,
    p_b2: params.b2,
    p_played_at: params.playedAt ?? undefined,
    p_group_id: params.groupId ?? undefined,
    p_set_scores: params.setScores ?? undefined,
  });
  if (error) throw error;
  invalidateMatchData();
  return data as string;
}

/** Zet het resultaat van een bestaande (geplande) match. winnerTeamId null = gelijkspel.
 *  Werkt alleen op een nog niet afgeronde match: als iemand anders net eerder
 *  opsloeg, faalt dit met een duidelijke melding i.p.v. stil te overschrijven. */
export async function setMatchResult(params: {
  matchId: string;
  winnerTeamId: string | null;
  scoreA?: number | null;
  scoreB?: number | null;
  setScores?: SetScore[] | null;
}): Promise<void> {
  const { data, error } = await supabase
    .from("matches")
    .update({
      status: "completed",
      winner_team_id: params.winnerTeamId,
      score_a: params.scoreA ?? null,
      score_b: params.scoreB ?? null,
      set_scores: params.setScores ?? null,
      played_at: new Date().toISOString(),
    })
    .eq("id", params.matchId)
    .neq("status", "completed")
    .select("id");
  if (error) throw error;
  invalidateMatchData();
  if (!data || data.length === 0)
    throw new Error("Deze uitslag is al door iemand anders ingevuld.");
}

/**
 * Corrigeert de eindscore van een reeds afgeronde match. Alleen de aanmaker
 * mag dit (RLS). Anders dan setMatchResult blijft played_at behouden — het is
 * een correctie, geen nieuwe uitslag. De winnaar volgt uit de score.
 */
export async function updateMatchScore(params: {
  matchId: string;
  winnerTeamId: string | null;
  scoreA: number;
  scoreB: number;
  /** Optioneel: laat weg om de bestaande set-stand te behouden; null wist hem. */
  setScores?: SetScore[] | null;
}): Promise<void> {
  const patch: TablesUpdate<"matches"> = {
    winner_team_id: params.winnerTeamId,
    score_a: params.scoreA,
    score_b: params.scoreB,
  };
  // Alleen aanraken als expliciet meegegeven, zodat een score-correctie zonder
  // set-invoer de bestaande set-stand niet per ongeluk wist.
  if (params.setScores !== undefined) patch.set_scores = params.setScores;
  const { error } = await supabase
    .from("matches")
    .update(patch)
    .eq("id", params.matchId);
  if (error) throw error;
  invalidateMatchData();
}

/** Verplaatst een geplande match naar een ander tijdstip (of wist het tijdstip
 *  met null). Alleen de aanmaker mag dit (RLS). */
export async function updatePlannedMatchTime(params: {
  matchId: string;
  playedAt: string | null;
}): Promise<void> {
  const { error } = await supabase
    .from("matches")
    .update({ played_at: params.playedAt })
    .eq("id", params.matchId)
    .neq("status", "completed");
  if (error) throw error;
  invalidateMatchData();
}

/** Verwijdert een niet-afgeronde match via de SECURITY DEFINER RPC (alleen de
 *  aanmaker; een afgeronde match kan niet weg — dat zou stand/ratings raken). */
export async function deleteMatch(matchId: string): Promise<void> {
  const { error } = await supabase.rpc("delete_match", {
    p_match_id: matchId,
  });
  if (error) throw error;
  invalidateMatchData();
}

/** "Alice & Bob" op basis van een team en de profielen-map. */
export function teamLabel(
  team: Team | undefined,
  profiles: Record<string, Profile>,
): string {
  if (!team) return "Onbekend team";
  if (team.name) return team.name;
  return `${displayName(profiles[team.player1_id])} & ${displayName(profiles[team.player2_id])}`;
}
