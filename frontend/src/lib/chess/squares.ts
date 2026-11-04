/**
 * Square geometry helpers. Everything here is pure and framework-free so it can be unit
 * tested and reused by the board, the drills and the parsers.
 */
import type { Color, PieceSymbol, Square } from "chess.js";

export type { Color, PieceSymbol, Square };

export const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
export const RANKS = ["1", "2", "3", "4", "5", "6", "7", "8"] as const;
export type File = (typeof FILES)[number];
export type Rank = (typeof RANKS)[number];

export const ALL_SQUARES: Square[] = RANKS.flatMap((r) => FILES.map((f) => `${f}${r}` as Square));

const SQUARE_RE = /^[a-h][1-8]$/;
export function isSquare(value: string): value is Square {
  return SQUARE_RE.test(value);
}

/** 0-based file index (a = 0). */
export function fileIndex(sq: Square): number {
  return sq.charCodeAt(0) - 97;
}
/** 0-based rank index (rank 1 = 0). */
export function rankIndex(sq: Square): number {
  return sq.charCodeAt(1) - 49;
}
export function squareAt(file: number, rank: number): Square | null {
  if (file < 0 || file > 7 || rank < 0 || rank > 7) return null;
  return `${FILES[file]}${RANKS[rank]}` as Square;
}

export type SquareShade = "light" | "dark";
/** a1 is dark; colours alternate. */
export function squareShade(sq: Square): SquareShade {
  return (fileIndex(sq) + rankIndex(sq)) % 2 === 0 ? "dark" : "light";
}

export type Orientation = "white" | "black";

/** Visual column/row (0..7, top-left origin) of a square for a given orientation. */
export function squareToGrid(sq: Square, orientation: Orientation): { col: number; row: number } {
  const f = fileIndex(sq);
  const r = rankIndex(sq);
  return orientation === "white" ? { col: f, row: 7 - r } : { col: 7 - f, row: r };
}
export function gridToSquare(col: number, row: number, orientation: Orientation): Square | null {
  if (col < 0 || col > 7 || row < 0 || row > 7) return null;
  return orientation === "white" ? squareAt(col, 7 - row) : squareAt(7 - col, row);
}

const KNIGHT_DELTAS: ReadonlyArray<readonly [number, number]> = [
  [1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2],
];

export function knightMoves(sq: Square): Square[] {
  const f = fileIndex(sq);
  const r = rankIndex(sq);
  const out: Square[] = [];
  for (const [df, dr] of KNIGHT_DELTAS) {
    const s = squareAt(f + df, r + dr);
    if (s) out.push(s);
  }
  return out;
}

/** Breadth-first distances from `from` for a knight, optionally avoiding blocked squares. */
export function knightDistances(from: Square, blocked: ReadonlySet<Square> = new Set()): Map<Square, number> {
  const dist = new Map<Square, number>([[from, 0]]);
  const queue: Square[] = [from];
  for (let i = 0; i < queue.length; i++) {
    const cur = queue[i]!;
    const d = dist.get(cur)!;
    for (const next of knightMoves(cur)) {
      if (dist.has(next) || blocked.has(next)) continue;
      dist.set(next, d + 1);
      queue.push(next);
    }
  }
  return dist;
}

export function knightDistance(from: Square, to: Square, blocked?: ReadonlySet<Square>): number {
  return knightDistances(from, blocked).get(to) ?? Infinity;
}

/** One shortest knight path (inclusive of both ends), or null when unreachable. */
export function shortestKnightPath(from: Square, to: Square, blocked: ReadonlySet<Square> = new Set()): Square[] | null {
  const prev = new Map<Square, Square | null>([[from, null]]);
  const queue: Square[] = [from];
  for (let i = 0; i < queue.length; i++) {
    const cur = queue[i]!;
    if (cur === to) break;
    for (const next of knightMoves(cur)) {
      if (prev.has(next) || blocked.has(next)) continue;
      prev.set(next, cur);
      queue.push(next);
    }
  }
  if (!prev.has(to)) return null;
  const path: Square[] = [];
  let cur: Square | null = to;
  while (cur) {
    path.unshift(cur);
    cur = prev.get(cur) ?? null;
  }
  return path;
}

