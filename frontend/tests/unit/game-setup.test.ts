import { describe, expect, it } from "vitest";
import { configFromSetup, DEFAULT_CONFIG, isResumable, type Setup } from "@/lib/game/store";
import type { GameRecord } from "@/lib/storage/types";

const setup = (patch: Partial<Setup> = {}): Setup => ({ ...DEFAULT_CONFIG, colorChoice: "w", ...patch });

describe("first-visit defaults", () => {
  it("play White against a friendly level in Ghost mode", () => {
    expect(DEFAULT_CONFIG).toMatchObject({ playerColor: "w", levelId: 2, visibility: "ghost", mode: "practice", timeControl: null });
  });
});

describe("configFromSetup", () => {
  it("resolves a random colour", () => {
    expect(configFromSetup(setup({ colorChoice: "random" }), () => 0.1).playerColor).toBe("w");
    expect(configFromSetup(setup({ colorChoice: "random" }), () => 0.9).playerColor).toBe("b");
    expect(configFromSetup(setup({ colorChoice: "b" })).playerColor).toBe("b");
  });

  it("keeps full-board games as practice", () => {
    expect(configFromSetup(setup({ visibility: "full", mode: "rated" })).mode).toBe("practice");
    expect(configFromSetup(setup({ visibility: "empty", mode: "rated" })).mode).toBe("rated");
  });

  it("caps peeks at three in rated games", () => {
    expect(configFromSetup(setup({ visibility: "blind", mode: "rated", peeks: -1 })).peeks).toBe(3);
    expect(configFromSetup(setup({ visibility: "blind", mode: "rated", peeks: 1 })).peeks).toBe(1);
    expect(configFromSetup(setup({ visibility: "blind", mode: "practice", peeks: -1 })).peeks).toBe(-1);
  });
});

describe("isResumable", () => {
  const game = (patch: Partial<GameRecord>): GameRecord =>
    ({ id: "g", config: DEFAULT_CONFIG, startedAt: 0, updatedAt: 0, moves: [], sans: [], moveTimes: [], clocks: null, peeksUsed: 0, illegalAttempts: 0, takebacks: 0, result: null, endedAt: null, ...patch }) as GameRecord;

  it("is true only for a started, unfinished game", () => {
    expect(isResumable(null)).toBe(false);
    expect(isResumable(game({}))).toBe(false);
    expect(isResumable(game({ moves: ["e2e4"] }))).toBe(true);
    expect(isResumable(game({ moves: ["e2e4"], result: { winner: "b", reason: "resign" } }))).toBe(false);
  });
});
