export type PuzzleGoal = "mate1" | "mate2" | "mate3" | "win";

/** Same shape as the backend and the bundled JSON (Lichess convention: fen is before moves[0]). */
export type Puzzle = {
  id: string;
  fen: string;
  moves: string[];
  rating: number;
  themes: string[];
  pieces: number;
  goal: PuzzleGoal;
};

export type PuzzleFilters = {
  goal: PuzzleGoal | "any";
  minRating: number;
  maxRating: number;
  maxPieces: number;
};

export const GOAL_LABELS: Record<PuzzleGoal | "any", string> = {
  any: "Any",
  mate1: "Mate in 1",
  mate2: "Mate in 2",
  mate3: "Mate in 3",
  win: "Winning move",
};
