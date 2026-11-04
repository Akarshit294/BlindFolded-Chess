import { describe, expect, it } from "vitest";
import {
  ALL_SQUARES,
  countShortestKnightPaths,
  diagonalsThrough,
  gridToSquare,
  isValidKnightPath,
  knightDistance,
  knightMoves,
  sameDiagonal,
  sameLine,
  shortestKnightPath,
  squareShade,
  squareToGrid,
  squaresBetween,
} from "@/lib/chess/squares";

describe("square colours", () => {
  it("knows the classic squares", () => {
    expect(squareShade("a1")).toBe("dark");
    expect(squareShade("h1")).toBe("light");
    expect(squareShade("d1")).toBe("light"); // queen on her colour
    expect(squareShade("e1")).toBe("dark");
    expect(squareShade("g5")).toBe("dark");
    expect(squareShade("h8")).toBe("dark");
  });
  it("has 32 of each", () => {
    expect(ALL_SQUARES.filter((s) => squareShade(s) === "light")).toHaveLength(32);
  });
});

describe("orientation grid", () => {
  it("round-trips for both orientations", () => {
    for (const sq of ALL_SQUARES) {
      for (const o of ["white", "black"] as const) {
        const { col, row } = squareToGrid(sq, o);
        expect(gridToSquare(col, row, o)).toBe(sq);
      }
    }
    expect(squareToGrid("a8", "white")).toEqual({ col: 0, row: 0 });
    expect(squareToGrid("a8", "black")).toEqual({ col: 7, row: 7 });
  });
});

describe("knight geometry", () => {
  it("lists knight moves from corners and centre", () => {
    expect(knightMoves("a1").sort()).toEqual(["b3", "c2"]);
    expect(knightMoves("e4")).toHaveLength(8);
  });
  it("computes distances", () => {
    expect(knightDistance("a1", "a1")).toBe(0);
    expect(knightDistance("b1", "c3")).toBe(1);
    expect(knightDistance("a1", "h8")).toBe(6);
    expect(knightDistance("a1", "b2")).toBe(4);
  });
  it("finds a valid shortest path", () => {
    const path = shortestKnightPath("b1", "f7")!;
    expect(path[0]).toBe("b1");
    expect(path.at(-1)).toBe("f7");
    expect(path).toHaveLength(knightDistance("b1", "f7") + 1);
    expect(isValidKnightPath(path, "b1", "f7")).toBe(true);
  });
  it("respects blocked squares", () => {
    const blocked = new Set(["c3", "d2", "a3"] as const);
    expect(knightDistance("b1", "c3", blocked)).toBe(Infinity);
  });
  it("counts shortest paths", () => {
    expect(countShortestKnightPaths("b1", "c3")).toBe(1);
    expect(countShortestKnightPaths("e4", "e6")).toBe(2);
  });
  it("rejects broken paths", () => {
    expect(isValidKnightPath(["b1", "c3", "d4"], "b1", "d4")).toBe(false);
    expect(isValidKnightPath(["b1", "d2"], "b1", "c3")).toBe(false);
  });
});

describe("lines", () => {
  it("detects diagonals and lines", () => {
    expect(sameDiagonal("a1", "h8")).toBe(true);
    expect(sameDiagonal("c1", "h6")).toBe(true);
    expect(sameDiagonal("c1", "h7")).toBe(false);
    expect(sameLine("a1", "a8")).toBe(true);
    expect(sameLine("b1", "c3")).toBe(false);
  });
  it("lists squares between", () => {
    expect(squaresBetween("a1", "d4")).toEqual(["b2", "c3"]);
    expect(squaresBetween("h1", "h4")).toEqual(["h2", "h3"]);
    expect(squaresBetween("a1", "b3")).toEqual([]);
  });
  it("lists both diagonals through a square", () => {
    const [d1, d2] = diagonalsThrough("c1");
    expect(d1).toEqual(["c1", "d2", "e3", "f4", "g5", "h6"]);
    expect(d2).toEqual(["c1", "b2", "a3"]);
  });
});
