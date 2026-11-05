import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import { checkStep, choosePuzzle, replyAfter, startPuzzle } from "@/lib/puzzles/logic";
import type { Puzzle } from "@/lib/puzzles/types";

// Lichess puzzle 0000H (CC0): after Black's ...Nxe3?? White mates with Qh5... the DB line is d1h5 d5g2.
const MATE1: Puzzle = {
  id: "0000H",
  fen: "r4rk1/pp3ppp/8/2bqp2b/3N4/P2Bn2P/1PPN1P2/R1BQ1RK1 w - - 1 15",
  moves: ["d1h5", "d5g2"],
  rating: 1032,
  themes: ["mate", "mateIn1"],
  pieces: 24,
  goal: "mate1",
};

describe("puzzle logic", () => {
  it("applies the setup move and finds the solver", () => {
    const s = startPuzzle(MATE1);
    expect(s.setup.san).toBe("Qxh5");
    expect(s.solver).toBe("b");
    expect(s.solverMoves).toBe(1);
  });
  it("accepts the solution and alternative mates on the last move", () => {
    const s = startPuzzle(MATE1);
    const right = s.chess.moves({ verbose: true }).find((m) => m.lan === "d5g2")!;
    expect(checkStep(MATE1, 0, s.chess, right)).toBe("correct");
    const wrong = s.chess.moves({ verbose: true }).find((m) => m.lan !== "d5g2" && !new Chess(m.after).isCheckmate())!;
    expect(checkStep(MATE1, 0, s.chess, wrong)).toBe("wrong");
    expect(replyAfter(MATE1, 0)).toBeNull();
  });
  it("chooses puzzles with relaxing filters", () => {
    const pool = [MATE1, { ...MATE1, id: "x", rating: 2400, goal: "win" as const }];
    const f = { goal: "mate1" as const, minRating: 900, maxRating: 1200, maxPieces: 32 };
    expect(choosePuzzle(pool, f, new Set())?.id).toBe("0000H");
    expect(choosePuzzle(pool, f, new Set(["0000H"]))?.id).toBe("0000H");
    expect(choosePuzzle([], f, new Set())).toBeNull();
  });
});
