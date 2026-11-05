import { beforeEach, describe, expect, it } from "vitest";
import { peeksLeft, remainingMs, useGame } from "@/lib/game/store";
import { describeResult, detectResult, replay } from "@/lib/game/rules";
import type { GameConfig } from "@/lib/storage/types";

const config: GameConfig = { playerColor: "w", levelId: 3, visibility: "ghost", mode: "practice", timeControl: { initial: 60, increment: 2 }, peeks: 2, moveList: "full" };

describe("game store", () => {
  beforeEach(() => useGame.getState().clear());

  it("tracks clocks with increments", () => {
    const g = useGame.getState().start(config);
    expect(g.clocks).toEqual({ w: 60_000, b: 60_000 });
    const t0 = useGame.getState().turnStartedAt!;
    expect(useGame.getState().applyMove("e2e4", t0 + 5_000)).toBe(true);
    const after = useGame.getState().game!;
    expect(after.clocks!.w).toBe(60_000 - 5_000 + 2_000);
    expect(remainingMs(after, t0 + 5_000, "b", t0 + 8_000)).toBe(57_000);
    expect(remainingMs(after, t0 + 5_000, "w", t0 + 8_000)).toBe(57_000);
  });

  it("records only legal moves from the current position", () => {
    useGame.getState().start(config);
    // Black's move on White's turn, and a move that isn't legal at all, are refused.
    expect(useGame.getState().applyMove("e7e5")).toBe(false);
    expect(useGame.getState().applyMove("e2e5")).toBe(false);
    expect(useGame.getState().applyMove("g1f3")).toBe(true);
    // A stale choice from the previous position (White again) is refused too.
    expect(useGame.getState().applyMove("b1c3")).toBe(false);
    const g = useGame.getState().game!;
    expect(g.moves).toEqual(["g1f3"]);
    expect(g.sans).toEqual(["Nf3"]);
  });

  it("banks the time spent before a reload instead of refunding it", () => {
    useGame.getState().start(config);
    const t0 = useGame.getState().turnStartedAt!;
    // Think for 50 s, leave the page, come back two minutes later, then move 4 s after that.
    useGame.getState().pauseClock(t0 + 50_000);
    expect(useGame.getState().turnStartedAt).toBeNull();
    expect(useGame.getState().game!.clocks!.w).toBe(10_000);
    expect(remainingMs(useGame.getState().game!, null, "w", t0 + 170_000)).toBe(10_000);
    useGame.getState().resumeClock(t0 + 170_000);
    expect(remainingMs(useGame.getState().game!, t0 + 170_000, "w", t0 + 174_000)).toBe(6_000);
    useGame.getState().applyMove("e2e4", t0 + 174_000);
    const g = useGame.getState().game!;
    expect(g.clocks!.w).toBe(6_000 + 2_000);
    expect(g.moveTimes).toEqual([54_000]);
    expect(useGame.getState().turnBanked).toBe(0);
  });

  it("limits peeks and counts illegal attempts", () => {
    useGame.getState().start(config);
    expect(useGame.getState().usePeek()).toBe(true);
    expect(useGame.getState().usePeek()).toBe(true);
    expect(useGame.getState().usePeek()).toBe(false);
    expect(peeksLeft(useGame.getState().game!)).toBe(0);
    useGame.getState().illegal();
    expect(useGame.getState().game!.illegalAttempts).toBe(1);
  });

  it("takes moves back and ends games once", () => {
    useGame.getState().start(config);
    useGame.getState().applyMove("e2e4");
    useGame.getState().applyMove("e7e5");
    useGame.getState().takeback(2);
    expect(useGame.getState().game!.moves).toEqual([]);
    expect(useGame.getState().game!.takebacks).toBe(1);
    useGame.getState().end({ winner: "b", reason: "resign" });
    useGame.getState().end({ winner: "w", reason: "checkmate" });
    expect(useGame.getState().game!.result).toEqual({ winner: "b", reason: "resign" });
  });
});

describe("rules", () => {
  it("detects checkmate, stalemate and insufficient material", () => {
    expect(detectResult(replay(["f2f3", "e7e5", "g2g4", "d8h4"]).chess)).toEqual({ winner: "b", reason: "checkmate" });
    const { chess } = replay([], "7k/5Q2/6K1/8/8/8/8/8 b - - 0 1");
    expect(detectResult(chess)).toEqual({ winner: null, reason: "stalemate" });
    expect(detectResult(replay([], "8/8/4k3/8/8/3K4/8/8 w - - 0 1").chess)!.reason).toBe("insufficient");
  });
  it("describes results from the player's side", () => {
    expect(describeResult({ winner: "w", reason: "checkmate" }, "w").outcome).toBe("win");
    expect(describeResult({ winner: "w", reason: "timeout" }, "b").title).toBe("You lost.");
    expect(describeResult({ winner: null, reason: "threefold" }, "w").detail).toMatch(/threefold/);
  });
  it("stops replaying at a corrupt move", () => {
    expect(replay(["e2e4", "zzzz", "e7e5"]).history).toHaveLength(1);
  });
});
