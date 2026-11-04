import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import {
  boardMapFromFen,
  checkKnightRoute,
  coordinateQuestion,
  generateSequence,
  knightRouteQuestion,
  lineQuestion,
  parseSquareList,
  randomPosition,
  scoreMemory,
  squareColorQuestion,
  wherePieceQuestions,
} from "@/lib/drills/generators";
import { knightDistance, sameDiagonal, squareShade, squaresBetween } from "@/lib/chess/squares";
import { mulberry32 } from "@/lib/utils/random";

describe("seeded RNG", () => {
  it("is deterministic", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});

describe("square colour drill", () => {
  it("answers match the board", () => {
    const rng = mulberry32(1);
    for (let i = 0; i < 50; i++) {
      const q = squareColorQuestion(1, rng);
      if (q.kind === "single") expect(q.answer).toBe(squareShade(q.square));
    }
    const pair = squareColorQuestion(4, mulberry32(3));
    expect(pair.kind).toBe("pair");
    if (pair.kind === "pair") expect(pair.answer).toBe(squareShade(pair.a) === squareShade(pair.b));
  });
});

describe("coordinates drill", () => {
  it("uses black orientation from level 4", () => {
    expect(coordinateQuestion(1, mulberry32(5)).showCoords).toBe(true);
    expect(coordinateQuestion(4, mulberry32(5)).orientation).toBe("black");
  });
});

describe("knight routes", () => {
  it("respects level distances", () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 30; i++) {
      const q = knightRouteQuestion(2, rng);
      expect(q.distance).toBe(3);
      expect(knightDistance(q.from, q.to)).toBe(3);
    }
  });
  it("level 4 obstacles make the route longer", () => {
    const q = knightRouteQuestion(4, mulberry32(11));
    expect(q.blocked.length).toBeGreaterThan(0);
    expect(q.distance).toBeGreaterThan(knightDistance(q.from, q.to));
  });
  it("accepts any shortest path, with or without endpoints", () => {
    const q = { from: "b1", to: "e4", distance: 2, blocked: [], example: ["b1", "d2", "e4"], paths: 2 } as Parameters<typeof checkKnightRoute>[0];
    expect(checkKnightRoute(q, parseSquareList("d2")).correct).toBe(true);
    expect(checkKnightRoute(q, parseSquareList("c3")).correct).toBe(true);
    expect(checkKnightRoute(q, parseSquareList("b1 c3 e4")).correct).toBe(true);
    expect(checkKnightRoute(q, parseSquareList("b1-c2")).correct).toBe(false);
    expect(checkKnightRoute(q, parseSquareList("a3 c4 d6 f5 d4")).correct).toBe(false);
  });
  it("parses square lists loosely", () => {
    expect(parseSquareList("Nc3, d5 - F6")).toEqual(["c3", "d5", "f6"]);
  });
});

describe("lines drill", () => {
  it("produces correct answers", () => {
    const rng = mulberry32(13);
    for (let level = 1; level <= 4; level++) {
      for (let i = 0; i < 20; i++) {
        const q = lineQuestion(level, rng);
        if (q.kind === "same-diagonal") expect(q.answer).toBe(sameDiagonal(q.a, q.b));
        if (q.kind === "between") expect(q.answer).toEqual(squaresBetween(q.a, q.b));
        if (q.kind === "reach") expect(q.answer).toBeGreaterThan(0);
      }
    }
  });
  it("knows reach counts", () => {
    const q = lineQuestion(4, mulberry32(99));
    expect(q.kind).toBe("reach");
  });
});

describe("move sequences", () => {
  it("are legal, deterministic and the requested length", () => {
    const a = generateSequence(16, mulberry32(21));
    const b = generateSequence(16, mulberry32(21));
    expect(a).toEqual(b);
    expect(a.sans).toHaveLength(16);
    const chess = new Chess();
    for (const s of a.sans) chess.move(s);
    expect(chess.fen()).toBe(a.fen);
  });
  it("produce three answerable questions", () => {
    const seq = generateSequence(10, mulberry32(4));
    const qs = wherePieceQuestions(seq, mulberry32(4));
    expect(qs.map((q) => q.kind)).toEqual(["on-square", "where-is", "legal"]);
    const chess = new Chess(seq.fen);
    const legalQ = qs[2]!;
    if (legalQ.kind === "legal") {
      const isLegal = chess.moves().some((m) => m.replace(/[+#]/g, "") === legalQ.san.replace(/[+#]/g, ""));
      expect(isLegal).toBe(legalQ.answer);
    }
  });
});

describe("memory drill", () => {
  it("builds legal positions with the requested piece count", () => {
    const rng = mulberry32(8);
    for (const n of [3, 6, 10, 16]) {
      const fen = randomPosition(n, rng);
      expect(() => new Chess(fen)).not.toThrow();
      expect(boardMapFromFen(fen).size).toBe(n);
    }
  });
  it("scores reconstructions", () => {
    const target = boardMapFromFen("4k3/8/8/8/8/8/4P3/4K3 w - - 0 1");
    const placed = new Map(target);
    placed.delete("e2");
    placed.set("d2", "wp");
    const s = scoreMemory(target, placed);
    expect(s.correct).toBe(2);
    expect(s.missing).toEqual(["e2"]);
    expect(s.extra).toEqual(["d2"]);
    expect(s.accuracy).toBeCloseTo(2 / 4);
  });
});
