"use client";
import { motion, type HTMLMotionProps } from "motion/react";
import Link from "next/link";
import { forwardRef, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "moon";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-gradient-to-b from-ember-300 to-ember-500 text-night-950 shadow-[0_10px_30px_-10px_rgba(245,176,78,0.65),inset_0_1px_0_rgba(255,255,255,0.45)] hover:from-ember-200 hover:to-ember-400",
  secondary:
    "bg-night-700/80 text-ivory-100 ring-1 ring-inset ring-ivory-100/10 hover:bg-night-600/80 hover:ring-ivory-100/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
  ghost: "bg-transparent text-ivory-300 hover:bg-ivory-100/[0.06] hover:text-ivory-50",
  danger: "bg-coral-500/15 text-coral-300 ring-1 ring-inset ring-coral-400/30 hover:bg-coral-500/25",
  moon: "bg-moon-500/15 text-moon-200 ring-1 ring-inset ring-moon-400/30 hover:bg-moon-500/25",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 gap-1.5 rounded-lg px-3 text-[13px]",
  md: "h-10 gap-2 rounded-xl px-4 text-sm",
  lg: "h-12 gap-2.5 rounded-2xl px-6 text-[15px]",
};

const BASE =
  "relative inline-flex select-none items-center justify-center font-medium tracking-[-0.005em] transition-colors duration-200 disabled:pointer-events-none disabled:opacity-45 outline-none focus-visible:ring-2 focus-visible:ring-moon-300 focus-visible:ring-offset-2 focus-visible:ring-offset-night-950";

type ButtonProps = Omit<HTMLMotionProps<"button">, "children"> & {
  variant?: Variant;
  size?: Size;
  children?: ReactNode;
  icon?: ReactNode;
};

/** Buttons press down slightly and lift on hover — springy, transform-only micro-interactions. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", className, children, icon, type = "button", ...rest },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      type={type}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.96, y: 0 }}
      transition={{ type: "spring", stiffness: 600, damping: 30 }}
      className={cn(BASE, VARIANTS[variant], SIZES[size], className)}
      {...rest}
    >
      {icon}
      {children}
    </motion.button>
  );
});

type LinkButtonProps = {
  href: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
  icon?: ReactNode;
  transitionTypes?: string[];
};

const MotionLink = motion.create(Link);

export function LinkButton({ href, variant = "secondary", size = "md", className, children, icon }: LinkButtonProps) {
  return (
    <MotionLink
      href={href}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.96, y: 0 }}
      transition={{ type: "spring", stiffness: 600, damping: 30 }}
      className={cn(BASE, VARIANTS[variant], SIZES[size], className)}
    >
      {icon}
      {children}
    </MotionLink>
  );
}

export function IconButton({
  label,
  className,
  children,
  active,
  ...rest
}: Omit<HTMLMotionProps<"button">, "children"> & { label: string; children: ReactNode; active?: boolean }) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      title={label}
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.9 }}
      transition={{ type: "spring", stiffness: 600, damping: 28 }}
      className={cn(
        "inline-flex h-10 w-10 items-center justify-center rounded-xl text-ivory-300 outline-none transition-colors hover:bg-ivory-100/[0.07] hover:text-ivory-50 focus-visible:ring-2 focus-visible:ring-moon-300 disabled:pointer-events-none disabled:opacity-40",
        active && "bg-moon-500/15 text-moon-200",
        className,
      )}
      {...rest}
    >
      {children}
    </motion.button>
  );
}
