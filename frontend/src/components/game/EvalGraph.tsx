"use client";
import { motion } from "motion/react";
import type { Classification } from "@/lib/analysis/accuracy";

type Props = {
  /** White win% per position, index 0 = start. */
  curve: number[];
  classes?: Classification[];
  activePly: number;
  onSelect?: (ply: number) => void;
};

const W = 600;
const H = 120;

/** Area chart of White's winning chances; mistakes and blunders are marked. */
export function EvalGraph({ curve, classes, activePly, onSelect }: Props) {
  if (curve.length < 2) return null;
  const n = curve.length - 1;
  const x = (i: number) => (i / Math.max(1, n)) * W;
  const y = (w: number) => H - (w / 100) * H;
  const line = curve.map((w, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(w).toFixed(1)}`).join(" ");
  const area = `${line} L ${W} ${H} L 0 ${H} Z`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="h-24 w-full cursor-pointer overflow-visible rounded-xl bg-night-900 ring-1 ring-inset ring-ivory-100/[0.06]"
      role="img"
      aria-label="Evaluation graph"
      onClick={(e) => {
        if (!onSelect) return;
        const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
        const ply = Math.round(((e.clientX - r.left) / r.width) * n);
        onSelect(Math.max(0, Math.min(n, ply)));
      }}
    >
      <defs>
        <linearGradient id="eval-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f2ede3" stopOpacity="0.85" />
          <stop offset="1" stopColor="#c7c0b1" stopOpacity="0.55" />
        </linearGradient>
      </defs>
      <line x1="0" y1={H / 2} x2={W} y2={H / 2} stroke="rgba(245,176,78,0.35)" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
      <motion.path
        d={area}
        fill="url(#eval-fill)"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
      />
      <motion.path
        d={line}
        fill="none"
        stroke="#fbf8f2"
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
            r={c === "blunder" ? 4.5 : 3.5}
            fill={c === "blunder" ? "#ff7d6b" : c === "mistake" ? "#e8932b" : "#fbca78"}
            stroke="#090b11"
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
        stroke="#9ca7f0"
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
        initial={false}
        animate={{ x1: x(activePly), x2: x(activePly) }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      />
    </svg>
  );
}
