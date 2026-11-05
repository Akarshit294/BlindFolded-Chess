"use client";
import { motion } from "motion/react";
import { formatClock } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

export function Clock({ ms, active, label, testId }: { ms: number; active: boolean; label: string; testId?: string }) {
  const low = ms < 20_000;
  return (
    <motion.div
      data-testid={testId}
      role="timer"
      aria-label={`${label} clock`}
      aria-live="off"
      animate={{ scale: active ? 1 : 0.97, opacity: active ? 1 : 0.65 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className={cn(
        "relative flex items-center gap-2 overflow-hidden rounded-xl px-3 py-1.5 font-mono text-lg font-semibold tabular ring-1 ring-inset",
        active
          ? low
            ? "bg-coral-500/20 text-coral-200 ring-coral-400/40"
            : "bg-ivory-50 text-night-950 ring-ivory-50"
          : "bg-night-800 text-ivory-300 ring-ivory-100/10",
      )}
    >
      {active ? <span className={cn("h-1.5 w-1.5 rounded-full", low ? "bg-coral-300" : "bg-ember-500", "animate-pulse")} /> : null}
      {formatClock(ms)}
    </motion.div>
  );
}
