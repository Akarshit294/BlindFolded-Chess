"use client";
import { motion } from "motion/react";
import { CLASSIFICATION_META, type Classification } from "@/lib/analysis/accuracy";

type Props = {
  /** White win% per position, index 0 = start. */
  curve: number[];
  classes?: Classification[];
  activePly: number;
  onSelect?: (ply: number) => void;
};

const W = 600;
const H = 120;

/**
 * White's winning chances over the game, drawn like the eval bar: White's share is the light area, Black's the
 * dark field above it. Only inaccuracies, mistakes and blunders get a colored mark.
 */
export function EvalGraph({ curve, classes, activePly, onSelect }: Props) {
  if (curve.length < 2) return null;
  const n = curve.length - 1;
  const x = (i: number) => (i / Math.max(1, n)) * W;
  const y = (w: number) => H - (w / 100) * H;
  const line = curve.map((w, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(w).toFixed(1)}`).join(" ");
  const area = `${line} L ${W} ${H} L 0 ${H} Z`;
  const errors = classes?.filter((c) => c === "inaccuracy" || c === "mistake" || c === "blunder").length ?? 0;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="h-24 w-full cursor-pointer overflow-hidden rounded-control shadow-[inset_0_0_0_1px_var(--line-strong)]"
      role="img"
      aria-label={`Evaluation graph over ${n} moves${classes ? `, ${errors} marked errors` : ""}. Click to jump to a move.`}
      onClick={(e) => {
        if (!onSelect) return;
        const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
        const ply = Math.round(((e.clientX - r.left) / r.width) * n);
        onSelect(Math.max(0, Math.min(n, ply)));
      }}
    >
      <rect width={W} height={H} fill="#1b1b1b" />
      <motion.path d={area} fill="#f2f2f2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }} />
      <line x1="0" y1={H / 2} x2={W} y2={H / 2} stroke="#8a8a8a" strokeOpacity="0.6" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
      <motion.path
        d={line}
        fill="none"
        stroke="#8a8a8a"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
      />
      {classes?.map((c, i) =>
        c === "mistake" || c === "blunder" || c === "inaccuracy" ? (
          <circle
            key={i}
            cx={x(i + 1)}
            cy={y(curve[i + 1] ?? 50)}
            r={c === "blunder" ? 5 : 4}
            fill={CLASSIFICATION_META[c].color}
            stroke="#ffffff"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
        ) : null,
      )}
      <motion.line
        x1={x(activePly)}
        x2={x(activePly)}
        y1={0}
        y2={H}
        stroke="#9a9a9a"
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
        initial={false}
        animate={{ x1: x(activePly), x2: x(activePly) }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      />
    </svg>
  );
}
