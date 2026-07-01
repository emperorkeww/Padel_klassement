// Handgeschreven types voor de databank-entiteiten (geen gegenereerde types).

export type MatchStatus = "scheduled" | "in_progress" | "completed" | "cancelled";
export type FriendshipStatus = "pending" | "accepted" | "declined";

export interface Profile {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface Team {
  id: string;
  name: string | null;
  player1_id: string;
  player2_id: string;
  created_at: string;
}

export interface Match {
  id: string;
  team_a_id: string;
  team_b_id: string;
  status: MatchStatus;
  winner_team_id: string | null;
  played_at: string | null;
  created_by: string | null;
  created_at: string;
  group_id: string | null;
  round_number: number | null;
  score_a: number | null;
  score_b: number | null;
}

export interface MatchPoint {
  id: string;
  match_id: string;
  set_number: number;
  game_number: number;
  point_number: number;
  won_by_team_id: string;
  is_golden_point: boolean;
  created_at: string;
}

export interface Group {
  id: string;
  name: string;
  created_by: string | null;
  created_at: string;
}

export interface GroupMember {
  group_id: string;
  player_id: string;
  role: "owner" | "member";
  joined_at: string;
}

export interface Friendship {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: FriendshipStatus;
  created_at: string;
  updated_at: string;
}

export interface TeamStanding {
  team_id: string;
  team_name: string | null;
  played: number;
  won: number;
  lost: number;
  points: number;
}

export interface PlayerStanding {
  player_id: string;
  username: string;
  full_name: string | null;
  played: number;
  won: number;
  lost: number;
  points: number;
}
