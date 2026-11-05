"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { MeltSurface } from "@/components/board/MeltSurface";
import { EyeMorph } from "@/components/ui/EyeMorph";
import { toFigurine } from "@/lib/chess/notation";
import { useSettings } from "@/lib/settings/store";
import { cn } from "@/lib/utils/cn";
import { useE2E } from "@/lib/utils/e2e";
import { ThinkingDots } from "./bits";

type Props = {
  lastSan: string | null;
  lastBy: "you" | "engine" | null;
  ply: number;
  thinking: boolean;
  inCheck: boolean;
  engineName: string;
  className?: string;
};

/** Total blindfold: the board has melted away completely. Only the last move remains, set large. */
export function BlindStage({ lastSan, lastBy, ply, thinking, inCheck, engineName, className }: Props) {
  const figurine = useSettings((s) => s.figurine);
  const motionPref = useSettings((s) => s.motion);
  const systemReduced = useReducedMotion();
  const reduced = motionPref === "reduced" || (motionPref === "system" && !!systemReduced);
  const e2e = useE2E();
  const moveNumber = Math.ceil(ply / 2);
  return (
    <div
      className={cn(
        "relative flex aspect-square w-full flex-col items-center justify-center overflow-hidden rounded-[0.875rem] shadow-[0_0_0_1px_var(--board-edge),0_34px_60px_-32px_rgb(0_0_0/0.5)]",
        className,
      )}
      style={{ background: "var(--sq-light)" }}
      data-testid="blind-panel"
    >
      <MeltSurface melt={1} still={reduced || e2e.fast} ownSquares />
      {/* Frosted glass over the liquid, heavier in the middle so the move reads. */}
      <div className="absolute inset-0 bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--studio-hi)_78%,transparent),color-mix(in_oklab,var(--studio-hi)_36%,transparent))] backdrop-blur-[6px]" />
      <div className="relative text-ink/70">
        <EyeMorph closed size={40} />
      </div>
      <div className="relative mt-6 flex min-h-[7.5rem] items-center text-center">
        <AnimatePresence mode="wait">
          {lastSan ? (
            <motion.div
              key={ply}
              initial={{ opacity: 0, y: 14, scale: 0.96, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -10, filter: "blur(4px)", transition: { duration: 0.2 } }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="text-small font-semibold text-muted">
                {lastBy === "engine" ? `${engineName} played` : "You played"}, move {moveNumber}
              </div>
              <div className="mt-2 font-display text-[clamp(3.5rem,11vw,6rem)] font-bold leading-none text-ink" data-testid="blind-last-move">
                {figurine ? toFigurine(lastSan) : lastSan}
              </div>
            </motion.div>
          ) : (
            <motion.p key="start" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="max-w-[18rem] px-6 text-[0.9375rem] text-fg">
              The board is in your head now. Picture the starting position, then make your move.
            </motion.p>
          )}
        </AnimatePresence>
      </div>
      <div className="relative mt-4 h-7">
        <AnimatePresence>
          {thinking ? (
            <motion.div key="t" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2 text-small text-muted">
              <ThinkingDots /> {engineName} is thinking
            </motion.div>
          ) : inCheck ? (
            <motion.div key="c" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="rounded-full bg-bad px-3 py-1 text-small font-semibold text-white">
              You are in check
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
