"use client";
import type { Square } from "chess.js";
import { AnimatePresence, motion } from "motion/react";
import { squareToGrid, type Orientation } from "@/lib/chess/squares";

/** Ink for plain arrows; green and red only where they mean "best" and "wrong". */
export type ArrowColor = "ink" | "soft" | "good" | "bad";
export type BoardArrow = { from: Square; to: Square; color?: ArrowColor };

const COLORS: Record<ArrowColor, string> = {
  ink: "color-mix(in oklab, var(--ink) 82%, transparent)",
  soft: "color-mix(in oklab, var(--ink) 45%, transparent)",
  good: "color-mix(in oklab, var(--good) 88%, transparent)",
  bad: "color-mix(in oklab, var(--bad) 88%, transparent)",
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
          const color = a.color ?? "ink";
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
