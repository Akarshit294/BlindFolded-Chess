/**
 * Gives every piece a stable identity across positions so React keeps the same element
 * and Motion can animate it from its old square to its new one (instead of teleporting).
 */
import type { Color, PieceSymbol, Square } from "chess.js";
import { fileIndex, rankIndex } from "@/lib/chess/squares";

export type Placement = { square: Square; type: PieceSymbol; color: Color };
export type TrackedPiece = Placement & { id: string };
export type MoveHint = { from: Square; to: Square; promotion?: PieceSymbol };

function dist(a: Square, b: Square): number {
  const df = fileIndex(a) - fileIndex(b);
  const dr = rankIndex(a) - rankIndex(b);
  return Math.sqrt(df * df + dr * dr);
}

let counter = 0;
export function newPieceId(): string {
  counter += 1;
  return `p${counter}`;
}

export function trackPieces(
  prev: TrackedPiece[],
  next: Placement[],
  hint: MoveHint | null = null,
  makeId: () => string = newPieceId,
): { pieces: TrackedPiece[]; removed: TrackedPiece[] } {
  const prevBySquare = new Map(prev.map((p) => [p.square, p]));
  const used = new Set<string>();
  const result: Array<TrackedPiece | null> = next.map(() => null);

  // 1. Pieces that did not move keep their id.
  next.forEach((n, i) => {
    const p = prevBySquare.get(n.square);
    if (p && p.type === n.type && p.color === n.color && !(hint && hint.from === n.square)) {
      result[i] = { ...n, id: p.id };
      used.add(p.id);
    }
  });

  // 2. The hinted move (incl. promotion, where the type changes).
  if (hint) {
    const mover = prevBySquare.get(hint.from);
    const idx = next.findIndex((n) => n.square === hint.to);
    if (mover && idx >= 0 && result[idx] === null && !used.has(mover.id)) {
      const target = next[idx]!;
      const promoted = hint.promotion && mover.type === "p" && target.type === hint.promotion;
      if (target.color === mover.color && (target.type === mover.type || promoted)) {
        result[idx] = { ...target, id: mover.id };
        used.add(mover.id);
      }
    }
  }

  // 3. Greedy nearest match for the rest (castling rooks, multi-move jumps).
  const pairs: Array<{ i: number; p: TrackedPiece; d: number }> = [];
  next.forEach((n, i) => {
    if (result[i]) return;
    for (const p of prev) {
      if (used.has(p.id) || p.type !== n.type || p.color !== n.color) continue;
      pairs.push({ i, p, d: dist(p.square, n.square) });
    }
  });
  pairs.sort((a, b) => a.d - b.d);
  for (const { i, p } of pairs) {
    if (result[i] || used.has(p.id)) continue;
    result[i] = { ...next[i]!, id: p.id };
    used.add(p.id);
  }

  // 4. Anything left is new.
  const pieces = result.map((r, i) => r ?? { ...next[i]!, id: makeId() });
  const removed = prev.filter((p) => !used.has(p.id));
  return { pieces, removed };
}
