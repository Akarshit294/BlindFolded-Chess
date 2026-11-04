import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import { trackPieces, type Placement, type TrackedPiece } from "@/components/board/tracking";

function placements(fen: string): Placement[] {
  const out: Placement[] = [];
  for (const row of new Chess(fen).board()) for (const c of row) if (c) out.push({ square: c.square, type: c.type, color: c.color });
  return out;
}

function ids() {
  let n = 0;
  return () => `id${++n}`;
}

describe("piece tracking", () => {
  it("keeps ids for a simple move and moves the right piece", () => {
    const make = ids();
    const start = trackPieces([], placements(new Chess().fen()), null, make).pieces;
    const chess = new Chess();
    chess.move("e4");
    const { pieces, removed } = trackPieces(start, placements(chess.fen()), { from: "e2", to: "e4" }, make);
    expect(removed).toHaveLength(0);
    const e2 = start.find((p) => p.square === "e2")!;
    expect(pieces.find((p) => p.square === "e4")!.id).toBe(e2.id);
    expect(pieces).toHaveLength(32);
  });

  it("reports captured pieces as removed", () => {
    const make = ids();
    const chess = new Chess("rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2");
    const before = trackPieces([], placements(chess.fen()), null, make).pieces;
    const d5 = before.find((p) => p.square === "d5")!;
    chess.move("exd5");
    const { removed } = trackPieces(before, placements(chess.fen()), { from: "e4", to: "d5" }, make);
    expect(removed.map((r) => r.id)).toEqual([d5.id]);
  });

  it("moves both king and rook when castling", () => {
    const make = ids();
    const chess = new Chess("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
    const before = trackPieces([], placements(chess.fen()), null, make).pieces;
    const rook = before.find((p) => p.square === "h1")!;
    chess.move("O-O");
    const { pieces, removed } = trackPieces(before, placements(chess.fen()), { from: "e1", to: "g1" }, make);
    expect(removed).toHaveLength(0);
    expect(pieces.find((p) => p.square === "f1")!.id).toBe(rook.id);
  });

  it("removes the en-passant victim", () => {
    const make = ids();
    const chess = new Chess("rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3");
    const before = trackPieces([], placements(chess.fen()), null, make).pieces;
    const victim = before.find((p) => p.square === "f5")!;
    chess.move("exf6");
    const { removed } = trackPieces(before, placements(chess.fen()), { from: "e5", to: "f6" }, make);
    expect(removed.map((r) => r.id)).toEqual([victim.id]);
  });

  it("keeps the pawn id through promotion", () => {
    const make = ids();
    const chess = new Chess("8/4P1k1/8/8/8/8/6K1/8 w - - 0 1");
    const before: TrackedPiece[] = trackPieces([], placements(chess.fen()), null, make).pieces;
    const pawn = before.find((p) => p.square === "e7")!;
    chess.move("e8=Q");
    const { pieces, removed } = trackPieces(before, placements(chess.fen()), { from: "e7", to: "e8", promotion: "q" }, make);
    expect(removed).toHaveLength(0);
    const q = pieces.find((p) => p.square === "e8")!;
    expect(q.id).toBe(pawn.id);
    expect(q.type).toBe("q");
  });
});
