import { describe, expect, it } from "vitest";
import { parseInfo } from "@/lib/engine/engine";
import { ENGINE_LEVELS, getLevel, sampleMove } from "@/lib/engine/levels";

describe("UCI info parsing", () => {
  it("reads depth, multipv, score and pv", () => {
    const i = parseInfo("info depth 12 seldepth 18 multipv 2 score cp -35 nodes 1000 nps 50000 pv e7e5 g1f3 b8c6")!;
    expect(i).toMatchObject({ depth: 12, multipv: 2, score: { cp: -35, mate: null }, pv: ["e7e5", "g1f3", "b8c6"] });
  });
  it("reads mate scores and bounds", () => {
    expect(parseInfo("info depth 5 score mate -2 pv h7h8")!.score).toEqual({ cp: null, mate: -2 });
    expect(parseInfo("info depth 9 score cp 50 lowerbound pv e2e4")!.bound).toBe("lower");
    expect(parseInfo("info string NNUE evaluation")).toBeNull();
  });
});

describe("engine levels", () => {
  it("has at least eight levels with increasing strength", () => {
    expect(ENGINE_LEVELS.length).toBeGreaterThanOrEqual(8);
    for (let i = 1; i < ENGINE_LEVELS.length; i++) expect(ENGINE_LEVELS[i]!.elo).toBeGreaterThan(ENGINE_LEVELS[i - 1]!.elo);
    expect(getLevel(99).id).toBe(3);
  });
  it("samples the best move when the temperature is tiny", () => {
    const lines = [
      { move: "e2e4", cp: 50 },
      { move: "a2a3", cp: -200 },
    ];
    expect(sampleMove(lines, 1, 0, () => 0.5)).toBe("e2e4");
  });
  it("makes deliberate slips with the blunder chance", () => {
    const lines = [
      { move: "e2e4", cp: 50 },
      { move: "a2a3", cp: -200 },
      { move: "h2h4", cp: -150 },
    ];
    const seq = [0.01, 0.0];
    expect(sampleMove(lines, 100, 0.5, () => seq.shift() ?? 0)).toBe("a2a3");
    expect(sampleMove([], 100, 0)).toBeNull();
  });
});
