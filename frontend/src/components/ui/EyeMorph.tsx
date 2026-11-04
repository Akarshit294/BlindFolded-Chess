"use client";
import { motion } from "motion/react";

/**
 * The brand mark: an eye that closes and gets a blindfold when `closed` is true.
 * Lid paths share the same command structure so Motion can morph between them.
 */
const UPPER_OPEN = "M2.5 12 C 6 5.6, 18 5.6, 21.5 12";
const UPPER_CLOSED = "M2.5 12 C 6 15.2, 18 15.2, 21.5 12";
const LOWER_OPEN = "M2.5 12 C 6 18.4, 18 18.4, 21.5 12";
const LOWER_CLOSED = "M2.5 12 C 6 15.2, 18 15.2, 21.5 12";

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
      <motion.path initial={false} animate={{ d: closed ? LOWER_CLOSED : LOWER_OPEN }} transition={spring} />
      <motion.circle
        cx="12"
        cy="12"
        r="3"
        initial={false}
        animate={{ scale: closed ? 0 : 1, opacity: closed ? 0 : 1 }}
        transition={spring}
        style={{ transformOrigin: "12px 12px" }}
      />
      {/* Lashes appear when closed. */}
      {[7.5, 12, 16.5].map((x, i) => (
        <motion.path
          key={x}
          d={`M${x} 15.4 L${x + (i - 1) * 0.9} 17.6`}
          initial={false}
          animate={{ pathLength: closed ? 1 : 0, opacity: closed ? 1 : 0 }}
          transition={{ duration: 0.3, delay: closed ? 0.15 + i * 0.04 : 0 }}
        />
      ))}
      {/* The blindfold band. */}
      <motion.path
        d="M1.5 9.2 L22.5 9.2"
        stroke="var(--color-ember-400)"
        strokeWidth={3.2}
        initial={false}
        animate={{ pathLength: closed ? 1 : 0, opacity: closed ? 1 : 0 }}
        transition={{ duration: 0.4, delay: closed ? 0.1 : 0, ease: [0.16, 1, 0.3, 1] }}
      />
    </svg>
  );
}
