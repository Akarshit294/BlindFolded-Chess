"use client";
import { motion } from "motion/react";
import { cn } from "@/lib/utils/cn";

/**
 * Studio mist: soft radial gradients drifting over a hidden board, white in the light theme and smoky in the
 * dark one. Only transform and opacity animate, so it stays on the compositor. `density` 0 hides it.
 */
const BLOBS = [
  { x: "8%", y: "12%", size: "70%", dur: 19, delay: 0 },
  { x: "48%", y: "4%", size: "62%", dur: 23, delay: -6 },
  { x: "22%", y: "46%", size: "80%", dur: 27, delay: -12 },
  { x: "58%", y: "52%", size: "66%", dur: 21, delay: -3 },
  { x: "-6%", y: "70%", size: "58%", dur: 25, delay: -9 },
];

export function Fog({ density, className }: { density: number; className?: string }) {
  return (
    <motion.div
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
      initial={false}
      animate={{ opacity: Math.max(0, Math.min(1, density)) }}
      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
    >
      {BLOBS.map((b, i) => (
        <div
          key={i}
          className="absolute rounded-full animate-float-slow"
          style={{
            left: b.x,
            top: b.y,
            width: b.size,
            height: b.size,
            animationDuration: `${b.dur}s`,
            animationDelay: `${b.delay}s`,
            background: "radial-gradient(closest-side, color-mix(in oklab, var(--studio-hi) 70%, transparent), transparent 100%)",
            willChange: "transform",
          }}
        />
      ))}
    </motion.div>
  );
}
