import { supabase } from "@/lib/supabase/client";
import { cached } from "@/lib/supabase/queryCache";
import { warnIfTruncated } from "@/lib/supabase/truncation";
import type { PlayerStanding, TeamStanding } from "@/types";

export function getPlayerStandings(): Promise<PlayerStanding[]> {
  return cached("standings:players", async () => {
    const { data, error } = await supabase
      .from("player_standings")
      .select("*")
      .order("points", { ascending: false })
      .order("goal_diff", { ascending: false })
      .order("won", { ascending: false })
      .order("username", { ascending: true });
    if (error) throw error;
    // Views typen alle kolommen als nullable; in de praktijk zijn ze gevuld.
    return warnIfTruncated((data ?? []) as PlayerStanding[], "player_standings");
  });
}

export function getPlayerStanding(
  playerId: string,
): Promise<PlayerStanding | null> {
  return cached(`standings:player:${playerId}`, async () => {
    const { data, error } = await supabase
      .from("player_standings")
      .select("*")
      .eq("player_id", playerId)
      .maybeSingle();
    if (error) throw error;
    return data as PlayerStanding | null;
  });
}

export function getTeamStandings(): Promise<TeamStanding[]> {
  return cached("standings:teams", async () => {
    const { data, error } = await supabase
      .from("standings")
      .select("*")
      .order("points", { ascending: false })
      .order("goal_diff", { ascending: false })
      .order("won", { ascending: false });
    if (error) throw error;
    return warnIfTruncated((data ?? []) as TeamStanding[], "standings");
  });
}

/** Seizoensstand per speler binnen [start, einde). Via een SECURITY DEFINER RPC
 *  (#461) zodat de kwartaalstand globaal blijft: de ruwe matches-tabel is sinds
 *  #461 niet meer publiek, dus de vroegere client-side berekening zou hem
 *  per-kijker maken. De RPC geeft enkel het aggregaat terug. */
export function getSeasonPlayerStandings(
  startIso: string,
  endIso: string,
): Promise<PlayerStanding[]> {
  return cached(`standings:season:players:${startIso}:${endIso}`, async () => {
    const { data, error } = await supabase
      .rpc("season_player_standings", { p_start: startIso, p_end: endIso })
      .order("points", { ascending: false })
      .order("goal_diff", { ascending: false })
      .order("won", { ascending: false })
      .order("username", { ascending: true });
    if (error) throw error;
    // Ook een RPC-resultaat gaat door max_rows heen (#731).
    return warnIfTruncated(
      (data ?? []) as PlayerStanding[],
      "season_player_standings",
    );
  });
}

/** Seizoensstand per team binnen [start, einde). Zie getSeasonPlayerStandings. */
export function getSeasonTeamStandings(
  startIso: string,
  endIso: string,
): Promise<TeamStanding[]> {
  return cached(`standings:season:teams:${startIso}:${endIso}`, async () => {
    const { data, error } = await supabase
      .rpc("season_team_standings", { p_start: startIso, p_end: endIso })
      .order("points", { ascending: false })
      .order("goal_diff", { ascending: false })
      .order("won", { ascending: false });
    if (error) throw error;
    return warnIfTruncated(
      (data ?? []) as TeamStanding[],
      "season_team_standings",
    );
  });
}

export function getGroupPlayerStandings(
  groupId: string,
): Promise<PlayerStanding[]> {
  return cached(`standings:group:${groupId}`, async () => {
    const { data, error } = await supabase
      .from("group_player_standings")
      .select(
        "player_id, username, full_name, played, won, drawn, lost, points, goal_diff",
      )
      .eq("group_id", groupId)
      .order("points", { ascending: false })
      .order("goal_diff", { ascending: false })
      .order("won", { ascending: false });
    if (error) throw error;
    return warnIfTruncated(
      (data ?? []) as PlayerStanding[],
      `group_player_standings (groep ${groupId})`,
    );
  });
}
