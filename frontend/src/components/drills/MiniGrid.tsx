"use client";
import type { Square } from "chess.js";
import { motion } from "motion/react";
import { ALL_SQUARES, squareShade, squareToGrid, type Orientation } from "@/lib/chess/squares";
import { cn } from "@/lib/utils/cn";

export type GridMark = "a" | "b" | "good" | "bad" | "path" | "blocked" | "soft";

const MARK: Record<GridMark, string> = {
  a: "bg-ember-400 text-night-950",
  b: "bg-moon-400 text-night-950",
  good: "bg-jade-400/80 text-night-950",
  bad: "bg-coral-400/80 text-night-950",
  path: "bg-ember-300/60 text-night-950",
  blocked: "bg-coral-500/35 text-coral-100",
  soft: "bg-moon-400/30 text-ivory-50",
};

/**
 * A neutral 8×8 grid (no light/dark colouring) for visualisation drills, so the answer is
 * never given away by the square colour.
 */
export function MiniGrid({
  orientation = "white",
  marks = {},
  coords = true,
  labels = false,
  colored = false,
  onSquareClick,
  className,
}: {
  orientation?: Orientation;
  marks?: Partial<Record<Square, GridMark>>;
  coords?: boolean;
  labels?: boolean;
  colored?: boolean;
  onSquareClick?: (sq: Square) => void;
  className?: string;
}) {
  return (
    <div className={cn("relative aspect-square w-full overflow-hidden rounded-xl bg-night-850 ring-1 ring-ivory-100/10", className)}>
      {ALL_SQUARES.map((sq) => {
        const { col, row } = squareToGrid(sq, orientation);
        const mark = marks[sq];
        const edgeFile = row === 7;
        const edgeRank = col === 0;
        return (
          <button
            key={sq}
            type="button"
            tabIndex={onSquareClick ? 0 : -1}
            aria-label={onSquareClick ? sq : undefined}
            aria-hidden={onSquareClick ? undefined : true}
            onClick={onSquareClick ? () => onSquareClick(sq) : undefined}
            className={cn(
              "absolute flex items-center justify-center border-[0.5px] border-ivory-100/[0.06] outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-moon-300",
              onSquareClick ? "cursor-pointer hover:bg-ivory-100/[0.06]" : "cursor-default",
            )}
            style={{
              left: `${col * 12.5}%`,
              top: `${row * 12.5}%`,
              width: "12.5%",
              height: "12.5%",
              background: colored ? (squareShade(sq) === "dark" ? "var(--sq-dark)" : "var(--sq-light)") : undefined,
            }}
          >
            {mark ? (
              <motion.span
                className={cn("absolute inset-[8%] flex items-center justify-center rounded-md font-mono text-[clamp(9px,1.6vw,13px)] font-bold", MARK[mark])}
                initial={{ scale: 0.3, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 26 }}
              >
                {labels || mark === "a" || mark === "b" ? sq : ""}
              </motion.span>
            ) : null}
            {coords && edgeRank ? <span className="pointer-events-none absolute left-1 top-0.5 font-mono text-[10px] text-ivory-500">{sq[1]}</span> : null}
            {coords && edgeFile ? <span className="pointer-events-none absolute bottom-0.5 right-1 font-mono text-[10px] text-ivory-500">{sq[0]}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
