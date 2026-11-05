"use client";
import { motion } from "motion/react";
import Link from "next/link";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { ProgressLine } from "@/components/ui/Blocks";
import { Button } from "@/components/ui/Button";
import { Badge, Panel } from "@/components/ui/Controls";
import { IconRefresh, IconSliders } from "@/components/ui/Icons";
import { CLASSIFICATIONS, CLASSIFICATION_META } from "@/lib/analysis/accuracy";
import type { GameAnalysis } from "@/lib/analysis/analyze";
import { getLevel } from "@/lib/engine/levels";
import { describeResult } from "@/lib/game/rules";
import type { GameRecord, ResultReason } from "@/lib/storage/types";
import { formatDuration } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { EvalGraph } from "./EvalGraph";
import { MoveList } from "./MoveList";
import { ReplayInfo, type ReplayState } from "./replay";

const HOW: Record<ResultReason, string> = {
  checkmate: "Checkmate",
  stalemate: "Stalemate",
  threefold: "Repetition",
  "fifty-move": "Fifty moves",
  insufficient: "No material",
  resign: "Resigned",
  timeout: "On time",
  agreement: "Agreed",
};

const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] as const } } };

function Stat({ label, children, testId }: { label: string; children: React.ReactNode; testId: string }) {
  return (
    <div className="glass-well rounded-control px-3.5 py-3" data-testid={testId}>
      <dt className="text-small text-muted">{label}</dt>
      <dd className="mt-1 font-display text-[1.75rem] font-bold leading-none tabular text-ink">{children}</dd>
    </div>
  );
}

/** The result, in place of the controls: how it ended, the numbers, and one click to play again. */
export function ResultPanel({ game, analysis, analysisError, onRematch, onNewSetup }: { game: GameRecord; analysis: GameAnalysis | null; analysisError: string | null; onRematch: () => void; onNewSetup: () => void }) {
  const res = describeResult(game.result!, game.config.playerColor);
  const me = game.config.playerColor === "w" ? "white" : "black";
  const accuracy = analysis?.accuracy[me] ?? null;
  const duration = (game.endedAt ?? game.updatedAt) - game.startedAt;
  const myMoves = Math.ceil((game.moves.length - (game.config.playerColor === "w" ? 0 : 1)) / 2);
  const ratingDelta = game.ratingAfter !== undefined && game.ratingBefore !== undefined ? game.ratingAfter - game.ratingBefore : null;
  const outcome = res.outcome === "win" ? "You win" : res.outcome === "loss" ? "You lost" : "Draw";
  return (
    <motion.div initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }} data-testid="game-over">
      <Panel className="p-5 sm:p-6">
        <motion.div variants={item} className="flex flex-wrap items-center gap-2">
          <Badge tone={res.outcome === "win" ? "good" : res.outcome === "loss" ? "bad" : "neutral"}>{res.outcome === "win" ? "Victory" : res.outcome === "loss" ? "Defeat" : "Draw"}</Badge>
          <span className="text-small text-muted">against {getLevel(game.config.levelId).name}</span>
        </motion.div>
        <motion.h2 variants={item} className="display mt-4 text-display-md" data-testid="result-title" aria-label={res.title}>
          <span className="thin">{HOW[game.result!.reason]}</span> {outcome}
        </motion.h2>
        <motion.p variants={item} className="mt-2 text-[0.9375rem] text-fg">
          {res.detail}
          {ratingDelta !== null ? (
            <>
              {" "}
              Blindfold rating{" "}
              <span className="font-semibold tabular text-ink">
                <AnimatedNumber value={game.ratingAfter!} />
              </span>{" "}
              <span className={cn("font-semibold tabular", ratingDelta >= 0 ? "text-good" : "text-bad")}>
                ({ratingDelta >= 0 ? "+" : ""}
                {ratingDelta})
              </span>
            </>
          ) : null}
        </motion.p>
        <motion.dl variants={item} className="mt-5 grid grid-cols-2 gap-2">
          <Stat label="Your accuracy" testId="stat-accuracy">
            {accuracy !== null ? (
              <AnimatedNumber value={accuracy} decimals={1} suffix="%" />
            ) : analysisError || game.moves.length < 2 ? (
              <span className="text-lg font-semibold text-muted">n/a</span>
            ) : (
              <span className="skeleton inline-block h-7 w-20 align-middle" />
            )}
          </Stat>
          <Stat label="Peeks used" testId="stat-peeks">
            <AnimatedNumber value={game.peeksUsed} />
            {game.config.peeks >= 0 ? <span className="text-lg text-muted"> / {game.config.peeks}</span> : null}
          </Stat>
          <Stat label="Illegal attempts" testId="stat-illegal">
            <AnimatedNumber value={game.illegalAttempts} />
          </Stat>
          <Stat label={`Time, ${myMoves} ${myMoves === 1 ? "move" : "moves"}`} testId="stat-time">
            {formatDuration(duration)}
          </Stat>
        </motion.dl>
        <motion.div variants={item} className="mt-6 flex flex-wrap gap-3">
          <Button variant="primary" onClick={onRematch} icon={<IconRefresh size={18} />} data-testid="rematch" data-autofocus>
            Play again
          </Button>
          <Button onClick={onNewSetup} icon={<IconSliders size={18} />} data-testid="new-game">
            Change setup
          </Button>
        </motion.div>
      </Panel>
    </motion.div>
  );
}

