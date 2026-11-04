"use client";
import { animate, useInView, useMotionValue, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

/** Counts up to `value` when scrolled into view. Renders the final value for SSR/no-JS. */
export function AnimatedNumber({
  value,
  decimals = 0,
  duration = 1.1,
  prefix = "",
  suffix = "",
  className,
}: {
  value: number;
  decimals?: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduced = useReducedMotion();
  const mv = useMotionValue(0);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (reduced) {
      mv.jump(value);
      setDisplay(value);
      return;
    }
    // Animates from wherever the number currently is (0 the first time).
    const controls = animate(mv, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplay(v),
    });
    return () => controls.stop();
  }, [inView, value, duration, mv, reduced]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {display.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </span>
  );
}
