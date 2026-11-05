"use client";
import { AnimatePresence, motion } from "motion/react";
import { toFigurine } from "@/lib/chess/notation";
import { useSettings } from "@/lib/settings/store";
import { EyeMorph } from "@/components/ui/EyeMorph";
import { cn } from "@/lib/utils/cn";

type Props = {
  lastSan: string | null;
  lastBy: "you" | "engine" | null;
  ply: number;
  thinking: boolean;
  inCheck: boolean;
  engineName: string;
  className?: string;
};

/** Total-blindfold mode: no board, just a calm "mind's eye" stage that shows the latest move. */
export function BlindPanel({ lastSan, lastBy, ply, thinking, inCheck, engineName, className }: Props) {
  const figurine = useSettings((s) => s.figurine);
  const moveNumber = Math.ceil(ply / 2);
  return (
    <div
      className={cn(
        "relative flex aspect-square w-full flex-col items-center justify-center overflow-hidden rounded-[10px] bg-night-900 ring-1 ring-ivory-100/[0.06]",
        className,
      )}
      data-testid="blind-panel"
    >
      {/* Slow breathing aura. */}
      <motion.div
        aria-hidden="true"
        className="absolute h-[70%] w-[70%] rounded-full"
        style={{ background: "radial-gradient(closest-side, rgba(124,133,223,0.28), rgba(124,133,223,0))" }}
        animate={{ scale: thinking ? [1, 1.12, 1] : [1, 1.05, 1], opacity: thinking ? [0.7, 1, 0.7] : [0.55, 0.8, 0.55] }}
        transition={{ duration: thinking ? 1.6 : 6, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="relative text-moon-300/80">
        <EyeMorph closed size={44} />
      </div>
      <div className="relative mt-6 h-[5.5rem] text-center">
        <AnimatePresence mode="wait">
          {lastSan ? (
            <motion.div
              key={ply}
              initial={{ opacity: 0, y: 14, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-ivory-500">
                {lastBy === "engine" ? `${engineName} played` : "You played"} · move {moveNumber}
              </div>
              <div className="mt-2 font-mono text-5xl font-semibold text-ivory-50 sm:text-6xl" data-testid="blind-last-move">
                {figurine ? toFigurine(lastSan) : lastSan}
              </div>
            </motion.div>
          ) : (
            <motion.div key="start" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="max-w-xs px-6 text-sm text-ivory-400">
              The board is in your head now. Picture the starting position, then make your move.
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="relative mt-4 h-6">
        <AnimatePresence>
          {thinking ? (
            <motion.div key="t" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2 text-sm text-moon-200">
              <ThinkingDots /> {engineName} is thinking
            </motion.div>
          ) : inCheck ? (
            <motion.div key="c" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="rounded-full bg-coral-500/20 px-3 py-0.5 text-sm font-semibold text-coral-200">
              You are in check
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}

export function ThinkingDots() {
  return (
    <span className="inline-flex gap-1" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-current"
          animate={{ opacity: [0.25, 1, 0.25], y: [0, -2, 0] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </span>
  );
}
