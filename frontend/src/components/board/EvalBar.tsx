"use client";
import { motion, useSpring, useTransform } from "motion/react";
import { useEffect } from "react";
import { cn } from "@/lib/utils/cn";

type Props = {
  /** White's win probability 0..100. */
  win: number;
  label: string;
  orientation?: "white" | "black";
  className?: string;
};

/** Vertical evaluation bar. The white share animates with a spring via scaleY (transform only). */
export function EvalBar({ win, label, orientation = "white", className }: Props) {
  const spring = useSpring(win / 100, { stiffness: 120, damping: 22 });
  useEffect(() => {
    spring.set(Math.max(0.02, Math.min(0.98, win / 100)));
  }, [win, spring]);
  const scaleY = useTransform(spring, (v) => v);
  const whiteOnBottom = orientation === "white";

  return (
    <div
      className={cn("relative w-3.5 overflow-hidden rounded-full bg-[#141414] shadow-[inset_0_0_0_1px_var(--line-strong)] sm:w-4", className)}
      role="meter"
      aria-label="Evaluation"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(win)}
      aria-valuetext={label}
    >
      <motion.div
        className="absolute inset-0 bg-[linear-gradient(to_top,#e9e9e9,#ffffff)]"
        style={{ scaleY, transformOrigin: whiteOnBottom ? "bottom" : "top" }}
      />
      <div className="absolute inset-x-0 top-1/2 h-px bg-[#888]" />
      <span
        className={cn(
          "absolute left-1/2 -translate-x-1/2 text-[10px] font-semibold tabular tracking-tight [writing-mode:vertical-rl]",
          win >= 50 === whiteOnBottom ? "bottom-1 text-[#1a1a1a]" : "top-1 text-[#f2f2f2]",
        )}
      >
        {label}
      </span>
    </div>
  );
}
