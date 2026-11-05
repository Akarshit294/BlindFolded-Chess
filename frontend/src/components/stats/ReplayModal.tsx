"use client";
import { motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { ReplayViewer } from "@/components/game/replay";
import { Modal } from "@/components/ui/Modal";
import { analyzeGame, type GameAnalysis } from "@/lib/analysis/analyze";
import { getLevel } from "@/lib/engine/levels";
import { describeResult } from "@/lib/game/result";
import type { GameRecord } from "@/lib/storage/types";

/**
 * Replay of a saved game with fresh engine analysis. Loaded on demand by the Stats page,
 * since it brings in the board, chess.js and the engine client.
 */
export function ReplayModal({ game, onClose }: { game: GameRecord; onClose: () => void }) {
  const [analysis, setAnalysis] = useState<GameAnalysis | null>(null);
  const [progress, setProgress] = useState(0);
  const run = useCallback(() => {
    const ctrl = new AbortController();
    analyzeGame(game.moves, { signal: ctrl.signal, onProgress: (d, t) => setProgress(d / t) })
      .then(setAnalysis)
      .catch(() => undefined);
    return () => ctrl.abort();
  }, [game.moves]);
  useEffect(() => (game.moves.length >= 2 ? run() : undefined), [run, game.moves.length]);
  return (
    <Modal open onClose={onClose} title={`${describeResult(game.result!, game.config.playerColor).title} vs ${getLevel(game.config.levelId).name}`} className="max-w-5xl">
      {!analysis && game.moves.length >= 2 ? (
        <div className="mb-3 flex items-center gap-3 text-xs text-ivory-400">
          Analysing…
          <div className="h-1.5 w-48 overflow-hidden rounded-full bg-night-700">
            <motion.div className="h-full origin-left bg-moon-400" animate={{ scaleX: progress }} />
          </div>
        </div>
      ) : null}
      <div className="max-h-[75vh] overflow-y-auto">
        <ReplayViewer moves={game.moves} analysis={analysis} orientation={game.config.playerColor === "w" ? "white" : "black"} />
      </div>
    </Modal>
  );
}
