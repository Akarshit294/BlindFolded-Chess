"use client";
import { formatClock } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

/** The running clock is a black lacquer pill; low time turns it red. */
export function Clock({ ms, active, label, testId }: { ms: number; active: boolean; label: string; testId?: string }) {
  const low = ms < 20_000;
  return (
    <div
      data-testid={testId}
      role="timer"
      aria-label={`${label} clock`}
      aria-live="off"
      className={cn(
        "flex h-9 min-w-[5.5rem] items-center justify-center gap-2 rounded-full px-3.5 text-[1.0625rem] font-semibold tabular transition-[background,color,box-shadow,opacity] duration-300",
        active ? (low ? "bg-bad text-white shadow-raised" : "pill-primary") : "glass-well text-muted",
      )}
    >
      {active ? <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" aria-hidden="true" /> : null}
      {formatClock(ms)}
    </div>
  );
}
