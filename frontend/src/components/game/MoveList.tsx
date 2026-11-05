"use client";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef } from "react";
import { CLASSIFICATION_META, type Classification } from "@/lib/analysis/accuracy";
import { pairMoves, toFigurine } from "@/lib/chess/notation";
import { useSettings } from "@/lib/settings/store";
import type { MoveListMode } from "@/lib/storage/types";
import { cn } from "@/lib/utils/cn";

type Props = {
  sans: string[];
  mode?: MoveListMode;
  /** Highlighted ply (1-based) in replay. */
  activePly?: number;
  onSelectPly?: (ply: number) => void;
  classes?: Classification[];
  className?: string;
};

const QUIET = new Set<Classification>(["best", "excellent", "good"]);

export function MoveList({ sans, mode = "full", activePly, onSelectPly, classes, className }: Props) {
  const figurine = useSettings((s) => s.figurine);
  const fmt = (s: string) => (figurine ? toFigurine(s) : s);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const active = el.querySelector<HTMLElement>("[data-active='true']");
    if (active) active.scrollIntoView({ block: "nearest", behavior: "smooth" });
    else el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [sans.length, activePly]);

  if (mode === "hidden") {
    return (
      <div className={cn("glass-well rounded-control p-4 text-small text-muted", className)}>
        The move list is hidden: keep the game in your head. {sans.length} {sans.length === 1 ? "move" : "moves"} played.
      </div>
    );
  }

  if (mode === "last") {
    const last = sans[sans.length - 1];
    const ply = sans.length;
    return (
      <div className={cn("glass-well rounded-control p-4", className)}>
        <div className="text-small text-muted">Last move</div>
        <AnimatePresence mode="wait">
          <motion.div key={ply} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="mt-1 text-2xl font-semibold tabular text-ink">
            {last ? `${Math.ceil(ply / 2)}.${ply % 2 === 0 ? ".." : ""} ${fmt(last)}` : "None yet"}
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

  const rows = pairMoves(sans.map((s, i) => ({ san: s, ply: i + 1 })));
  return (
    <div ref={scroller} className={cn("glass-well max-h-72 overflow-y-auto rounded-control p-1.5", className)} data-testid="move-list">
      {rows.length === 0 ? <div className="px-3 py-2.5 text-small text-muted">No moves yet.</div> : null}
      <ol className="grid grid-cols-[2.25rem_1fr_1fr] gap-x-1 gap-y-0.5 text-[0.9375rem]">
        {rows.map((row) => (
          <li key={row.number} className="contents">
            <span className="py-1.5 pr-1 text-right text-muted tabular">{row.number}.</span>
            {[row.white, row.black].map((cell, idx) =>
              cell ? (
                <motion.button
                  key={cell.ply}
                  type="button"
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.25 }}
                  onClick={onSelectPly ? () => onSelectPly(cell.ply) : undefined}
                  data-active={activePly === cell.ply}
                  tabIndex={onSelectPly ? 0 : -1}
                  aria-current={activePly === cell.ply ? "step" : undefined}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-left font-semibold tabular outline-none transition-colors focus-visible:outline-2 focus-visible:outline-[var(--focus)]",
                    activePly === cell.ply ? "bg-ink text-on-ink" : "text-ink",
                    onSelectPly ? "cursor-pointer hover:bg-ink/[0.07]" : "cursor-default",
                    activePly === cell.ply && onSelectPly && "hover:bg-ink",
                  )}
                >
                  {fmt(cell.san)}
                  {classes?.[cell.ply - 1] && !QUIET.has(classes[cell.ply - 1]!) ? (
                    <span className={cn("text-caption font-bold", activePly === cell.ply ? "text-on-ink" : CLASSIFICATION_META[classes[cell.ply - 1]!].tone)}>
                      {CLASSIFICATION_META[classes[cell.ply - 1]!].symbol}
                    </span>
                  ) : null}
                </motion.button>
              ) : (
                <span key={`empty-${idx}`} />
              ),
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
