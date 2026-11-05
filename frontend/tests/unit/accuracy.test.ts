import { describe, expect, it } from "vitest";
import { aggregateAccuracy, classify, moveAccuracy, moverDrop, winFromCp, winFromScore } from "@/lib/analysis/accuracy";
import { assembleAnalysis, formatScore } from "@/lib/analysis/analyze";

describe("win percentage", () => {
  it("is 50 at equality and symmetric", () => {
    expect(winFromCp(0)).toBeCloseTo(50);
    expect(winFromCp(300) + winFromCp(-300)).toBeCloseTo(100);
    expect(winFromCp(5000)).toBeCloseTo(winFromCp(1000)); // clamped
  });
  it("handles mate scores", () => {
    expect(winFromScore({ cp: null, mate: 3 })).toBe(100);
    expect(winFromScore({ cp: null, mate: -2 })).toBe(0);
    expect(winFromScore({ cp: 0, mate: null })).toBeCloseTo(50);
  });
});

describe("move accuracy and classes", () => {
  it("maps drops to accuracy", () => {
    expect(moveAccuracy(0)).toBeCloseTo(100, 0);
    expect(moveAccuracy(10)).toBeLessThan(70);
    expect(moveAccuracy(100)).toBe(0);
  });
  it("classifies by win% drop", () => {
    expect(classify(0, true)).toBe("best");
    expect(classify(1, false)).toBe("excellent");
    expect(classify(3, false)).toBe("good");
    expect(classify(6, true)).toBe("inaccuracy");
    expect(classify(12, false)).toBe("mistake");
    expect(classify(30, false)).toBe("blunder");
  });
  it("computes the drop from the mover's side", () => {
    expect(moverDrop(60, 40, "w")).toBe(20);
    expect(moverDrop(60, 40, "b")).toBe(0);
    expect(moverDrop(40, 60, "b")).toBe(20);
  });
  it("aggregates side accuracy", () => {
    expect(aggregateAccuracy([])).toBeNull();
    expect(aggregateAccuracy([100, 100])).toBe(100);
    const mixed = aggregateAccuracy([100, 10])!;
    expect(mixed).toBeLessThan(55); // harmonic mean pulls it down
  });
});

describe("assembleAnalysis", () => {
  it("builds per-ply results and counts", () => {
    const evals = [
      { score: { cp: 20, mate: null }, best: "e2e4", bestSan: "e4" },
      { score: { cp: 25, mate: null }, best: "e7e5", bestSan: "e5" },
      { score: { cp: 400, mate: null }, best: "g1f3", bestSan: "Nf3" },
    ];
    const a = assembleAnalysis(["e4", "f6"], ["e2e4", "f7f6"], ["w", "b"], evals, "browser");
    expect(a.plies[0]!.classification).toBe("best");
    expect(a.plies[1]!.classification).toBe("blunder");
    expect(a.counts.black.blunder).toBe(1);
    expect(a.accuracy.white).toBeGreaterThan(a.accuracy.black!);
    expect(formatScore({ cp: 400, mate: null })).toBe("+4.0");
    expect(formatScore({ cp: null, mate: -3 })).toBe("M3");
  });
});
