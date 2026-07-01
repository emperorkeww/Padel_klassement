import { supabase } from "../../lib/supabase";
import type { PlayerStanding, TeamStanding } from "../../lib/types";

export async function getPlayerStandings(): Promise<PlayerStanding[]> {
  const { data, error } = await supabase
    .from("player_standings")
    .select("*")
    .order("points", { ascending: false })
    .order("goal_diff", { ascending: false })
    .order("won", { ascending: false })
    .order("username", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getPlayerStanding(
  playerId: string,
): Promise<PlayerStanding | null> {
  const { data, error } = await supabase
    .from("player_standings")
    .select("*")
    .eq("player_id", playerId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getTeamStandings(): Promise<TeamStanding[]> {
  const { data, error } = await supabase
    .from("standings")
    .select("*")
    .order("points", { ascending: false })
    .order("goal_diff", { ascending: false })
    .order("won", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getGroupPlayerStandings(
  groupId: string,
): Promise<PlayerStanding[]> {
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
  return data ?? [];
}
