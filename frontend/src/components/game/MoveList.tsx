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
      <div className={cn("rounded-2xl bg-night-850/60 p-4 text-sm text-ivory-400 ring-1 ring-inset ring-ivory-100/[0.06]", className)}>
        Move list hidden — keep the game in your head. {sans.length} plies played.
      </div>
    );
  }

  if (mode === "last") {
    const last = sans[sans.length - 1];
    const ply = sans.length;
    return (
      <div className={cn("rounded-2xl bg-night-850/60 p-4 ring-1 ring-inset ring-ivory-100/[0.06]", className)}>
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ivory-500">Last move</div>
        <AnimatePresence mode="wait">
          <motion.div
            key={ply}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mt-1 font-mono text-2xl text-ivory-50"
          >
            {last ? `${Math.ceil(ply / 2)}.${ply % 2 === 0 ? ".." : ""} ${fmt(last)}` : "—"}
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

  const rows = pairMoves(sans.map((s, i) => ({ san: s, ply: i + 1 })));
  return (
    <div
      ref={scroller}
      className={cn("max-h-72 overflow-y-auto rounded-2xl bg-night-850/60 p-2 ring-1 ring-inset ring-ivory-100/[0.06]", className)}
      data-testid="move-list"
    >
      {rows.length === 0 ? <div className="p-3 text-sm text-ivory-500">No moves yet.</div> : null}
      <ol className="grid grid-cols-[2.5rem_1fr_1fr] gap-x-1 gap-y-0.5 font-mono text-[14px]">
        {rows.map((row) => (
          <li key={row.number} className="contents">
            <span className="py-1 pr-1 text-right text-ivory-500 tabular">{row.number}.</span>
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
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-2 py-1 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-moon-300",
                    activePly === cell.ply ? "bg-ember-400/20 text-ember-100" : "text-ivory-100",
                    onSelectPly ? "hover:bg-ivory-100/[0.06]" : "cursor-default",
                  )}
                >
                  {fmt(cell.san)}
                  {classes?.[cell.ply - 1] && classes[cell.ply - 1] !== "best" && classes[cell.ply - 1] !== "excellent" && classes[cell.ply - 1] !== "good" ? (
                    <span className={cn("text-[11px] font-bold", CLASSIFICATION_META[classes[cell.ply - 1]!].tone)}>
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
