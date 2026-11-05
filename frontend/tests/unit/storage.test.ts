import { beforeEach, describe, expect, it } from "vitest";
import {
  __setStoreForTests,
  clearProgress,
  exportProgress,
  getRatings,
  importProgress,
  listGames,
  listPuzzleAttempts,
  listSessions,
  saveGame,
  savePuzzleAttempt,
  saveSession,
  setRatings,
  validateExport,
} from "@/lib/storage/db";
import type { DrillSession, GameRecord, PuzzleAttempt } from "@/lib/storage/types";

const game = {
  id: "g1",
  config: { playerColor: "w", levelId: 3, visibility: "ghost", mode: "rated", timeControl: null, peeks: 3, moveList: "full" },
  startedAt: 1,
  updatedAt: 2,
  moves: ["e2e4"],
  sans: ["e4"],
  moveTimes: [100],
  clocks: null,
  peeksUsed: 1,
  illegalAttempts: 0,
  takebacks: 0,
  result: { winner: "w", reason: "resign" },
  endedAt: 3,
} as GameRecord;
const session: DrillSession = { id: "s1", drill: "memory", level: 2, timed: false, startedAt: 5, durationMs: 1000, correct: 3, total: 4, accuracy: 0.75, bestStreak: 2 };
const attempt: PuzzleAttempt = { id: "p1", puzzleId: "abc", puzzleRating: 1500, goal: "mate2", solved: true, firstTry: true, mistakes: 0, peeks: 0, timeMs: 9000, ts: 7 };

for (const kind of ["idb", "ls"] as const) {
  describe(`progress storage (${kind})`, () => {
    beforeEach(async () => {
      if (kind === "ls") {
        const mem = new Map<string, string>();
        (globalThis as unknown as { localStorage: Storage }).localStorage = {
          getItem: (k: string) => mem.get(k) ?? null,
          setItem: (k: string, v: string) => void mem.set(k, v),
          removeItem: (k: string) => void mem.delete(k),
          clear: () => mem.clear(),
          key: () => null,
          length: 0,
        } as Storage;
      }
      __setStoreForTests(kind);
      await clearProgress();
    });

    it("saves and lists records", async () => {
      await saveGame(game);
      await saveSession(session);
      await savePuzzleAttempt(attempt);
      expect((await listGames()).map((g) => g.id)).toEqual(["g1"]);
      expect((await listSessions())[0]!.accuracy).toBe(0.75);
      expect((await listPuzzleAttempts())[0]!.goal).toBe("mate2");
    });

    it("round-trips an export through import (merge and replace)", async () => {
      await saveGame(game);
      await setRatings({ ...(await getRatings()), puzzles: { rating: 1333, played: 5, peak: 1400 } });
      const blob = await exportProgress();
      expect(validateExport(blob)).toBe(true);
      await clearProgress();
      expect(await listGames()).toEqual([]);
      const r = await importProgress(JSON.parse(JSON.stringify(blob)), "merge");
      expect(r.games).toBe(1);
      expect((await getRatings()).puzzles.rating).toBe(1333);
      await saveSession(session);
      await importProgress(blob, "replace");
      expect(await listSessions()).toEqual([]);
    });

    it("rejects files that are not exports", async () => {
      await expect(importProgress({ hello: "world" })).rejects.toThrow(/not a Blindfold/);
    });
  });
}
