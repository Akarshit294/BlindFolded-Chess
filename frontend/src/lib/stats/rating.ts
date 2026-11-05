/**
 * Elo-style ratings. Everything is local, so these are "rating-ish": a motivating number that
 * moves sensibly, not an official rating.
 */
export const DEFAULT_RATING = 1200;

export function expectedScore(rating: number, opponent: number): number {
  return 1 / (1 + 10 ** ((opponent - rating) / 400));
}

/** K shrinks as you play more (40 for the first 10 results, then 24). */
export function kFactor(played: number): number {
  return played < 10 ? 40 : 24;
}

/** New rating after a result (score 1 = win, 0.5 = draw, 0 = loss). */
export function updateRating(rating: number, opponent: number, score: number, played: number): number {
  const delta = kFactor(played) * (score - expectedScore(rating, opponent));
  return Math.round(Math.max(100, Math.min(3400, rating + delta)));
}

/**
 * Drill rating: each session is treated as a "game" against the drill level's difficulty,
 * with the session accuracy as the score.
 */
export const DRILL_LEVEL_DIFFICULTY = [800, 1100, 1400, 1700, 2000] as const;

export function drillOpponent(level: number): number {
  return DRILL_LEVEL_DIFFICULTY[Math.max(0, Math.min(DRILL_LEVEL_DIFFICULTY.length - 1, level - 1))]!;
}

export function updateDrillRating(rating: number, level: number, accuracy: number, played: number): number {
  return updateRating(rating, drillOpponent(level), Math.max(0, Math.min(1, accuracy)), played);
}

/** Consecutive days (ending today or yesterday) with at least one activity. */
export function computeStreak(timestamps: number[], now = Date.now()): { current: number; best: number } {
  if (timestamps.length === 0) return { current: 0, best: 0 };
  const dayKey = (t: number) => {
    const d = new Date(t);
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000;
  };
  const days = [...new Set(timestamps.map(dayKey))].sort((a, b) => a - b);
  let best = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    run = days[i]! - days[i - 1]! === 1 ? run + 1 : 1;
    best = Math.max(best, run);
  }
  const today = dayKey(now);
  const last = days[days.length - 1]!;
  let current = 0;
  if (today - last <= 1) {
    current = 1;
    for (let i = days.length - 1; i > 0; i--) {
      if (days[i]! - days[i - 1]! === 1) current++;
      else break;
    }
  }
  return { current, best };
}
