// Gedeelde testdata voor de pagina-tests: vier spelers, twee vaste teams,
// één afgeronde en één geplande (Americano-)match in groep g1.

const NOW = "2026-07-02T10:00:00.000Z";

export const PROFILES = [
  { id: "p1", username: "alice", full_name: "Alice Anders", avatar_url: null, created_at: NOW },
  { id: "p2", username: "bob", full_name: "Bob Boers", avatar_url: null, created_at: NOW },
  { id: "p3", username: "carol", full_name: "Carol Claes", avatar_url: null, created_at: NOW },
  { id: "p4", username: "dave", full_name: "Dave De Vos", avatar_url: null, created_at: NOW },
];

export const TEAMS = [
  { id: "t-ab", name: null, player1_id: "p1", player2_id: "p2", created_at: NOW },
  { id: "t-cd", name: null, player1_id: "p3", player2_id: "p4", created_at: NOW },
];

export const MATCH_DONE = {
  id: "m-done",
  team_a_id: "t-ab",
  team_b_id: "t-cd",
  status: "completed",
  winner_team_id: "t-ab",
  score_a: 6,
  score_b: 3,
  played_at: NOW,
  created_at: NOW,
  created_by: "p1",
  group_id: "g1",
  round_number: 1,
};

export const MATCH_PLANNED = {
  id: "m-plan",
  team_a_id: "t-ab",
  team_b_id: "t-cd",
  status: "scheduled",
  winner_team_id: null,
  score_a: null,
  score_b: null,
  played_at: null,
  created_at: NOW,
  created_by: "p1",
  group_id: "g1",
  round_number: 2,
};

export const FRIENDSHIPS = [
  { id: "f2", requester_id: "p1", addressee_id: "p2", status: "accepted", created_at: NOW, updated_at: NOW },
  { id: "f3", requester_id: "p1", addressee_id: "p3", status: "accepted", created_at: NOW, updated_at: NOW },
  { id: "f4", requester_id: "p4", addressee_id: "p1", status: "accepted", created_at: NOW, updated_at: NOW },
];

export const GROUP_MEMBERS = [
  { group_id: "g1", player_id: "p1", role: "owner", joined_at: NOW },
  { group_id: "g1", player_id: "p2", role: "member", joined_at: NOW },
  { group_id: "g1", player_id: "p3", role: "member", joined_at: NOW },
  { group_id: "g1", player_id: "p4", role: "member", joined_at: NOW },
];

export const GROUPS = [
  {
    id: "g1",
    name: "Vrijdagavond Padel",
    created_by: "p1",
    created_at: NOW,
    // PostgREST-embed zoals getMyGroups hem opvraagt.
    group_members: GROUP_MEMBERS.map((m) => ({ player_id: m.player_id })),
  },
];

export const PLAYER_STANDINGS = [
  { player_id: "p1", username: "alice", full_name: "Alice Anders", played: 1, won: 1, drawn: 0, lost: 0, points: 3, goal_diff: 3 },
  { player_id: "p2", username: "bob", full_name: "Bob Boers", played: 1, won: 1, drawn: 0, lost: 0, points: 3, goal_diff: 3 },
  { player_id: "p3", username: "carol", full_name: "Carol Claes", played: 1, won: 0, drawn: 0, lost: 1, points: 0, goal_diff: -3 },
  { player_id: "p4", username: "dave", full_name: "Dave De Vos", played: 1, won: 0, drawn: 0, lost: 1, points: 0, goal_diff: -3 },
];

export const PLAYER_RATINGS = [
  { player_id: "p1", rating: 1012, games: 1, updated_at: NOW },
  { player_id: "p2", rating: 1012, games: 1, updated_at: NOW },
  { player_id: "p3", rating: 988, games: 1, updated_at: NOW },
  { player_id: "p4", rating: 988, games: 1, updated_at: NOW },
];

// Alle vier de leden zeiden "ja" voor de speeldag. De mock filtert niet op
// datum, dus de datum hier hoeft niet gelijk te lopen met "vandaag" in de test.
export const ATTENDANCE = PROFILES.map((p) => ({
  group_id: "g1",
  player_id: p.id,
  date: "2026-07-02",
  status: "yes",
  updated_at: NOW,
}));

export const RATING_HISTORY = [
  { player_id: "p1", match_id: "m-0", rating_before: 1000, rating_after: 1005, delta: 5, played_at: "2026-07-01T10:00:00.000Z" },
  { player_id: "p1", match_id: "m-done", rating_before: 1005, rating_after: 1012, delta: 7, played_at: NOW },
];

/** Alle tabellen samen — handig als vertrekpunt per test. */
export const TABLES = {
  profiles: PROFILES,
  teams: TEAMS,
  matches: [MATCH_DONE, MATCH_PLANNED],
  friendships: FRIENDSHIPS,
  groups: GROUPS,
  group_members: GROUP_MEMBERS,
  player_standings: PLAYER_STANDINGS,
  group_player_standings: PLAYER_STANDINGS.map((r) => ({ ...r, group_id: "g1" })),
  standings: [
    { team_id: "t-ab", team_name: null, played: 1, won: 1, drawn: 0, lost: 0, points: 3, goal_diff: 3 },
  ],
  player_ratings: PLAYER_RATINGS,
  rating_history: RATING_HISTORY,
  attendance: ATTENDANCE,
};

export const SESSION = { user: { id: "p1", email: "alice@example.com" } };
