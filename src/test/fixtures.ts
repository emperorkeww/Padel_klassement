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
  // Singles-"teams" (1v1, #279): player2_id is null.
  { id: "t-a", name: null, player1_id: "p1", player2_id: null, created_at: NOW },
  { id: "t-c", name: null, player1_id: "p3", player2_id: null, created_at: NOW },
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
  format: "2v2",
};

// Afgeronde 1v1 (#279): Alice versloeg Carol. Bewust niet in TABLES.matches
// opgenomen zodat bestaande tests ongemoeid blijven; tests voegen hem zelf toe.
export const MATCH_SINGLES = {
  id: "m-single",
  team_a_id: "t-a",
  team_b_id: "t-c",
  status: "completed",
  winner_team_id: "t-a",
  score_a: 6,
  score_b: 2,
  played_at: NOW,
  created_at: NOW,
  created_by: "p1",
  group_id: "g1",
  round_number: null,
  format: "1v1",
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
  format: "2v2",
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

// Eén open speeldag-poll van Alice met een optie ver vooruit; Bob kan,
// Carol twijfelt. De datum ligt ver vooruit omdat de UI client-side op
// "vandaag of later" filtert.
export const PLAY_POLLS = [
  {
    id: "poll-1",
    group_id: "g1",
    created_by: "p1",
    status: "open",
    locked_option_id: null,
    created_at: NOW,
  },
];
export const PLAY_POLL_OPTIONS = [
  {
    id: "opt-far",
    poll_id: "poll-1",
    group_id: "g1",
    date: "2030-01-05",
    start_time: "20:00",
    duration: 90,
    courts_free: 2,
    created_at: NOW,
  },
];
export const PLAY_POLL_VOTES = [
  { option_id: "opt-far", group_id: "g1", player_id: "p1", status: "yes", updated_at: NOW },
  { option_id: "opt-far", group_id: "g1", player_id: "p2", status: "yes", updated_at: NOW },
  { option_id: "opt-far", group_id: "g1", player_id: "p3", status: "maybe", updated_at: NOW },
];

// Toto (#116): Carol tipte team A op de geplande match (nog niet beoordeeld);
// het klassement heeft twee voorspellers met beoordeelde tips.
export const MATCH_PREDICTIONS = [
  {
    match_id: "m-plan",
    player_id: "p3",
    group_id: "g1",
    predicted_team_id: "t-ab",
    win_chance: 0.53,
    points: null,
    created_at: NOW,
    updated_at: NOW,
  },
];

export const PREDICTION_STANDINGS = [
  { group_id: "g1", player_id: "p3", username: "carol", full_name: "Carol Claes", predicted: 3, correct: 2, points: 5 },
  { group_id: "g1", player_id: "p1", username: "alice", full_name: "Alice Anders", predicted: 2, correct: 1, points: 2 },
];

export const RATING_HISTORY = [
  { player_id: "p1", match_id: "m-0", rating_before: 1000, rating_after: 1005, delta: 5, played_at: "2026-07-01T10:00:00.000Z" },
  { player_id: "p1", match_id: "m-done", rating_before: 1005, rating_after: 1012, delta: 7, played_at: NOW },
];

// Chemie-fixtures voor de opstelling (#427): vijf extra afgewerkte duo-matches
// (drempel MIN_SAMEN_CHEMIE = 5) waarin p1+p2 gemiddeld +4 Elo/match halen
// (chemie hoog) en p3+p4 −4 (laag). Bewust niet in TABLES (zie MATCH_SINGLES):
// de mock filtert niet, dus dit zou bestaande pagina-tests raken; tests geven
// deze exports zelf als props of tabel mee.
const LINEUP_DELTAS = [6, 5, 7, 4, -2]; // som +20 → gemiddeld +4 voor team A
export const LINEUP_MATCHES = LINEUP_DELTAS.map((delta, i) => ({
  id: `m-c${i + 1}`,
  team_a_id: "t-ab",
  team_b_id: "t-cd",
  status: "completed",
  winner_team_id: delta > 0 ? "t-ab" : "t-cd",
  score_a: delta > 0 ? 6 : 3,
  score_b: delta > 0 ? 3 : 6,
  played_at: `2026-06-${10 + i}T10:00:00.000Z`,
  created_at: `2026-06-${10 + i}T10:00:00.000Z`,
  created_by: "p1",
  group_id: "g1",
  round_number: null,
  format: "2v2",
}));

export const LINEUP_HISTORY = ["p1", "p2", "p3", "p4"].flatMap((pid) => {
  let rating = 1000;
  return LINEUP_DELTAS.map((d, i) => {
    const delta = pid === "p1" || pid === "p2" ? d : -d;
    const rij = {
      player_id: pid,
      match_id: `m-c${i + 1}`,
      rating_before: rating,
      rating_after: rating + delta,
      delta,
      played_at: `2026-06-${10 + i}T10:00:00.000Z`,
    };
    rating += delta;
    return rij;
  });
});

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
  play_polls: PLAY_POLLS,
  play_poll_options: PLAY_POLL_OPTIONS,
  play_poll_votes: PLAY_POLL_VOTES,
  match_predictions: MATCH_PREDICTIONS,
  // Netrollers (#809): p2 telde er twee op de afgeronde match.
  match_net_touches: [{ match_id: "m-done", player_id: "p2", aantal: 2 }],
  group_prediction_standings: PREDICTION_STANDINGS,
};

export const SESSION = { user: { id: "p1", email: "alice@example.com" } };
