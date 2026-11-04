"use client";
import { motion } from "motion/react";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Controls";
import { IconArrowRight, IconRefresh, IconSettings } from "@/components/ui/Icons";
import { CLASSIFICATIONS, CLASSIFICATION_META } from "@/lib/analysis/accuracy";
import type { GameAnalysis } from "@/lib/analysis/analyze";
import { getLevel } from "@/lib/engine/levels";
import { describeResult } from "@/lib/game/rules";
import type { GameRecord } from "@/lib/storage/types";
import { formatDuration } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { ReplayViewer } from "./ReplayViewer";

type Props = {
  game: GameRecord;
  analysis: GameAnalysis | null;
  progress: number | null;
  analysisError: string | null;
  onRematch: () => void;
  onNewGame: () => void;
};

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.15 } } };
const item = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] as const } } };

export function GameOverPanel({ game, analysis, progress, analysisError, onRematch, onNewGame }: Props) {
  const res = describeResult(game.result!, game.config.playerColor);
  const me = game.config.playerColor === "w" ? "white" : "black";
  const accuracy = analysis?.accuracy[me] ?? null;
  const duration = (game.endedAt ?? game.updatedAt) - game.startedAt;
  const myMoves = Math.ceil((game.moves.length - (game.config.playerColor === "w" ? 0 : 1)) / 2);
  const counts = analysis?.counts[me];
  const maxCount = counts ? Math.max(1, ...Object.values(counts)) : 1;
  const ratingDelta = game.ratingAfter !== undefined && game.ratingBefore !== undefined ? game.ratingAfter - game.ratingBefore : null;

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="flex flex-col gap-6" data-testid="game-over">
      <motion.div variants={item} className="text-center">
        <div
          className={cn(
            "mx-auto mb-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ring-1 ring-inset",
            res.outcome === "win" && "bg-jade-400/10 text-jade-300 ring-jade-400/30",
            res.outcome === "loss" && "bg-coral-400/10 text-coral-300 ring-coral-400/30",
            res.outcome === "draw" && "bg-moon-400/10 text-moon-200 ring-moon-400/30",
          )}
        >
          {res.outcome === "win" ? "Victory" : res.outcome === "loss" ? "Defeat" : "Draw"} · vs {getLevel(game.config.levelId).name}
        </div>
        <h2 className="text-4xl font-semibold text-ivory-50 sm:text-5xl" data-testid="result-title">
          {res.title}
        </h2>
        <p className="mt-2 text-ivory-300">{res.detail}</p>
      </motion.div>

      <motion.div variants={item} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Your accuracy" testId="stat-accuracy">
          {accuracy !== null ? (
            <AnimatedNumber value={accuracy} decimals={1} suffix="%" />
          ) : analysisError ? (
            <span className="text-base text-ivory-400">n/a</span>
          ) : (
            <span className="skeleton inline-block h-8 w-20 align-middle" />
          )}
        </Stat>
        <Stat label="Peeks used" testId="stat-peeks">
          <AnimatedNumber value={game.peeksUsed} />
          {game.config.peeks >= 0 ? <span className="text-base text-ivory-500"> / {game.config.peeks}</span> : null}
        </Stat>
        <Stat label="Illegal attempts" testId="stat-illegal">
          <AnimatedNumber value={game.illegalAttempts} />
        </Stat>
        <Stat label="Time" testId="stat-time">
          <span>{formatDuration(duration)}</span>
          <span className="block text-xs font-normal text-ivory-500">{myMoves} moves</span>
        </Stat>
      </motion.div>

      {ratingDelta !== null ? (
        <motion.div variants={item} className="text-center text-sm text-ivory-300">
          Blindfold rating{" "}
          <span className="font-mono text-ivory-50">
            <AnimatedNumber value={game.ratingAfter!} />
          </span>{" "}
          <span className={cn("font-mono font-semibold", ratingDelta >= 0 ? "text-jade-300" : "text-coral-300")}>
            ({ratingDelta >= 0 ? "+" : ""}
            {ratingDelta})
          </span>
        </motion.div>
      ) : null}

      <motion.div variants={item} className="flex flex-wrap justify-center gap-3">
        <Button variant="primary" size="lg" onClick={onRematch} icon={<IconRefresh size={18} />} data-testid="rematch">
          Play again
        </Button>
        <Button variant="secondary" size="lg" onClick={onNewGame} icon={<IconSettings size={18} />} data-testid="new-game">
          New setup
        </Button>
      </motion.div>

      <motion.div variants={item}>
        <Card className="p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-xl font-semibold text-ivory-50">Game review</h3>
            {!analysis && !analysisError && game.moves.length >= 2 ? (
              <div className="flex min-w-[220px] items-center gap-3 text-xs text-ivory-400" data-testid="analysis-progress">
                <span>Analysing with Stockfish…</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-night-700">
                  <motion.div className="h-full origin-left rounded-full bg-gradient-to-r from-moon-400 to-ember-400" initial={{ scaleX: 0 }} animate={{ scaleX: progress ?? 0 }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
                </div>
              </div>
            ) : analysis ? (
              <span className="text-xs text-ivory-500">Analysed {analysis.source === "server" ? "on the server" : "in your browser"}</span>
            ) : analysisError ? (
              <span className="text-xs text-ember-300">{analysisError}</span>
            ) : null}
          </div>

          {counts ? (
            <div className="mb-5 grid grid-cols-3 gap-2 sm:grid-cols-6">
              {CLASSIFICATIONS.map((c, i) => (
                <div key={c} className="rounded-xl bg-night-850/70 p-2.5 ring-1 ring-inset ring-ivory-100/[0.05]">
                  <div className={cn("text-[11px] font-semibold uppercase tracking-wider", CLASSIFICATION_META[c].tone)}>{CLASSIFICATION_META[c].label}</div>
                  <div className="mt-1 font-mono text-xl text-ivory-50">{counts[c]}</div>
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-night-700">
                    <motion.div
                      className="h-full origin-left rounded-full bg-current"
                      style={{ color: "currentColor" }}
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: counts[c] / maxCount }}
                      transition={{ delay: 0.2 + i * 0.05, type: "spring", stiffness: 140, damping: 20 }}
                    >
                      <span className={cn("block h-full w-full", CLASSIFICATION_META[c].tone.replace("text-", "bg-"))} />
                    </motion.div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          <ReplayViewer moves={game.moves} analysis={analysis} orientation={game.config.playerColor === "w" ? "white" : "black"} autoPlay={false} />
        </Card>
      </motion.div>

      <motion.div variants={item} className="text-center">
        <a href="/stats" className="inline-flex items-center gap-1.5 text-sm text-ivory-400 underline-offset-4 hover:text-ivory-100 hover:underline">
          See all your stats <IconArrowRight size={14} />
        </a>
      </motion.div>
    </motion.div>
  );
}

function Stat({ label, children, testId }: { label: string; children: React.ReactNode; testId?: string }) {
  return (
    <div className="rounded-2xl bg-night-850/70 p-4 ring-1 ring-inset ring-ivory-100/[0.06]" data-testid={testId}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ivory-500">{label}</div>
      <div className="mt-1.5 text-3xl font-semibold tracking-tight text-ivory-50">{children}</div>
    </div>
  );
}
