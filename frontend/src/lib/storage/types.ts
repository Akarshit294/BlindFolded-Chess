import type { Classification } from "@/lib/analysis/accuracy";

export type DrillId = "square-color" | "coordinates" | "knight-routes" | "lines" | "where-piece" | "memory" | "puzzles";

export type Visibility = "full" | "ghost" | "silhouette" | "empty" | "blind";
export type GameMode = "practice" | "rated";
export type MoveListMode = "full" | "last" | "hidden";
export type ResultReason = "checkmate" | "stalemate" | "threefold" | "fifty-move" | "insufficient" | "resign" | "timeout" | "agreement";

export type GameConfig = {
  playerColor: "w" | "b";
  levelId: number;
  visibility: Visibility;
  mode: GameMode;
  /** Seconds; null = untimed. */
  timeControl: { initial: number; increment: number } | null;
  /** -1 = unlimited. */
  peeks: number;
  moveList: MoveListMode;
};

export type GameResult = { winner: "w" | "b" | null; reason: ResultReason };

export type GameAnalysisSummary = {
  source: "browser" | "server";
  accuracy: { white: number | null; black: number | null };
  counts: { white: Record<Classification, number>; black: Record<Classification, number> };
  /** White-POV win% after each ply (index 0 = start position). */
  curve: number[];
  /** Per-ply classification. */
  classes: Classification[];
  best: Array<string | null>;
};

export type GameRecord = {
  id: string;
  config: GameConfig;
  startedAt: number;
  updatedAt: number;
  /** Moves in long algebraic (UCI) form, e.g. "e2e4", "e7e8q". */
  moves: string[];
  sans: string[];
  moveTimes: number[];
  clocks: { w: number; b: number } | null;
  peeksUsed: number;
  illegalAttempts: number;
  takebacks: number;
  result: GameResult | null;
  endedAt: number | null;
  ratingBefore?: number;
  ratingAfter?: number;
  analysis?: GameAnalysisSummary;
};

export type DrillSession = {
  id: string;
  drill: DrillId;
  level: number;
  timed: boolean;
  startedAt: number;
  durationMs: number;
  correct: number;
  total: number;
  /** 0..1 */
  accuracy: number;
  bestStreak: number;
  ratingAfter?: number;
};

export type PuzzleAttempt = {
  id: string;
  puzzleId: string;
  puzzleRating: number;
  goal: string;
  solved: boolean;
  firstTry: boolean;
  mistakes: number;
  peeks: number;
  timeMs: number;
  ts: number;
  ratingAfter?: number;
};

export type Ratings = {
  blindfold: { rating: number; played: number; peak: number };
  puzzles: { rating: number; played: number; peak: number };
  drills: Partial<Record<DrillId, { rating: number; played: number; peak: number }>>;
};

export type ExportBlob = {
  app: "blindfold-chess";
  version: 1;
  exportedAt: string;
  games: GameRecord[];
  sessions: DrillSession[];
  puzzles: PuzzleAttempt[];
  ratings: Ratings;
};