/** Engine review beside the board: move quality, the eval graph and the moves, all tied to the replay. */
export function ReviewPanel({ game, analysis, progress, analysisError, r }: { game: GameRecord; analysis: GameAnalysis | null; progress: number | null; analysisError: string | null; r: ReplayState }) {
  const me = game.config.playerColor === "w" ? "white" : "black";
  const counts = analysis?.counts[me];
  const curve = analysis ? [analysis.initialWin, ...analysis.plies.map((p) => p.win)] : null;
  return (
    <Panel className="p-5 sm:p-6" data-testid="review">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="display text-[1.5rem] leading-none">Review</h3>
        {analysis ? <span className="text-caption text-muted">Analysed {analysis.source === "server" ? "on the server" : "in your browser"}</span> : null}
      </div>
      {!analysis && !analysisError && game.moves.length >= 2 ? (
        <div className="mt-4 flex items-center gap-3 text-small text-muted" data-testid="analysis-progress">
          <span className="shrink-0">Analysing with Stockfish…</span>
          <ProgressLine value={progress ?? 0} label="Analysis progress" className="flex-1" />
        </div>
      ) : analysisError ? (
        <p className="mt-3 text-small text-bad">{analysisError}</p>
      ) : null}
      {counts ? (
        <ul className="mt-5 grid grid-cols-3 gap-x-3 gap-y-2" aria-label="Your moves by quality">
          {CLASSIFICATIONS.map((c) => (
            <li key={c} className="flex items-center gap-2 text-small">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: CLASSIFICATION_META[c].color }} aria-hidden="true" />
              <span className="text-muted">{CLASSIFICATION_META[c].label}</span>
              <span className="ml-auto font-semibold tabular text-ink">{counts[c]}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-5 flex flex-col gap-3">
        <ReplayInfo r={r} />
        {curve ? <EvalGraph curve={curve} classes={analysis?.plies.map((p) => p.classification)} activePly={r.ply} onSelect={(p) => { r.setPlaying(false); r.go(p, false); }} /> : null}
        <MoveList sans={r.history.map((h) => h.san)} activePly={r.ply} onSelectPly={(p) => { r.setPlaying(false); r.go(p, false); }} classes={analysis?.plies.map((p) => p.classification)} className="max-h-60" />
      </div>
      <Link href="/stats" className="mt-5 inline-flex text-small font-semibold text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink">
        See all your stats
      </Link>
    </Panel>
  );
}
