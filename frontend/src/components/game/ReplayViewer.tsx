"use client";
import type { Square } from "chess.js";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Board } from "@/components/board/Board";
import { EvalBar } from "@/components/board/EvalBar";
import { IconButton } from "@/components/ui/Button";
import { IconChevronLeft, IconChevronRight, IconChevronsLeft, IconChevronsRight, IconPause, IconPlay } from "@/components/ui/Icons";
import { CLASSIFICATION_META } from "@/lib/analysis/accuracy";
import { formatScore, type GameAnalysis } from "@/lib/analysis/analyze";
import { replay } from "@/lib/game/rules";
import { playSound, moveSound } from "@/lib/audio/sounds";
import { cn } from "@/lib/utils/cn";
import { EvalGraph } from "./EvalGraph";
import { MoveList } from "./MoveList";

type Props = {
  moves: string[];
  analysis: GameAnalysis | null;
  orientation: "white" | "black";
  initialPly?: number;
  autoPlay?: boolean;
};

/** Animated replay with eval bar, eval graph and move classifications. */
export function ReplayViewer({ moves, analysis, orientation, initialPly, autoPlay = false }: Props) {
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
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
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
  }, [go, ply, total]);

  const fen = ply === 0 ? "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1" : history[ply - 1]!.after;
  const last = ply > 0 ? history[ply - 1]! : null;
  const pa = ply > 0 ? analysis?.plies[ply - 1] : null;
  const win = ply === 0 ? (analysis?.initialWin ?? 50) : (pa?.win ?? 50);
  const label = pa ? formatScore(pa.score) : "0.0";
  const showBest = pa && (pa.classification === "mistake" || pa.classification === "blunder" || pa.classification === "inaccuracy") && pa.bestUci;
  const curve = analysis ? [analysis.initialWin, ...analysis.plies.map((p) => p.win)] : null;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex gap-3">
        {analysis ? <EvalBar win={win} label={label} orientation={orientation} /> : null}
        <div className="min-w-0 flex-1">
          <Board
            fen={fen}
            orientation={orientation}
            lastMove={last ? { from: last.from, to: last.to, flags: last.flags, promotion: last.promotion, captured: last.captured } : null}
            interactive={false}
            arrows={showBest ? [{ from: pa!.bestUci!.slice(0, 2) as Square, to: pa!.bestUci!.slice(2, 4) as Square, color: "jade" }] : []}
            ariaLabel={`Replay position after ply ${ply}`}
          />
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex items-center justify-between rounded-2xl bg-night-850/70 p-1.5 ring-1 ring-inset ring-ivory-100/[0.06]">
          <IconButton label="First move" onClick={() => { setPlaying(false); go(0, false); }}>
            <IconChevronsLeft />
          </IconButton>
          <IconButton label="Previous move" onClick={() => { setPlaying(false); go(ply - 1, false); }}>
            <IconChevronLeft />
          </IconButton>
          <IconButton
            label={playing ? "Pause replay" : "Play replay"}
            active={playing}
            onClick={() => {
              if (!playing && ply >= total) go(0, false);
              setPlaying((p) => !p);
            }}
          >
            {playing ? <IconPause /> : <IconPlay />}
          </IconButton>
          <IconButton label="Next move" onClick={() => { setPlaying(false); go(ply + 1); }}>
            <IconChevronRight />
          </IconButton>
          <IconButton label="Last move" onClick={() => { setPlaying(false); go(total, false); }}>
            <IconChevronsRight />
          </IconButton>
        </div>

        <div className="min-h-[68px] rounded-2xl bg-night-850/70 p-3 ring-1 ring-inset ring-ivory-100/[0.06]">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={ply} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
              {pa ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-lg text-ivory-50">
                      {Math.ceil(ply / 2)}.{pa.color === "b" ? ".." : ""} {pa.san}
                    </span>
                    <span className={cn("rounded-full bg-night-700 px-2 py-0.5 text-xs font-semibold", CLASSIFICATION_META[pa.classification].tone)}>
                      {CLASSIFICATION_META[pa.classification].symbol} {CLASSIFICATION_META[pa.classification].label}
                    </span>
                    <span className="ml-auto font-mono text-xs text-ivory-400">{label}</span>
                  </div>
                  {showBest && pa.bestSan ? (
                    <p className="mt-1 text-sm text-ivory-300">
                      Best was <span className="font-mono text-jade-300">{pa.bestSan}</span>.
                    </p>
                  ) : (
                    <p className="mt-1 text-sm text-ivory-400">Accuracy {Math.round(pa.accuracy)}%</p>
                  )}
                </>
              ) : last ? (
                <span className="font-mono text-lg text-ivory-50">
                  {Math.ceil(ply / 2)}.{last.color === "b" ? ".." : ""} {last.san}
                </span>
              ) : (
                <span className="text-sm text-ivory-400">Starting position. Press play or use ← →.</span>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {curve ? <EvalGraph curve={curve} classes={analysis?.plies.map((p) => p.classification)} activePly={ply} onSelect={(p) => { setPlaying(false); go(p, false); }} /> : null}

        <MoveList
          sans={history.map((h) => h.san)}
          activePly={ply}
          onSelectPly={(p) => {
            setPlaying(false);
            go(p, false);
          }}
          classes={analysis?.plies.map((p) => p.classification)}
          className="max-h-56"
        />
      </div>
    </div>
  );
}
