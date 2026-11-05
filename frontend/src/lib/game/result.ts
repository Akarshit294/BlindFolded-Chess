/** Result wording and scoring. No chess.js here, so lists and stats can use it cheaply. */
import type { GameResult, ResultReason } from "@/lib/storage/types";

export type Outcome = "win" | "loss" | "draw";

const REASON_TEXT: Record<ResultReason, string> = {
  checkmate: "by checkmate",
  stalemate: "by stalemate",
  threefold: "by threefold repetition",
  "fifty-move": "by the 50-move rule",
  insufficient: "by insufficient material",
  resign: "by resignation",
  timeout: "on time",
  agreement: "by agreement",
};

export function describeResult(result: GameResult, player: "w" | "b"): { outcome: Outcome; title: string; detail: string } {
  if (result.winner === null) return { outcome: "draw", title: "Draw", detail: `Drawn ${REASON_TEXT[result.reason]}.` };
  const won = result.winner === player;
  const winnerName = result.winner === "w" ? "White" : "Black";
  if (result.reason === "checkmate") return { outcome: won ? "win" : "loss", title: won ? "Checkmate. You win." : "Checkmated.", detail: `${winnerName} wins ${REASON_TEXT.checkmate}.` };
  return { outcome: won ? "win" : "loss", title: won ? "You win." : "You lost.", detail: `${winnerName} wins ${REASON_TEXT[result.reason]}.` };
}

export function scoreFor(result: GameResult, player: "w" | "b"): number {
  if (result.winner === null) return 0.5;
  return result.winner === player ? 1 : 0;
}
