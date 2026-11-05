"use client";
import { motion } from "motion/react";
import { cn } from "@/lib/utils/cn";

/**
 * Drifting fog made of soft radial gradients. Only transform and opacity animate, so it stays
 * on the compositor. `density` 0 hides it completely.
 */
const BLOBS = [
  { x: "8%", y: "12%", size: "70%", hue: "moon", dur: 19, delay: 0 },
  { x: "48%", y: "4%", size: "62%", hue: "ivory", dur: 23, delay: -6 },
  { x: "22%", y: "46%", size: "80%", hue: "moon", dur: 27, delay: -12 },
  { x: "58%", y: "52%", size: "66%", hue: "ivory", dur: 21, delay: -3 },
  { x: "-6%", y: "70%", size: "58%", hue: "ivory", dur: 25, delay: -9 },
];

export function Fog({ density, className, tone = "night" }: { density: number; className?: string; tone?: "night" | "light" }) {
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
            background:
              b.hue === "moon"
                ? `radial-gradient(closest-side, ${tone === "night" ? "rgba(178,186,240,0.55)" : "rgba(220,226,255,0.7)"}, rgba(178,186,240,0) 100%)`
                : `radial-gradient(closest-side, ${tone === "night" ? "rgba(236,232,222,0.42)" : "rgba(255,255,255,0.75)"}, rgba(236,232,222,0) 100%)`,
            willChange: "transform",
          }}
        />
      ))}
    </motion.div>
  );
}
