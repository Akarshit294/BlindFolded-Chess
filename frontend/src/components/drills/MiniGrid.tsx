"use client";
import type { Square } from "chess.js";
import { motion } from "motion/react";
import { ALL_SQUARES, squareShade, squareToGrid, type Orientation } from "@/lib/chess/squares";
import { cn } from "@/lib/utils/cn";

export type GridMark = "a" | "b" | "good" | "bad" | "path" | "blocked" | "soft";

/** Ink for the squares in question; green and red only for right and wrong. */
const MARK: Record<GridMark, string> = {
  a: "bg-ink text-on-ink",
  b: "bg-ink/70 text-on-ink",
  good: "bg-good text-white",
  bad: "bg-bad text-white",
  path: "bg-ink/25 text-ink",
  blocked: "bg-bad/30 text-bad",
  soft: "bg-ink/15 text-ink",
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
    <div className={cn("glass-well relative aspect-square w-full overflow-hidden rounded-control", className)}>
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
              "absolute flex items-center justify-center border-[0.5px] border-line outline-none focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-[var(--focus)]",
              onSquareClick ? "cursor-pointer hover:bg-ink/[0.06]" : "cursor-default",
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
                className={cn("absolute inset-[8%] flex items-center justify-center rounded-md text-[clamp(10px,1.6vw,13px)] font-semibold tabular", MARK[mark])}
                initial={{ scale: 0.3, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 26 }}
              >
                {labels || mark === "a" || mark === "b" ? sq : ""}
              </motion.span>
            ) : null}
            {coords && edgeRank ? <span className="pointer-events-none absolute left-1 top-0.5 text-[11px] font-semibold text-muted">{sq[1]}</span> : null}
            {coords && edgeFile ? <span className="pointer-events-none absolute bottom-0.5 right-1 text-[11px] font-semibold text-muted">{sq[0]}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
