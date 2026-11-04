/** Turns stored records into dashboard numbers. Pure functions — unit tested. */
import type { DrillId, DrillSession, GameRecord, PuzzleAttempt } from "@/lib/storage/types";
import { computeStreak, DEFAULT_RATING } from "./rating";

export type Point = { t: number; v: number };

/** Rating history as points, starting from the default rating just before the first event. */
export function ratingSeries(events: Array<{ t: number; rating: number | undefined }>): Point[] {
  const pts = events.filter((e): e is { t: number; rating: number } => typeof e.rating === "number").sort((a, b) => a.t - b.t);
  if (pts.length === 0) return [];
  return [{ t: pts[0]!.t - 1, v: DEFAULT_RATING }, ...pts.map((p) => ({ t: p.t, v: p.rating }))];
}

export function blindfoldRatingSeries(games: GameRecord[]): Point[] {
  return ratingSeries(games.filter((g) => g.config.mode === "rated" && g.result).map((g) => ({ t: g.endedAt ?? g.startedAt, rating: g.ratingAfter })));
}

export function puzzleRatingSeries(attempts: PuzzleAttempt[]): Point[] {
  return ratingSeries(attempts.map((a) => ({ t: a.ts, rating: a.ratingAfter })));
}

export function drillAccuracySeries(sessions: DrillSession[], drill: DrillId): Point[] {
  return sessions
    .filter((s) => s.drill === drill && s.total > 0)
    .sort((a, b) => a.startedAt - b.startedAt)
    .map((s) => ({ t: s.startedAt, v: Math.round(s.accuracy * 1000) / 10 }));
}

export function gameAccuracySeries(games: GameRecord[]): Point[] {
  return games
    .filter((g) => g.result && g.analysis)
    .map((g) => {
      const acc = g.config.playerColor === "w" ? g.analysis!.accuracy.white : g.analysis!.accuracy.black;
      return acc === null ? null : { t: g.endedAt ?? g.startedAt, v: acc };
    })
    .filter((p): p is Point => p !== null)
    .sort((a, b) => a.t - b.t);
}

export type GameTotals = { played: number; wins: number; draws: number; losses: number; rated: number };

export function gameTotals(games: GameRecord[]): GameTotals {
  const out: GameTotals = { played: 0, wins: 0, draws: 0, losses: 0, rated: 0 };
  for (const g of games) {
    if (!g.result) continue;
    out.played++;
    if (g.config.mode === "rated") out.rated++;
    if (g.result.winner === null) out.draws++;
    else if (g.result.winner === g.config.playerColor) out.wins++;
    else out.losses++;
  }
  return out;
}

export type PuzzleTotals = { attempts: number; solved: number; firstTry: number; byGoal: Array<{ goal: string; attempts: number; solved: number }> };

export function puzzleTotals(attempts: PuzzleAttempt[]): PuzzleTotals {
  const goals = ["mate1", "mate2", "mate3", "win"];
  return {
    attempts: attempts.length,
    solved: attempts.filter((a) => a.solved).length,
    firstTry: attempts.filter((a) => a.firstTry).length,
    byGoal: goals.map((goal) => {
      const list = attempts.filter((a) => a.goal === goal);
      return { goal, attempts: list.length, solved: list.filter((a) => a.solved).length };
    }),
  };
}

/** Milliseconds spent training (games + drills + puzzles). */
export function trainingTime(games: GameRecord[], sessions: DrillSession[], attempts: PuzzleAttempt[]): number {
  const g = games.reduce((sum, x) => sum + Math.max(0, (x.endedAt ?? x.updatedAt) - x.startedAt), 0);
  const d = sessions.reduce((sum, x) => sum + x.durationMs, 0);
  const p = attempts.reduce((sum, x) => sum + x.timeMs, 0);
  return g + d + p;
}

export function activityTimestamps(games: GameRecord[], sessions: DrillSession[], attempts: PuzzleAttempt[]): number[] {
  return [...games.map((g) => g.startedAt), ...sessions.map((s) => s.startedAt), ...attempts.map((a) => a.ts)];
}

export function streaks(games: GameRecord[], sessions: DrillSession[], attempts: PuzzleAttempt[], now = Date.now()) {
  return computeStreak(activityTimestamps(games, sessions, attempts), now);
}

/** Activity count per local day for the last `weeks` weeks, oldest first, aligned to weeks starting Monday. */
export function activityGrid(timestamps: number[], weeks = 16, now = Date.now()): Array<{ day: number; count: number }> {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const dow = (today.getDay() + 6) % 7; // Monday = 0
  const start = new Date(today);
  start.setDate(today.getDate() - dow - (weeks - 1) * 7);
  const counts = new Map<number, number>();
  for (const ts of timestamps) {
    const d = new Date(ts);
    d.setHours(0, 0, 0, 0);
    counts.set(d.getTime(), (counts.get(d.getTime()) ?? 0) + 1);
  }
  const out: Array<{ day: number; count: number }> = [];
  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    if (d.getTime() > today.getTime()) break;
    out.push({ day: d.getTime(), count: counts.get(d.getTime()) ?? 0 });
  }
  return out;
}

/** Clean axis ticks ("nice numbers") covering [min, max]. */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  if (min === max) {
    min -= 50;
    max += 50;
  }
  const span = max - min;
  const rough = span / Math.max(1, count);
  const mag = 10 ** Math.floor(Math.log10(rough));
  const norm = rough / mag;
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return ticks;
}

/** Latest value of a series at or before t. */
export function valueAt(series: Point[], t: number): number | null {
  let v: number | null = null;
  for (const p of series) {
    if (p.t <= t) v = p.v;
    else break;
  }
  return v;
}