/** Counts all distinct shortest knight paths. */
export function countShortestKnightPaths(from: Square, to: Square, blocked: ReadonlySet<Square> = new Set()): number {
  const dist = knightDistances(from, blocked);
  const target = dist.get(to);
  if (target === undefined) return 0;
  const ways = new Map<Square, number>([[from, 1]]);
  const layers = [...dist.entries()].sort((a, b) => a[1] - b[1]);
  for (const [sq, d] of layers) {
    if (sq === from) continue;
    let total = 0;
    for (const n of knightMoves(sq)) if (dist.get(n) === d - 1) total += ways.get(n) ?? 0;
    ways.set(sq, total);
  }
  return ways.get(to) ?? 0;
}

/** Validates a typed knight route: consecutive knight hops, correct ends, no blocked squares. */
export function isValidKnightPath(path: Square[], from: Square, to: Square, blocked: ReadonlySet<Square> = new Set()): boolean {
  if (path.length < 2 || path[0] !== from || path[path.length - 1] !== to) return false;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!;
    const b = path[i]!;
    if (blocked.has(b)) return false;
    if (!knightMoves(a).includes(b)) return false;
  }
  return true;
}

export function sameDiagonal(a: Square, b: Square): boolean {
  if (a === b) return false;
  return Math.abs(fileIndex(a) - fileIndex(b)) === Math.abs(rankIndex(a) - rankIndex(b));
}
export function sameRank(a: Square, b: Square): boolean {
  return a !== b && rankIndex(a) === rankIndex(b);
}
export function sameFile(a: Square, b: Square): boolean {
  return a !== b && fileIndex(a) === fileIndex(b);
}
export function sameLine(a: Square, b: Square): boolean {
  return sameDiagonal(a, b) || sameRank(a, b) || sameFile(a, b);
}

/** Squares strictly between two squares that share a line, in order from a to b. */
export function squaresBetween(a: Square, b: Square): Square[] {
  if (!sameLine(a, b)) return [];
  const df = Math.sign(fileIndex(b) - fileIndex(a));
  const dr = Math.sign(rankIndex(b) - rankIndex(a));
  const out: Square[] = [];
  let f = fileIndex(a) + df;
  let r = rankIndex(a) + dr;
  while (f !== fileIndex(b) || r !== rankIndex(b)) {
    out.push(squareAt(f, r)!);
    f += df;
    r += dr;
  }
  return out;
}

/** All squares on the diagonals through `sq` (excluding `sq`). */
export function diagonalSquares(sq: Square): Square[] {
  return ALL_SQUARES.filter((s) => sameDiagonal(s, sq));
}

/** The two diagonals through a square, each ordered from its lower-left/lower-right end. */
export function diagonalsThrough(sq: Square): [Square[], Square[]] {
  const f = fileIndex(sq);
  const r = rankIndex(sq);
  const a1h8: Square[] = [];
  const h1a8: Square[] = [];
  for (let k = -7; k <= 7; k++) {
    const s1 = squareAt(f + k, r + k);
    if (s1) a1h8.push(s1);
    const s2 = squareAt(f - k, r + k);
    if (s2) h1a8.push(s2);
  }
  return [a1h8, h1a8];
}

/** Squares a piece of the given type could reach on an otherwise empty board. */
export function emptyBoardReach(piece: PieceSymbol, sq: Square): Square[] {
  switch (piece) {
    case "n":
      return knightMoves(sq);
    case "b":
      return diagonalSquares(sq);
    case "r":
      return ALL_SQUARES.filter((s) => sameRank(s, sq) || sameFile(s, sq));
    case "q":
      return ALL_SQUARES.filter((s) => sameLine(s, sq));
    case "k":
      return ALL_SQUARES.filter(
        (s) => s !== sq && Math.abs(fileIndex(s) - fileIndex(sq)) <= 1 && Math.abs(rankIndex(s) - rankIndex(sq)) <= 1,
      );
    case "p":
      return [];
  }
}

export function sortSquares(squares: Iterable<Square>): Square[] {
  return [...squares].sort((a, b) => fileIndex(a) - fileIndex(b) || rankIndex(a) - rankIndex(b));
}
