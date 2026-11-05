"use client";
import type { Color, PieceSymbol } from "chess.js";
import { motion } from "motion/react";
import type { PieceSetId } from "@/lib/settings/store";
import { PieceImage } from "./PieceImage";

/** Fragments as clip-path polygons (percentages of the piece box). */
const SHARDS: Array<{ poly: string; dx: number; dy: number; rot: number }> = [
  { poly: "0% 0%, 55% 0%, 40% 38%, 0% 30%", dx: -38, dy: -46, rot: -40 },
  { poly: "55% 0%, 100% 0%, 100% 34%, 40% 38%", dx: 42, dy: -40, rot: 35 },
  { poly: "0% 30%, 40% 38%, 30% 70%, 0% 64%", dx: -52, dy: 6, rot: -70 },
  { poly: "40% 38%, 100% 34%, 100% 66%, 62% 60%", dx: 50, dy: 4, rot: 60 },
  { poly: "30% 70%, 40% 38%, 62% 60%, 52% 100%, 22% 100%", dx: -10, dy: 44, rot: 25 },
  { poly: "0% 64%, 30% 70%, 22% 100%, 0% 100%", dx: -40, dy: 40, rot: -30 },
  { poly: "62% 60%, 100% 66%, 100% 100%, 52% 100%", dx: 36, dy: 42, rot: 45 },
];

type Props = {
  set: PieceSetId;
  color: Color;
  type: PieceSymbol;
  delay?: number;
  onDone?: () => void;
};

/** A captured piece breaks into shards that fly apart and fade (transform + opacity only). */
export function Shatter({ set, color, type, delay = 0, onDone }: Props) {
  return (
    <div className="pointer-events-none absolute inset-0">
      {SHARDS.map((s, i) => (
        <motion.div
          key={i}
          className="absolute inset-0"
          style={{ clipPath: `polygon(${s.poly})`, willChange: "transform, opacity" }}
          initial={{ x: 0, y: 0, rotate: 0, opacity: 1, scale: 1 }}
          animate={{ x: `${s.dx}%`, y: `${s.dy}%`, rotate: s.rot, opacity: 0, scale: 0.7 }}
          transition={{ duration: 0.62, delay, ease: [0.2, 0.7, 0.3, 1] }}
          onAnimationComplete={i === 0 ? onDone : undefined}
        >
          <PieceImage set={set} color={color} type={type} className="h-full w-full" />
        </motion.div>
      ))}
      <motion.div
        className="absolute inset-[18%] rounded-full"
        style={{ background: "radial-gradient(closest-side, rgb(255 255 255 / 0.9), rgb(255 255 255 / 0))" }}
        initial={{ opacity: 0, scale: 0.4 }}
        animate={{ opacity: [0, 0.9, 0], scale: [0.4, 1.3, 1.6] }}
        transition={{ duration: 0.55, delay, times: [0, 0.25, 1] }}
      />
    </div>
  );
}
