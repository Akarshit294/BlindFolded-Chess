/**
 * Post-game analysis. Tries the backend first (native Stockfish is faster) and falls back to
 * the in-browser WASM engine. Both use the same formulas (see accuracy.ts).
 */
import { Chess } from "chess.js";
import { apiFetch, backendOnline, useBackend } from "@/lib/api/client";
import { evaluatePosition, type EngineClient } from "@/lib/engine/engine";
import { replay, uciToMove } from "@/lib/game/rules";
import type { GameAnalysisSummary } from "@/lib/storage/types";
import { aggregateAccuracy, classify, CLASSIFICATIONS, moveAccuracy, moverDrop, winFromScore, type Classification, type EvalScore } from "./accuracy";

export type PlyAnalysis = {
  ply: number;
  color: "w" | "b";
  san: string;
  uci: string;
  score: EvalScore;
  win: number;
  bestUci: string | null;
  bestSan: string | null;
  drop: number;
  accuracy: number;
  classification: Classification;
};

export type GameAnalysis = {
  source: "browser" | "server";
  initialWin: number;
  plies: PlyAnalysis[];
  accuracy: { white: number | null; black: number | null };
  counts: { white: Record<Classification, number>; black: Record<Classification, number> };
};

function emptyCounts(): Record<Classification, number> {
  return Object.fromEntries(CLASSIFICATIONS.map((c) => [c, 0])) as Record<Classification, number>;
}

function sanOf(fen: string, uci: string | null): string | null {
  if (!uci) return null;
  try {
    return new Chess(fen).move(uciToMove(uci)).san;
  } catch {
    return null;
  }
}

/** Builds per-ply results from position evaluations (index 0 = start). Pure — unit tested. */
export function assembleAnalysis(
  sans: string[],
  ucis: string[],
  colors: Array<"w" | "b">,
  evals: Array<{ score: EvalScore; best: string | null; bestSan: string | null }>,
  source: "browser" | "server",
): GameAnalysis {
  const wins = evals.map((e) => winFromScore(e.score));
  const plies: PlyAnalysis[] = [];
  const counts = { white: emptyCounts(), black: emptyCounts() };
  const accs: { w: number[]; b: number[] } = { w: [], b: [] };
  for (let i = 0; i < sans.length; i++) {
    const color = colors[i]!;
    const before = wins[i]!;
    const after = wins[i + 1]!;
    const drop = moverDrop(before, after, color);
    const best = evals[i]?.best ?? null;
    const isBest = !!best && best === ucis[i];
    const cls = classify(drop, isBest);
    const acc = moveAccuracy(drop);
    accs[color].push(acc);
    counts[color === "w" ? "white" : "black"][cls] += 1;
    plies.push({
      ply: i + 1,
      color,
      san: sans[i]!,
      uci: ucis[i]!,
      score: evals[i + 1]!.score,
      win: after,
      bestUci: best,
      bestSan: evals[i]?.bestSan ?? null,
      drop: Math.round(drop * 10) / 10,
      accuracy: Math.round(acc * 10) / 10,
      classification: cls,
    });
  }
  return {
    source,
    initialWin: wins[0] ?? 50,
    plies,
    accuracy: { white: aggregateAccuracy(accs.w), black: aggregateAccuracy(accs.b) },
    counts,
  };
}

type ServerPly = { ply: number; color: "w" | "b"; san: string; uci: string; cp: number | null; mate: number | null; win: number; best_uci: string | null; best_san: string | null; drop: number; accuracy: number; classification: Classification };
type ServerAnalysis = {
  initial: { cp: number | null; mate: number | null; win: number; best_uci: string | null; best_san: string | null };
  plies: ServerPly[];
  accuracy: { white: number | null; black: number | null };
  counts: { white: Record<Classification, number>; black: Record<Classification, number> };
};

async function analyzeOnServer(moves: string[], depth: number): Promise<GameAnalysis> {
  const data = await apiFetch<ServerAnalysis>("/api/analysis", {
    method: "POST",
    body: JSON.stringify({ moves, depth }),
    timeoutMs: 15_000 + moves.length * 400,
  });
  return {
    source: "server",
    initialWin: data.initial.win,
    plies: data.plies.map((p) => ({
      ply: p.ply,
      color: p.color,
      san: p.san,
      uci: p.uci,
      score: { cp: p.cp, mate: p.mate },
      win: p.win,
      bestUci: p.best_uci,
      bestSan: p.best_san,
      drop: p.drop,
      accuracy: p.accuracy,
      classification: p.classification,
    })),
    accuracy: data.accuracy,
    counts: data.counts,
  };
}

async function analyzeInBrowser(
  moves: string[],
  opts: { movetime: number; depth: number; onProgress?: (done: number, total: number) => void; signal?: AbortSignal; engine?: EngineClient },
): Promise<GameAnalysis> {
  const { history } = replay(moves);
  const fens = [new Chess().fen(), ...history.map((m) => m.after)];
  const evals: Array<{ score: EvalScore; best: string | null; bestSan: string | null }> = [];
  for (let i = 0; i < fens.length; i++) {
    if (opts.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const fen = fens[i]!;
    const pos = new Chess(fen);
    if (pos.isCheckmate()) {
      evals.push({ score: { cp: null, mate: pos.turn() === "w" ? -1 : 1 }, best: null, bestSan: null });
    } else if (pos.isDraw() || pos.isStalemate()) {
      evals.push({ score: { cp: 0, mate: null }, best: null, bestSan: null });
    } else {
      const r = await evaluatePosition(fen, { depth: opts.depth, movetime: opts.movetime }, opts.engine);
      evals.push({ score: r.score, best: r.best, bestSan: sanOf(fen, r.best) });
    }
    opts.onProgress?.(i + 1, fens.length);
  }
  return assembleAnalysis(
    history.map((m) => m.san),
    history.map((m) => m.lan),
    history.map((m) => m.color),
    evals,
    "browser",
  );
}

export async function analyzeGame(
  moves: string[],
  opts: { onProgress?: (done: number, total: number) => void; signal?: AbortSignal; preferServer?: boolean } = {},
): Promise<GameAnalysis> {
  if (opts.preferServer !== false && backendOnline() && useBackend.getState().health?.engine) {
    try {
      opts.onProgress?.(0, 1);
      const res = await analyzeOnServer(moves, 12);
      opts.onProgress?.(1, 1);
      return res;
    } catch {
      // Fall through to the browser engine.
    }
  }
  return analyzeInBrowser(moves, { movetime: 220, depth: 12, onProgress: opts.onProgress, signal: opts.signal });
}

export function summarize(a: GameAnalysis): GameAnalysisSummary {
  return {
    source: a.source,
    accuracy: a.accuracy,
    counts: a.counts,
    curve: [a.initialWin, ...a.plies.map((p) => Math.round(p.win * 10) / 10)],
    classes: a.plies.map((p) => p.classification),
    best: a.plies.map((p) => p.bestSan),
  };
}

export function formatScore(score: EvalScore): string {
  if (score.mate !== null) return score.mate === 0 ? "#" : `M${Math.abs(score.mate)}`;
  const v = (score.cp ?? 0) / 100;
  return `${v > 0 ? "+" : ""}${v.toFixed(1)}`;
}
