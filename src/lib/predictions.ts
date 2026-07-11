// Toto (#116): client-side evenknie van de databank-logica rond
// matchvoorspellingen. predictionPoints spiegelt public.prediction_points
// (supabase/schemas/functions/19_match_predictions.sql) en
// computePredictionStandings spiegelt de view group_prediction_standings,
// voor de seizoensstand die uit een gefilterde lijst berekend wordt.

import type { Profile } from "./types";

export interface MatchPrediction {
  match_id: string;
  player_id: string;
  group_id: string;
  predicted_team_id: string;
  /** Winkans van het getipte team op tipmoment (serverside snapshot). */
  win_chance: number;
  /** null = nog niet beoordeeld; 0 = fout of gelijkspel; >0 = juist. */
  points: number | null;
  created_at: string;
  updated_at: string;
}

export interface PredictionStanding {
  player_id: string;
  username: string;
  full_name: string | null;
  /** Aantal beoordeelde tips. */
  predicted: number;
  correct: number;
  points: number;
}

/**
 * Punten voor een juiste tip: staffel 1-4, omgekeerd evenredig met de
 * winkans. Favoriet (75%+) 1 punt, 50/50 3 punten, underdog (≤30%) 4.
 * Spiegel van public.prediction_points; Math.round en Postgres round()
 * ronden positieve halven allebei omhoog af.
 */
export function predictionPoints(chance: number): number {
  return Math.min(4, Math.max(1, Math.round((1 - chance) * 5)));
}

/** Sortering van het voorspellersklassement: punten ↓, juist ↓, tips ↑. */
export function byPredictionRank(
  a: { points: number; correct: number; predicted: number },
  b: { points: number; correct: number; predicted: number },
): number {
  return (
    b.points - a.points || b.correct - a.correct || a.predicted - b.predicted
  );
}

/**
 * Voorspellersklassement uit een lijst tips: alleen beoordeelde tips
 * (points != null) tellen mee, net als in de view. De aanroeper filtert
 * vooraf op seizoen (via de match-ids van dat seizoen).
 */
export function computePredictionStandings(
  predictions: MatchPrediction[],
  profiles: Record<string, Profile>,
): PredictionStanding[] {
  const lines = new Map<string, { predicted: number; correct: number; points: number }>();
  for (const p of predictions) {
    if (p.points === null) continue;
    const line = lines.get(p.player_id) ?? { predicted: 0, correct: 0, points: 0 };
    line.predicted++;
    if (p.points > 0) line.correct++;
    line.points += p.points;
    lines.set(p.player_id, line);
  }
  return [...lines.entries()]
    .map(([player_id, line]) => ({
      player_id,
      username: profiles[player_id]?.username ?? "",
      full_name: profiles[player_id]?.full_name ?? null,
      ...line,
    }))
    .sort((a, b) => byPredictionRank(a, b) || a.username.localeCompare(b.username));
}
