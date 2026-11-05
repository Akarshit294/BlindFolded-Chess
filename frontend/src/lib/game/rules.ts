/** Game helpers on top of chess.js: replay, result detection, result copy. */
import { Chess, type Move, type Square } from "chess.js";
import type { GameResult } from "@/lib/storage/types";

export function uciToMove(uci: string): { from: Square; to: Square; promotion?: string } {
  return { from: uci.slice(0, 2) as Square, to: uci.slice(2, 4) as Square, promotion: uci.length > 4 ? uci[4] : undefined };
}

export function replay(moves: string[], startFen?: string): { chess: Chess; history: Move[] } {
  const chess = new Chess(startFen);
  const history: Move[] = [];
  for (const m of moves) {
    try {
      history.push(chess.move(uciToMove(m)));
    } catch {
      break; // Corrupt saved game: stop at the last legal move.
    }
  }
  return { chess, history };
}

export function detectResult(chess: Chess): GameResult | null {
  if (chess.isCheckmate()) return { winner: chess.turn() === "w" ? "b" : "w", reason: "checkmate" };
  if (chess.isStalemate()) return { winner: null, reason: "stalemate" };
  if (chess.isInsufficientMaterial()) return { winner: null, reason: "insufficient" };
  if (chess.isThreefoldRepetition()) return { winner: null, reason: "threefold" };
  if (chess.isDrawByFiftyMoves()) return { winner: null, reason: "fifty-move" };
  return null;
}

/** Side with only a king (or nothing that can mate) cannot win on time. */
export function canWinOnTime(chess: Chess, color: "w" | "b"): boolean {
  const pieces = chess
    .board()
    .flat()
    .filter((p): p is NonNullable<typeof p> => !!p && p.color === color);
  const types = pieces.map((p) => p.type).filter((t) => t !== "k");
  if (types.length === 0) return false;
  if (types.length === 1 && (types[0] === "n" || types[0] === "b")) return false;
  return true;
}

export { describeResult, scoreFor, type Outcome } from "./result";

export function kingSquare(chess: Chess, color: "w" | "b"): Square | null {
  return (chess.findPiece({ type: "k", color })[0] as Square | undefined) ?? null;
}
