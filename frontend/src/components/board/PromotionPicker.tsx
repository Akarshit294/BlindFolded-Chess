"use client";
import type { Color, PieceSymbol, Square } from "chess.js";
import { motion } from "motion/react";
import { useEffect, useRef } from "react";
import { PIECE_NAMES } from "@/lib/chess/notation";
import { squareToGrid, type Orientation } from "@/lib/chess/squares";
import { PieceGlyph } from "./PieceGlyph";

const CHOICES: PieceSymbol[] = ["q", "n", "r", "b"];

type Props = {
  square: Square;
  color: Color;
  orientation: Orientation;
  set: string;
  onPick: (p: PieceSymbol) => void;
  onCancel: () => void;
};

/** The four promotion choices fan out from the promotion square on a frosted column. */
export function PromotionPicker({ square, color, orientation, set, onPick, onCancel }: Props) {
  const { col, row } = squareToGrid(square, orientation);
  const downward = row === 0;
  const first = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
      const map: Record<string, PieceSymbol> = { q: "q", n: "n", r: "r", b: "b" };
      const p = map[e.key.toLowerCase()];
      if (p) onPick(p);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel, onPick]);

  return (
    <div className="absolute inset-0 z-40" onPointerDown={(e) => e.target === e.currentTarget && onCancel()}>
      <motion.div
        className="absolute inset-0 bg-night-950/55"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        onPointerDown={onCancel}
      />
      <div
        role="dialog"
        aria-label="Choose a promotion piece"
        className="absolute flex"
        style={{
          left: `${col * 12.5}%`,
          top: downward ? `${row * 12.5}%` : `${(row - 3) * 12.5}%`,
          width: "12.5%",
          height: "50%",
          flexDirection: downward ? "column" : "column-reverse",
        }}
      >
        {CHOICES.map((p, i) => (
          <motion.button
            key={p}
            ref={i === 0 ? first : undefined}
            type="button"
            aria-label={`Promote to ${PIECE_NAMES[p]}`}
            onClick={() => onPick(p)}
            className="group relative h-1/4 w-full rounded-full bg-ivory-50/90 shadow-[0_8px_24px_-6px_rgba(0,0,0,0.6)] ring-1 ring-night-900/20 outline-none focus-visible:ring-4 focus-visible:ring-moon-400"
            initial={{ opacity: 0, scale: 0.4, y: downward ? -20 * i : 20 * i }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.92 }}
            transition={{ type: "spring", stiffness: 520, damping: 30, delay: i * 0.04 }}
          >
            <PieceGlyph set={set} color={color} type={p} className="h-full w-full p-[6%] transition-transform group-hover:-translate-y-0.5" />
          </motion.button>
        ))}
      </div>
    </div>
  );
}
