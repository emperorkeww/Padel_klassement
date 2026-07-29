import { supabase } from "@/lib/supabase/client";
import { cached, invalidate } from "@/lib/supabase/queryCache";

// Netrollers (#809): hoeveel ballen gingen bij een speler via de netband
// alsnog binnen. Ruwe invoer, door de speler zelf ingevuld ná afloop — alleen
// hij weet het. De guard-trigger borgt dat je in die match stond en dat de
// match afgerond is; RLS dat je alleen je eigen teller schrijft.

export interface NetTouch {
  match_id: string;
  player_id: string;
  aantal: number;
}

/** Netrollers van alle spelers van één match. */
export function getMatchNetTouches(matchId: string): Promise<NetTouch[]> {
  return cached(`net-touches:match:${matchId}`, async () => {
    const { data, error } = await supabase
      .from("match_net_touches")
      .select("match_id, player_id, aantal")
      .eq("match_id", matchId);
    if (error) throw error;
    return data ?? [];
  });
}

/** Alle netrollers van één speler, over al zijn matches. Voedt de badge. */
export function getPlayerNetTouches(playerId: string): Promise<NetTouch[]> {
  return cached(`net-touches:player:${playerId}`, async () => {
    const { data, error } = await supabase
      .from("match_net_touches")
      .select("match_id, player_id, aantal")
      .eq("player_id", playerId);
    if (error) throw error;
    return data ?? [];
  });
}

/** Zet (of corrigeert) je eigen teller voor één match. */
export async function setNetTouches(
  matchId: string,
  playerId: string,
  aantal: number,
): Promise<void> {
  const { error } = await supabase
    .from("match_net_touches")
    .upsert(
      { match_id: matchId, player_id: playerId, aantal },
      { onConflict: "match_id,player_id" },
    );
  if (error) throw error;
  invalidate("net-touches");
}
