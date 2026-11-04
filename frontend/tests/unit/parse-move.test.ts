import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import { autocompleteMoves, interpretMoveText, looksLikeMove, parseNotation, resolveMoveText } from "@/lib/chess/parse-move";

function sanOf(input: string, fen?: string): string | null {
  const chess = new Chess(fen);
  const r = resolveMoveText(input, chess);
  return r.status === "legal" ? r.move.san : null;
}

describe("SAN parsing", () => {
  it("parses pawn and piece moves from the start", () => {
    expect(sanOf("e4")).toBe("e4");
    expect(sanOf("Nf3")).toBe("Nf3");
    expect(sanOf("nf3")).toBe("Nf3");
    expect(sanOf("♘f3")).toBe("Nf3");
    expect(sanOf("Nc3+")).toBe("Nc3");
    expect(sanOf("  d4!? ")).toBe("d4");
  });
  it("parses captures and lower-case b ambiguity", () => {
    const fen = "rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2";
    expect(sanOf("exd5", fen)).toBe("exd5");
    expect(sanOf("ed5", fen)).toBe("exd5");
    expect(sanOf("e×d5", fen)).toBe("exd5");
    expect(sanOf("Bb5", fen)).toBe("Bb5+");
    expect(sanOf("bb5", fen)).toBe("Bb5+");
    // b-pawn capture written in lower case
    const fen2 = "rnbqkbnr/pp1ppppp/8/8/2p5/1P6/P1PPPPPP/RNBQKBNR w KQkq - 0 3";
    expect(sanOf("bxc4", fen2)).toBe("bxc4");
  });
  it("never silently picks the bishop for bxc4 when the b-pawn can capture too", () => {
    // 1.d4 d5 2.c4 dxc4 3.e3 Nf6 4.b3 e6: both Bf1xc4 and b3xc4 are legal.
    const chess = new Chess();
    for (const m of ["d4", "d5", "c4", "dxc4", "e3", "Nf6", "b3", "e6"]) chess.move(m);
    const r = resolveMoveText("bxc4", chess);
    expect(r.status).toBe("ambiguous");
    expect(r.status === "ambiguous" && r.candidates.map((m) => m.san).sort()).toEqual(["Bxc4", "bxc4"]);
    expect(sanOf("Bxc4", chess.fen())).toBe("Bxc4");
  });
  it("understands a spoken origin file before 'to'", () => {
    // "rook a to d1": a rook from the a-file, not from a2 ("a two").
    expect(sanOf("rook a to d1", "4k3/8/8/8/8/8/8/R3K3 w - - 0 1")).toBe("Rd1");
    const chess = new Chess();
    chess.move("d4");
    chess.move("d5");
    expect(sanOf("knight b to d2", chess.fen())).toBe("Nd2");
    // ...while "e to e4" still means e2-e4.
    expect(sanOf("e to e4")).toBe("e4");
  });
  it("parses UCI and long algebraic", () => {
    expect(sanOf("e2e4")).toBe("e4");
    expect(sanOf("g1-f3")).toBe("Nf3");
    expect(sanOf("Ng1f3")).toBe("Nf3");
  });
  it("handles castling in every spelling", () => {
    const fen = "r3k2r/pppqbppp/2np1n2/4p3/4P3/2NP1N2/PPPQBPPP/R3K2R w KQkq - 0 1";
    for (const s of ["O-O", "0-0", "o-o", "OO", "castle kingside", "castles short"]) expect(sanOf(s, fen)).toBe("O-O");
    for (const s of ["O-O-O", "0-0-0", "ooo", "castle long", "castle queenside", "queen side castle"]) expect(sanOf(s, fen)).toBe("O-O-O");
  });
  it("resolves promotions", () => {
    const fen = "8/4P1k1/8/8/8/8/6K1/8 w - - 0 1";
    expect(sanOf("e8=Q", fen)).toBe("e8=Q");
    expect(sanOf("e8q", fen)).toBe("e8=Q");
    expect(sanOf("e7e8n", fen)).toBe("e8=N+");
    const r = resolveMoveText("e8", new Chess(fen));
    expect(r.status).toBe("promotion");
  });
  it("handles en passant", () => {
    const fen = "rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3";
    expect(sanOf("exf6", fen)).toBe("exf6");
    expect(sanOf("exf6 e.p.", fen)).toBe("exf6");
  });
  it("reports ambiguity", () => {
    const fen = "4k3/8/8/8/8/8/6K1/R6R w - - 0 1";
    const r = resolveMoveText("Rd1", new Chess(fen));
    expect(r.status).toBe("ambiguous");
    expect(sanOf("Rad1", fen)).toBe("Rad1");
    expect(sanOf("Rhd1", fen)).toBe("Rhd1");
  });
  it("reports illegal and invalid input", () => {
    expect(resolveMoveText("e5", new Chess()).status).toBe("illegal");
    expect(resolveMoveText("Qh5", new Chess()).status).toBe("illegal");
    expect(resolveMoveText("hello there", new Chess()).status).toBe("invalid");
    expect(resolveMoveText("", new Chess()).status).toBe("empty");
  });
  it("syntax check does not need a position", () => {
    expect(looksLikeMove("Nf3")).toBe(true);
    expect(looksLikeMove("castle long")).toBe(true);
    expect(looksLikeMove("banana")).toBe(false);
    expect(parseNotation("zz")).toEqual([]);
  });
  it("accepts natural language typed in", () => {
    expect(sanOf("knight to f3")).toBe("Nf3");
    expect(sanOf("pawn to e4")).toBe("e4");
    expect(sanOf("e two e four")).toBe("e4");
    expect(interpretMoveText("bishop takes c6")[0]).toMatchObject({ piece: "b", capture: true, to: "c6" });
  });
});

describe("autocomplete", () => {
  it("suggests legal continuations of a prefix", () => {
    const legal = new Chess().moves({ verbose: true });
    const sans = autocompleteMoves("N", legal).map((m) => m.san);
    expect(sans.sort()).toEqual(["Na3", "Nc3", "Nf3", "Nh3"]);
    expect(autocompleteMoves("e", legal).map((m) => m.san)).toEqual(["e3", "e4"]);
    expect(autocompleteMoves("g1", legal).map((m) => m.san).sort()).toEqual(["Nf3", "Nh3"]);
    expect(autocompleteMoves("", legal)).toEqual([]);
  });
});
