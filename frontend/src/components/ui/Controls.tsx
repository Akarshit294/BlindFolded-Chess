"use client";
import { motion } from "motion/react";
import { useId, type HTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import { IconChevronDown } from "@/components/ui/Icons";
import { cn } from "@/lib/utils/cn";

/* ---------------------------------------------------------------- Panel (glass on the stage) */
export function Panel({
  className,
  children,
  as: As = "div",
  ...rest
}: HTMLAttributes<HTMLElement> & { as?: "div" | "section" | "article" | "aside"; "data-testid"?: string }) {
  return (
    <As className={cn("glass-panel rounded-panel", className)} {...rest}>
      {children}
    </As>
  );
}

/** Recessed area: lists, fields, segmented tracks. */
export function Well({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("glass-well rounded-control", className)}>{children}</div>;
}

/* ---------------------------------------------------------------- Labels */
/** Small sentence-case label above a control. */
export function FieldLabel({ children, className, htmlFor, id }: { children: ReactNode; className?: string; htmlFor?: string; id?: string }) {
  const Tag = htmlFor ? "label" : "div";
  return (
    <Tag htmlFor={htmlFor} id={id} className={cn("mb-2 block text-small font-semibold text-ink", className)}>
      {children}
    </Tag>
  );
}

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
    <label htmlFor={inputId} className={cn("flex cursor-pointer items-center justify-between gap-5 py-2.5", disabled && "cursor-not-allowed opacity-50")}>
      <span className="min-w-0">
        <span className="block text-[0.9375rem] font-semibold text-ink">{label}</span>
        {description ? <span className="mt-0.5 block text-small text-muted">{description}</span> : null}
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
          aria-hidden="true"
          className={cn(
            "flex h-7 w-12 items-center rounded-full p-[3px] transition-colors duration-300 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--focus)]",
            checked ? "bg-ink" : "glass-well",
          )}
        >
          <motion.span
            layout
            transition={{ type: "spring", stiffness: 700, damping: 38 }}
            className={cn("h-[22px] w-[22px] rounded-full shadow-raised", checked ? "ml-auto bg-on-ink" : "bg-surface")}
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
  labelledBy,
  size = "md",
  className,
  testIdPrefix,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: ReactNode; hint?: string; disabled?: boolean; ariaLabel?: string }>;
  label?: string;
  labelledBy?: string;
  size?: "sm" | "md";
  className?: string;
  testIdPrefix?: string;
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
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      onKeyDown={onKeyDown}
      className={cn("glass-well relative flex w-full rounded-full p-1", className)}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={o.ariaLabel}
            tabIndex={active ? 0 : -1}
            title={o.hint}
            disabled={o.disabled}
            data-testid={testIdPrefix ? `${testIdPrefix}-${String(o.value)}` : undefined}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative z-10 flex flex-1 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-full font-semibold outline-none transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--focus)] disabled:cursor-not-allowed disabled:opacity-40",
              size === "sm" ? "min-h-9 px-2.5 text-[0.8125rem]" : "min-h-10 px-3 text-small",
              active ? "text-ink" : "text-muted hover:text-ink",
            )}
          >
            {active ? (
              <motion.span
                layoutId={`seg-${group}`}
                className="pill-secondary absolute inset-0 -z-10 rounded-full"
                transition={{ type: "spring", stiffness: 560, damping: 40 }}
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
    <div className="py-2.5">
      <div className="mb-3 flex items-center justify-between gap-4">
        <label htmlFor={id} className="text-[0.9375rem] font-semibold text-ink">
          {label}
        </label>
        <span className="tabular text-small text-muted">{format ? format(value) : value}</span>
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

/* ---------------------------------------------------------------- Select (native, styled) */
export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className={cn("relative block", className)}>
      <select
        {...rest}
        className="h-11 w-full cursor-pointer appearance-none rounded-full bg-surface pl-4 pr-10 text-small text-ink shadow-raised outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]"
      >
        {children}
      </select>
      <IconChevronDown size={16} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted" />
    </span>
  );
}

/* ---------------------------------------------------------------- Badge */
export type BadgeTone = "neutral" | "ink" | "good" | "bad" | "warn";
export function Badge({ children, tone = "neutral", className }: { children: ReactNode; tone?: BadgeTone; className?: string }) {
  const tones: Record<BadgeTone, string> = {
    neutral: "glass-well text-ink",
    ink: "bg-ink text-on-ink",
    good: "bg-good/12 text-good",
    bad: "bg-bad/12 text-bad",
    warn: "bg-warn/14 text-warn",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-[3px] text-caption font-semibold", tones[tone], className)}>
      {children}
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-surface px-1.5 font-sans text-caption font-semibold text-ink shadow-[inset_0_-1px_0_var(--line-strong),0_1px_2px_rgb(0_0_0/0.08)] ring-1 ring-inset ring-line">
      {children}
    </kbd>
  );
}
