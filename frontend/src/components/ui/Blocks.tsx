"use client";
import { AnimatePresence, motion } from "motion/react";
import { useId, useState, type ReactNode } from "react";
import { IconChevronDown } from "@/components/ui/Icons";
import { cn } from "@/lib/utils/cn";

/** A number that matters, with its label and a quiet subline. */
export function StatTile({
  label,
  value,
  sub,
  className,
  testId,
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  className?: string;
  testId?: string;
}) {
  return (
    <div className={cn("glass-panel flex flex-col justify-between rounded-panel p-4 sm:p-5", className)} data-testid={testId}>
      <div className="text-small text-muted">{label}</div>
      <div className="mt-3 font-display text-[2.125rem] font-bold leading-none tracking-[0.005em] text-ink tabular">{value}</div>
      {sub ? <div className="mt-2 text-caption text-muted">{sub}</div> : null}
    </div>
  );
}

/** Nothing to show yet: say why, and offer the next step. */
export function EmptyState({
  title,
  text,
  actions,
  visual,
  className,
}: {
  title: ReactNode;
  text?: ReactNode;
  actions?: ReactNode;
  visual?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-panel px-6 py-10 text-center", className)}>
      {visual ? <div className="mb-5">{visual}</div> : null}
      <h2 className="display text-display-md">{title}</h2>
      {text ? <p className="mx-auto mt-3 max-w-md text-[0.9375rem] text-fg">{text}</p> : null}
      {actions ? <div className="mt-6 flex flex-wrap justify-center gap-3">{actions}</div> : null}
    </div>
  );
}

/** Progressive disclosure: a quiet row that expands its content. */
export function Disclosure({
  summary,
  children,
  defaultOpen = false,
  open: controlled,
  onOpenChange,
  className,
  testId,
}: {
  summary: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  testId?: string;
}) {
  const [own, setOwn] = useState(defaultOpen);
  const open = controlled ?? own;
  const id = useId();
  const toggle = () => {
    setOwn(!open);
    onOpenChange?.(!open);
  };
  return (
    <div className={className}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={toggle}
        data-testid={testId}
        className="group flex w-full cursor-pointer items-center justify-between gap-3 rounded-control py-2 text-left text-small font-semibold text-ink outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]"
      >
        {summary}
        <IconChevronDown size={16} className={cn("text-muted transition-transform duration-300", open && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            id={id}
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0, transition: { duration: 0.18 } }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="pt-2">{children}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/** Thin progress line (determinate). */
export function ProgressLine({ value, label, className, tone = "ink" }: { value: number; label: string; className?: string; tone?: "ink" | "bad" }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div
      className={cn("relative h-1 overflow-hidden rounded-full bg-ink/10", className)}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v * 100)}
    >
      <motion.div
        className={cn("absolute inset-0 origin-left rounded-full", tone === "bad" ? "bg-bad" : "bg-ink")}
        initial={false}
        animate={{ scaleX: v }}
        transition={{ type: "spring", stiffness: 200, damping: 30 }}
      />
    </div>
  );
}
