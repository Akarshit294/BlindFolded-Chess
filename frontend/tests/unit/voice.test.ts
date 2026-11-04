import { describe, expect, it } from "vitest";
import { normalizeSpokenMove, parseNaturalMove } from "@/lib/chess/voice";

describe("voice normalisation", () => {
  it.each([
    ["e4", "e4"],
    ["E four", "e4"],
    ["e for", "e4"],
    ["night f3", "Nf3"],
    ["knight f three", "Nf3"],
    ["Knight to F3", "Nf3"],
    ["horse to c three", "Nc3"],
    ["bee four", "b4"],
    ["bishop takes c6", "Bxc6"],
    ["bishop takes see six", "Bxc6"],
    ["bishop captures sea 6", "Bxc6"],
    ["queen to h5 check", "Qh5"],
    ["rook a1 to d1", "Ra1d1"],
    ["rock to d one", "Rd1"],
    ["knight b d2", "Nbd2"],
    ["e takes d5", "exd5"],
    ["pawn takes d5", "Pxd5"],
    ["castle kingside", "O-O"],
    ["castles king side", "O-O"],
    ["castle short", "O-O"],
    ["castle long", "O-O-O"],
    ["castle queen's side", "O-O-O"],
    ["castle", "castle"],
    ["e8 promote to queen", "e8=Q"],
    ["e8 queen", "e8=Q"],
    ["d takes e8 knight", "dxe8=N"],
    ["alpha four", "a4"],
    ["golf one foxtrot three", "g1f3"],
    ["king to e2", "Ke2"],
  ])("%s -> %s", (spoken, expected) => {
    expect(normalizeSpokenMove(spoken)).toBe(expected);
  });

  it("ignores noise and returns null for non-moves", () => {
    expect(normalizeSpokenMove("um uh")).toBeNull();
    expect(normalizeSpokenMove("hello")).toBeNull();
    expect(normalizeSpokenMove("please play knight to f3 now")).toBe("Nf3");
  });

  it("keeps 'to' as a preposition unless it follows a file", () => {
    expect(parseNaturalMove("knight to f3")).toEqual({ piece: "n", to: "f3" });
    expect(normalizeSpokenMove("e to e four")).toBe("e2e4");
  });
});
