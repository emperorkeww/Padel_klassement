import { supabase } from "../../lib/supabase";
import { cached } from "../../lib/queryCache";
import type { PlayerStanding, TeamStanding } from "../../lib/types";

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
    return (data ?? []) as PlayerStanding[];
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
    return (data ?? []) as TeamStanding[];
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
    return (data ?? []) as PlayerStanding[];
  });
}
