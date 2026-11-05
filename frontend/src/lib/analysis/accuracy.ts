/**
 * Engine-based accuracy and move classification. The formulas are shared with the backend
 * (`backend/app/services/accuracy.py`) so both produce identical numbers.
 */

export type Classification = "best" | "excellent" | "good" | "inaccuracy" | "mistake" | "blunder";

export const CLASSIFICATIONS: Classification[] = ["best", "excellent", "good", "inaccuracy", "mistake", "blunder"];

export type EvalScore = { cp: number | null; mate: number | null };

/** Win probability (0..100) for White from a White-POV centipawn score. */
export function winFromCp(cp: number): number {
  const c = Math.max(-1000, Math.min(1000, cp));
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * c)) - 1);
}

/** Win probability for White from a White-POV score (mate > 0 means White mates). */
export function winFromScore(score: EvalScore): number {
  if (score.mate !== null) {
    if (score.mate > 0) return 100;
    if (score.mate < 0) return 0;
    return 50;
  }
  return winFromCp(score.cp ?? 0);
}

/** Accuracy (0..100) of a single move given the mover's win-% drop. */
export function moveAccuracy(drop: number): number {
  const d = Math.max(0, drop);
  const raw = 103.1668100711649 * Math.exp(-0.04354415386753951 * d) - 3.166924740191411;
  return Math.max(0, Math.min(100, raw));
}

export function classify(drop: number, isBest: boolean): Classification {
  if (drop >= 15) return "blunder";
  if (drop >= 10) return "mistake";
  if (drop >= 5) return "inaccuracy";
  if (isBest) return "best";
  if (drop < 2) return "excellent";
  return "good";
}

/** Blend of arithmetic and harmonic mean — punishes blunders without being too harsh. */
export function aggregateAccuracy(values: number[]): number | null {
  if (values.length === 0) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const harmonic = values.length / values.reduce((a, b) => a + 1 / Math.max(b, 1), 0);
  return Math.round(((mean + harmonic) / 2) * 10) / 10;
}

/** Drop in the mover's winning chances between two White-POV win percentages. */
export function moverDrop(winBeforeWhite: number, winAfterWhite: number, mover: "w" | "b"): number {
  const before = mover === "w" ? winBeforeWhite : 100 - winBeforeWhite;
  const after = mover === "w" ? winAfterWhite : 100 - winAfterWhite;
  return Math.max(0, before - after);
}

export const CLASSIFICATION_META: Record<Classification, { label: string; symbol: string; tone: string }> = {
  best: { label: "Best", symbol: "★", tone: "text-jade-300" },
  excellent: { label: "Excellent", symbol: "!", tone: "text-jade-400" },
  good: { label: "Good", symbol: "✓", tone: "text-moon-300" },
  inaccuracy: { label: "Inaccuracy", symbol: "?!", tone: "text-ember-300" },
  mistake: { label: "Mistake", symbol: "?", tone: "text-ember-500" },
  blunder: { label: "Blunder", symbol: "??", tone: "text-coral-400" },
};
