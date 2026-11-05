"use client";
import type { Move, Square } from "chess.js";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Board } from "@/components/board/Board";
import { EvalBar } from "@/components/board/EvalBar";
import { IconChevronLeft, IconChevronRight, IconChevronsLeft, IconChevronsRight, IconPause, IconPlay } from "@/components/ui/Icons";
import { CLASSIFICATION_META } from "@/lib/analysis/accuracy";
import { formatScore, type GameAnalysis, type PlyAnalysis } from "@/lib/analysis/analyze";
import { moveSound, playSound } from "@/lib/audio/sounds";
import { replay } from "@/lib/game/rules";
import { cn } from "@/lib/utils/cn";
import { EvalGraph } from "./EvalGraph";
import { MoveList } from "./MoveList";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export type ReplayState = {
  history: Move[];
  total: number;
  ply: number;
  go: (p: number, withSound?: boolean) => void;
  playing: boolean;
  setPlaying: (v: boolean) => void;
  toggle: () => void;
  fen: string;
  last: Move | null;
  pa: PlyAnalysis | null;
  win: number;
  label: string;
};

/** Replay state with ← → Home End keys and an optional autoplay. */
export function useReplay(moves: string[], analysis: GameAnalysis | null, { initialPly, autoPlay = false, keyboard = true }: { initialPly?: number; autoPlay?: boolean; keyboard?: boolean } = {}): ReplayState {
  const { history } = useMemo(() => replay(moves), [moves]);
  const total = history.length;
  const [ply, setPly] = useState(initialPly ?? (autoPlay ? 0 : total));
  const [playing, setPlaying] = useState(autoPlay);

  const go = useCallback(
    (p: number, withSound = true) => {
      const next = Math.max(0, Math.min(total, p));
      setPly((cur) => {
        if (withSound && next === cur + 1 && history[next - 1]) playSound(moveSound(history[next - 1]!));
        return next;
      });
    },
    [total, history],
  );

  useEffect(() => {
    if (!playing || ply >= total) return;
    const t = window.setTimeout(() => {
      go(ply + 1);
      if (ply + 1 >= total) setPlaying(false);
    }, ply === 0 ? 500 : 850);
    return () => window.clearTimeout(t);
  }, [playing, ply, total, go]);

  useEffect(() => {
    if (!keyboard) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "ArrowLeft") {
        setPlaying(false);
        go(ply - 1, false);
      } else if (e.key === "ArrowRight") {
        setPlaying(false);
        go(ply + 1);
      } else if (e.key === "Home") go(0, false);
      else if (e.key === "End") go(total, false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, ply, total, keyboard]);

  const fen = ply === 0 ? START_FEN : history[ply - 1]!.after;
  const last = ply > 0 ? history[ply - 1]! : null;
  const pa = ply > 0 ? (analysis?.plies[ply - 1] ?? null) : null;
  const win = ply === 0 ? (analysis?.initialWin ?? 50) : (pa?.win ?? 50);
  const label = pa ? formatScore(pa.score) : "0.0";
  const toggle = () => {
    if (!playing && ply >= total) go(0, false);
    setPlaying(!playing);
  };
  return { history, total, ply, go, playing, setPlaying, toggle, fen, last, pa, win, label };
}

/** The best move, as an arrow, when the played move was an error. */
export function bestArrow(pa: PlyAnalysis | null) {
  const show = pa && (pa.classification === "mistake" || pa.classification === "blunder" || pa.classification === "inaccuracy") && pa.bestUci;
  return show ? [{ from: pa.bestUci!.slice(0, 2) as Square, to: pa.bestUci!.slice(2, 4) as Square, color: "good" as const }] : [];
}

