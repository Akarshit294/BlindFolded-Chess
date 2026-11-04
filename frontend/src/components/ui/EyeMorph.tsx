"use client";
import { motion } from "motion/react";

/**
 * The brand mark: an open eye that closes (lids meet, lashes drop) when `closed` is true.
 * Lid paths share the same command structure so Motion can morph between them.
 */
const UPPER_OPEN = "M2.5 12 C 6 5.6, 18 5.6, 21.5 12";
const UPPER_CLOSED = "M2.5 10.8 C 6 15.6, 18 15.6, 21.5 10.8";
const LOWER_OPEN = "M2.5 12 C 6 18.4, 18 18.4, 21.5 12";
const LOWER_CLOSED = "M2.5 10.8 C 6 15.6, 18 15.6, 21.5 10.8";

const LASHES = [
  "M4.2 12.6 L2.8 14.6",
  "M8 14.1 L7 16.6",
  "M12 14.6 L12 17.4",
  "M16 14.1 L17 16.6",
  "M19.8 12.6 L21.2 14.6",
];

export function EyeMorph({ closed, size = 24, className }: { closed: boolean; size?: number; className?: string }) {
  const spring = { type: "spring" as const, stiffness: 260, damping: 24 };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <motion.path initial={false} animate={{ d: closed ? UPPER_CLOSED : UPPER_OPEN }} transition={spring} />
      <motion.path initial={false} animate={{ d: closed ? LOWER_CLOSED : LOWER_OPEN, opacity: closed ? 0 : 1 }} transition={spring} />
      <motion.circle
        cx="12"
        cy="12"
        r="3"
        initial={false}
        animate={{ scale: closed ? 0 : 1, opacity: closed ? 0 : 1 }}
        transition={spring}
        style={{ transformOrigin: "12px 12px" }}
      />
      {LASHES.map((d, i) => (
        <motion.path
          key={d}
          d={d}
          initial={false}
          animate={{ pathLength: closed ? 1 : 0, opacity: closed ? 1 : 0 }}
          transition={{ duration: 0.25, delay: closed ? 0.12 + i * 0.03 : 0 }}
        />
      ))}
    </svg>
  );
}
