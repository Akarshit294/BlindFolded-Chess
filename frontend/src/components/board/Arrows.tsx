"use client";
import type { Square } from "chess.js";
import { AnimatePresence, motion } from "motion/react";
import { squareToGrid, type Orientation } from "@/lib/chess/squares";

export type ArrowColor = "ember" | "moon" | "jade" | "coral";
export type BoardArrow = { from: Square; to: Square; color?: ArrowColor };

const COLORS: Record<ArrowColor, string> = {
  ember: "rgba(245,176,78,0.88)",
  moon: "rgba(156,167,240,0.9)",
  jade: "rgba(87,217,163,0.88)",
  coral: "rgba(255,125,107,0.88)",
};

function center(sq: Square, o: Orientation) {
  const { col, row } = squareToGrid(sq, o);
  return { x: col + 0.5, y: row + 0.5 };
}

function arrowPath(from: Square, to: Square, o: Orientation): string {
  const a = center(from, o);
  const b = center(to, o);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const isKnight = (Math.abs(dx) === 1 && Math.abs(dy) === 2) || (Math.abs(dx) === 2 && Math.abs(dy) === 1);
  const shorten = 0.42;
  if (isKnight) {
    // L-shaped: long leg first, then the short one.
    const corner = Math.abs(dx) > Math.abs(dy) ? { x: b.x, y: a.y } : { x: a.x, y: b.y };
    const lx = b.x - corner.x;
    const ly = b.y - corner.y;
    const len = Math.hypot(lx, ly);
    const end = { x: b.x - (lx / len) * shorten, y: b.y - (ly / len) * shorten };
    return `M ${a.x} ${a.y} L ${corner.x} ${corner.y} L ${end.x} ${end.y}`;
  }
  const len = Math.hypot(dx, dy);
  const end = { x: b.x - (dx / len) * shorten, y: b.y - (dy / len) * shorten };
  return `M ${a.x} ${a.y} L ${end.x} ${end.y}`;
}

/** Arrows draw themselves in (pathLength) and fade out. */
export function Arrows({ arrows, orientation }: { arrows: BoardArrow[]; orientation: Orientation }) {
  return (
    <svg viewBox="0 0 8 8" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
      <defs>
        {(Object.keys(COLORS) as ArrowColor[]).map((c) => (
          <marker key={c} id={`arrowhead-${c}`} markerWidth="3.2" markerHeight="3.2" refX="1.2" refY="1.6" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L3.2,1.6 L0,3.2 z" fill={COLORS[c]} />
          </marker>
        ))}
      </defs>
      <AnimatePresence>
        {arrows.map((a) => {
          const color = a.color ?? "ember";
          return (
            <motion.path
              key={`${a.from}-${a.to}-${color}`}
              d={arrowPath(a.from, a.to, orientation)}
              fill="none"
              stroke={COLORS[color]}
              strokeWidth={0.18}
              strokeLinecap="round"
              strokeLinejoin="round"
              markerEnd={`url(#arrowhead-${color})`}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ pathLength: { duration: 0.45, ease: [0.16, 1, 0.3, 1] }, opacity: { duration: 0.2 } }}
            />
          );
        })}
      </AnimatePresence>
    </svg>
  );
}