export function ReplayControls({ r, className }: { r: ReplayState; className?: string }) {
  const btn =
    "relative inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-ink outline-none transition-[background,transform] duration-200 hover:bg-ink/[0.07] active:scale-90 focus-visible:outline-2 focus-visible:outline-[var(--focus)] disabled:pointer-events-none disabled:opacity-35";
  return (
    <div className={cn("glass-well flex items-center justify-between gap-1 rounded-full p-1", className)} role="group" aria-label="Replay">
      <button type="button" className={btn} aria-label="First move" title="First move (Home)" disabled={r.ply === 0} onClick={() => { r.setPlaying(false); r.go(0, false); }}>
        <IconChevronsLeft />
      </button>
      <button type="button" className={btn} aria-label="Previous move" title="Previous move (←)" disabled={r.ply === 0} onClick={() => { r.setPlaying(false); r.go(r.ply - 1, false); }}>
        <IconChevronLeft />
      </button>
      <button type="button" className={cn(btn, "pill-primary h-11 w-11 hover:bg-transparent")} aria-label={r.playing ? "Pause replay" : "Play replay"} onClick={r.toggle}>
        {r.playing ? <IconPause /> : <IconPlay />}
      </button>
      <button type="button" className={btn} aria-label="Next move" title="Next move (→)" disabled={r.ply >= r.total} onClick={() => { r.setPlaying(false); r.go(r.ply + 1); }}>
        <IconChevronRight />
      </button>
      <button type="button" className={btn} aria-label="Last move" title="Last move (End)" disabled={r.ply >= r.total} onClick={() => { r.setPlaying(false); r.go(r.total, false); }}>
        <IconChevronsRight />
      </button>
    </div>
  );
}

/** What happened on the selected move: the move, its quality and, after an error, the better move. */
export function ReplayInfo({ r }: { r: ReplayState }) {
  const { pa, last, ply } = r;
  const showBest = pa && (pa.classification === "mistake" || pa.classification === "blunder" || pa.classification === "inaccuracy") && pa.bestSan;
  return (
    <div className="glass-well min-h-[4.5rem] rounded-control px-4 py-3" aria-live="polite">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={ply} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.1 } }} transition={{ duration: 0.18 }}>
          {pa ? (
            <>
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold tabular text-ink">
                  {Math.ceil(ply / 2)}.{pa.color === "b" ? ".." : ""} {pa.san}
                </span>
                <span className={cn("rounded-full bg-surface px-2.5 py-0.5 text-caption font-semibold shadow-raised", CLASSIFICATION_META[pa.classification].tone)}>
                  {CLASSIFICATION_META[pa.classification].symbol} {CLASSIFICATION_META[pa.classification].label}
                </span>
                <span className="ml-auto text-small tabular text-muted">{r.label}</span>
              </div>
              {showBest ? (
                <p className="mt-1 text-small text-fg">
                  Better was <span className="font-semibold text-good">{pa.bestSan}</span>.
                </p>
              ) : (
                <p className="mt-1 text-small text-muted">Accuracy {Math.round(pa.accuracy)}%</p>
              )}
            </>
          ) : last ? (
            <span className="text-lg font-semibold tabular text-ink">
              {Math.ceil(ply / 2)}.{last.color === "b" ? ".." : ""} {last.san}
            </span>
          ) : (
            <span className="text-small text-muted">Starting position. Press play, or use the arrow keys.</span>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/** Stand-alone replay with its own board (used by the Stats page). */
export function ReplayViewer({ moves, analysis, orientation, initialPly, autoPlay = false }: { moves: string[]; analysis: GameAnalysis | null; orientation: "white" | "black"; initialPly?: number; autoPlay?: boolean }) {
  const r = useReplay(moves, analysis, { initialPly, autoPlay });
  const curve = analysis ? [analysis.initialWin, ...analysis.plies.map((p) => p.win)] : null;
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
      <div className="flex gap-3">
        {analysis ? <EvalBar win={r.win} label={r.label} orientation={orientation} /> : null}
        <div className="min-w-0 flex-1">
          <Board
            fen={r.fen}
            orientation={orientation}
            lastMove={r.last ? { from: r.last.from, to: r.last.to, flags: r.last.flags, promotion: r.last.promotion, captured: r.last.captured } : null}
            interactive={false}
            arrows={bestArrow(r.pa)}
            ariaLabel={`Replay position after ply ${r.ply}`}
          />
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-3">
        <ReplayControls r={r} />
        <ReplayInfo r={r} />
        {curve ? <EvalGraph curve={curve} classes={analysis?.plies.map((p) => p.classification)} activePly={r.ply} onSelect={(p) => { r.setPlaying(false); r.go(p, false); }} /> : null}
        <MoveList
          sans={r.history.map((h) => h.san)}
          activePly={r.ply}
          onSelectPly={(p) => {
            r.setPlaying(false);
            r.go(p, false);
          }}
          classes={analysis?.plies.map((p) => p.classification)}
          className="max-h-56"
        />
      </div>
    </div>
  );
}
