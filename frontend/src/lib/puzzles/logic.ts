/** Puzzle solving rules — pure and unit-tested. */
import { Chess, type Move } from "chess.js";
import { uciToMove } from "@/lib/game/rules";
import type { Puzzle, PuzzleFilters } from "./types";

export type PuzzleStart = { chess: Chess; setup: Move; solver: "w" | "b"; solverMoves: number };

/** Applies the opponent's setup move; the solver moves next. */
export function startPuzzle(p: Puzzle): PuzzleStart {
  const chess = new Chess(p.fen);
  const setup = chess.move(uciToMove(p.moves[0]!));
  return { chess, setup, solver: chess.turn(), solverMoves: Math.ceil((p.moves.length - 1) / 2) };
}

export type StepVerdict = "correct" | "alt-mate" | "wrong";

/**
 * Checks the solver's move at `step` (0-based solver move index) in position `chess`.
 * Any checkmate on the final step is accepted, as on Lichess.
 */
export function checkStep(p: Puzzle, step: number, chess: Chess, move: Move): StepVerdict {
  const expected = p.moves[1 + step * 2];
  if (move.lan === expected) return "correct";
  const last = 1 + step * 2 >= p.moves.length - 1;
  if (last) {
    const probe = new Chess(chess.fen());
    probe.move(uciToMove(move.lan));
    if (probe.isCheckmate()) return "alt-mate";
  }
  return "wrong";
}

/** The opponent's reply after solver move `step`, if the puzzle continues. */
export function replyAfter(p: Puzzle, step: number): string | null {
  return p.moves[2 + step * 2] ?? null;
}

export function matchesFilters(p: Puzzle, f: PuzzleFilters): boolean {
  return (f.goal === "any" || p.goal === f.goal) && p.rating >= f.minRating && p.rating <= f.maxRating && p.pieces <= f.maxPieces;
}

/** Picks a puzzle near the filters, avoiding recently seen ids; relaxes filters if needed. */
export function choosePuzzle(all: Puzzle[], f: PuzzleFilters, exclude: Set<string>, rand: () => number = Math.random): Puzzle | null {
  const tiers = [
    (p: Puzzle) => matchesFilters(p, f) && !exclude.has(p.id),
    (p: Puzzle) => matchesFilters(p, f),
    (p: Puzzle) => (f.goal === "any" || p.goal === f.goal) && !exclude.has(p.id),
    () => true,
  ];
  for (const t of tiers) {
    const pool = all.filter(t);
    if (pool.length) return pool[Math.floor(rand() * pool.length)]!;
  }
  return null;
}

export function goalText(p: Puzzle, solver: "w" | "b"): string {
  const side = solver === "w" ? "White" : "Black";
  switch (p.goal) {
    case "mate1":
      return `${side} to move and mate in 1.`;
    case "mate2":
      return `${side} to move and mate in 2.`;
    case "mate3":
      return `${side} to move and mate in 3.`;
    default:
      return `${side} to move and win.`;
  }
}
