import { describe, expect, it } from "vitest";
import { activityGrid, gameTotals, niceTicks, puzzleTotals, ratingSeries, valueAt } from "@/lib/stats/aggregate";
import { computeStreak, expectedScore, updateDrillRating, updateRating } from "@/lib/stats/rating";
import type { GameRecord, PuzzleAttempt } from "@/lib/storage/types";

const DAY = 86_400_000;

describe("rating maths", () => {
  it("expected score is symmetric", () => {
    expect(expectedScore(1500, 1500)).toBeCloseTo(0.5);
    expect(expectedScore(1600, 1400) + expectedScore(1400, 1600)).toBeCloseTo(1);
  });
  it("updates ratings sensibly", () => {
    expect(updateRating(1200, 1200, 1, 0)).toBe(1220);
    expect(updateRating(1200, 1200, 0, 0)).toBe(1180);
    expect(updateRating(1200, 1200, 0.5, 0)).toBe(1200);
    expect(updateRating(1200, 2000, 1, 50)).toBeGreaterThan(1220);
    expect(updateDrillRating(1200, 1, 1, 0)).toBeGreaterThan(1200);
  });
});

describe("streaks", () => {
  const now = new Date(2026, 10, 4, 12).getTime();
  it("counts consecutive days ending today or yesterday", () => {
    expect(computeStreak([], now)).toEqual({ current: 0, best: 0 });
    expect(computeStreak([now, now - DAY, now - 2 * DAY], now).current).toBe(3);
    expect(computeStreak([now - DAY, now - 2 * DAY], now).current).toBe(2);
    expect(computeStreak([now - 3 * DAY], now).current).toBe(0);
    expect(computeStreak([now - 10 * DAY, now - 9 * DAY, now - 8 * DAY, now], now)).toEqual({ current: 1, best: 3 });
  });
});

describe("aggregates", () => {
  it("builds rating series from the default rating", () => {
    expect(ratingSeries([{ t: 10, rating: 1220 }, { t: 5, rating: 1210 }])).toEqual([
      { t: 4, v: 1200 },
      { t: 5, v: 1210 },
      { t: 10, v: 1220 },
    ]);
    expect(valueAt([{ t: 1, v: 5 }, { t: 3, v: 7 }], 2)).toBe(5);
    expect(valueAt([{ t: 1, v: 5 }], 0)).toBeNull();
  });
  it("totals games and puzzles", () => {
    const base = { config: { playerColor: "w", mode: "rated" } } as unknown as GameRecord;
    const games = [
      { ...base, result: { winner: "w", reason: "checkmate" } },
      { ...base, result: { winner: "b", reason: "resign" } },
      { ...base, result: { winner: null, reason: "stalemate" } },
      { ...base, result: null },
    ] as GameRecord[];
    expect(gameTotals(games)).toEqual({ played: 3, wins: 1, draws: 1, losses: 1, rated: 3 });
    const attempts = [
      { goal: "mate1", solved: true, firstTry: true },
      { goal: "mate1", solved: false, firstTry: false },
      { goal: "win", solved: true, firstTry: false },
    ] as PuzzleAttempt[];
    const t = puzzleTotals(attempts);
    expect(t.solved).toBe(2);
    expect(t.byGoal.find((g) => g.goal === "mate1")).toEqual({ goal: "mate1", attempts: 2, solved: 1 });
  });
  it("lays out an activity grid ending today", () => {
    const now = new Date(2026, 10, 4, 12).getTime();
    const grid = activityGrid([now, now, now - DAY], 4, now);
    expect(grid.at(-1)!.count).toBe(2);
    expect(grid.at(-2)!.count).toBe(1);
    expect(grid.length).toBeLessThanOrEqual(28);
    expect(new Date(grid[0]!.day).getDay()).toBe(1); // Monday
  });
  it("makes nice ticks", () => {
    expect(niceTicks(1180, 1260, 4)).toEqual([1180, 1200, 1220, 1240, 1260]);
    expect(niceTicks(0, 100, 4)).toEqual([0, 20, 40, 60, 80, 100]);
  });
});
