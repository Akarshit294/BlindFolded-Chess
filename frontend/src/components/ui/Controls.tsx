"use client";
import { motion } from "motion/react";
import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/* ---------------------------------------------------------------- Toggle (switch) */
export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  id?: string;
}) {
  const auto = useId();
  const inputId = id ?? auto;
  return (
    <label htmlFor={inputId} className={cn("flex cursor-pointer items-center justify-between gap-4 py-2", disabled && "opacity-50")}>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ivory-100">{label}</span>
        {description ? <span className="mt-0.5 block text-xs leading-relaxed text-ivory-400">{description}</span> : null}
      </span>
      <span className="relative inline-flex shrink-0">
        <input
          id={inputId}
          type="checkbox"
          role="switch"
          className="peer sr-only"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span
          className={cn(
            "flex h-6 w-11 items-center rounded-full p-0.5 ring-1 ring-inset transition-colors duration-300 peer-focus-visible:ring-2 peer-focus-visible:ring-moon-300",
            checked ? "bg-ember-400/90 ring-ember-300/50" : "bg-night-600 ring-ivory-100/10",
          )}
        >
          <motion.span
            layout
            transition={{ type: "spring", stiffness: 700, damping: 35 }}
            className={cn("h-5 w-5 rounded-full shadow-md", checked ? "ml-auto bg-night-950" : "bg-ivory-200")}
          />
        </span>
      </span>
    </label>
  );
}

/* ---------------------------------------------------------------- Segmented control */
export function Segmented<T extends string | number>({
  value,
  onChange,
  options,
  label,
  size = "md",
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: ReactNode; hint?: string; disabled?: boolean }>;
  label: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const group = useId();
  // Arrow keys move the selection, as in a native radio group.
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const dir = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const enabled = options.filter((o) => !o.disabled);
    const idx = enabled.findIndex((o) => o.value === value);
    const next = enabled[(idx + dir + enabled.length) % enabled.length];
    if (!next) return;
    onChange(next.value);
    const buttons = e.currentTarget.querySelectorAll<HTMLButtonElement>("button[role=radio]:not([disabled])");
    buttons[enabled.indexOf(next)]?.focus();
  };
  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn("relative flex w-full rounded-xl bg-night-850/80 p-1 ring-1 ring-inset ring-ivory-100/[0.07]", className)}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            title={o.hint}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative z-10 flex-1 rounded-lg font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-moon-300 disabled:opacity-40",
              size === "sm" ? "px-2 py-1.5 text-xs" : "px-3 py-2 text-[13px]",
              active ? "text-night-950" : "text-ivory-300 hover:text-ivory-50",
            )}
          >
            {active ? (
              <motion.span
                layoutId={`seg-${group}`}
                className="absolute inset-0 -z-10 rounded-lg bg-gradient-to-b from-ivory-50 to-ivory-200 shadow-[0_4px_14px_-6px_rgba(0,0,0,0.6)]"
                transition={{ type: "spring", stiffness: 520, damping: 38 }}
              />
            ) : null}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- Slider */
export function Slider({
  value,
  onChange,
  min,
  max,
  step = 1,
  label,
  format,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  label: string;
  format?: (v: number) => string;
}) {
  const id = useId();
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="py-2">
      <div className="mb-2 flex items-center justify-between text-sm">
        <label htmlFor={id} className="font-medium text-ivory-100">
          {label}
        </label>
        <span className="tabular font-mono text-xs text-ivory-300">{format ? format(value) : value}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="bf-range w-full"
        style={{ ["--pct" as string]: `${pct}%` }}
      />
    </div>
  );
}

/* ---------------------------------------------------------------- Card */
export function Card({ className, children, as: As = "div" }: { className?: string; children: ReactNode; as?: "div" | "section" | "article" }) {
  return <As className={cn("surface rounded-2xl", className)}>{children}</As>;
}

/* ---------------------------------------------------------------- Badge */
export function Badge({ children, tone = "neutral", className }: { children: ReactNode; tone?: "neutral" | "ember" | "moon" | "jade" | "coral"; className?: string }) {
  const tones = {
    neutral: "bg-ivory-100/[0.06] text-ivory-300 ring-ivory-100/10",
    ember: "bg-ember-400/12 text-ember-200 ring-ember-400/25",
    moon: "bg-moon-400/12 text-moon-200 ring-moon-400/25",
    jade: "bg-jade-400/12 text-jade-300 ring-jade-400/25",
    coral: "bg-coral-400/12 text-coral-300 ring-coral-400/25",
  } as const;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] ring-1 ring-inset", tones[tone], className)}>
      {children}
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex min-w-[1.4rem] items-center justify-center rounded-md border border-ivory-100/15 bg-night-700 px-1.5 py-0.5 font-mono text-[11px] text-ivory-200 shadow-[0_2px_0_rgba(0,0,0,0.4)]">
      {children}
    </kbd>
  );
}

export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ivory-400", className)}>{children}</div>;
}
