import { supabase } from "../../lib/supabase";
import { cached, invalidate } from "../../lib/queryCache";
import type { Match, Profile, Team } from "../../lib/types";
import { displayName } from "../profiles/api";

// Alles wat een uitslag raakt: matchlijsten, standen (views), teams (nieuwe
// paren bij het loggen) en ratings (trigger herrekent ze).
function invalidateMatchData() {
  invalidate("matches", "standings", "teams", "ratings");
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
}): Promise<void> {
  const { data, error } = await supabase
    .from("matches")
    .update({
      status: "completed",
      winner_team_id: params.winnerTeamId,
      score_a: params.scoreA ?? null,
      score_b: params.scoreB ?? null,
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
}): Promise<void> {
  const { error } = await supabase
    .from("matches")
    .update({
      winner_team_id: params.winnerTeamId,
      score_a: params.scoreA,
      score_b: params.scoreB,
    })
    .eq("id", params.matchId);
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
