"use client";
import { motion } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Kbd } from "@/components/ui/Controls";
import { cn } from "@/lib/utils/cn";

export type Choice<T> = { value: T; label: ReactNode; key: string; hint?: string; className?: string };

/** Big answer buttons with keyboard shortcuts; shows right/wrong once locked. */
export function ChoiceButtons<T>({
  choices,
  onPick,
  locked,
  correct,
  picked,
  columns = 2,
}: {
  choices: Array<Choice<T>>;
  onPick: (v: T) => void;
  locked: boolean;
  correct?: T;
  picked?: T | null;
  columns?: number;
}) {
  useEffect(() => {
    if (locked) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.tagName === "INPUT") return;
      const c = choices.find((x) => x.key.toLowerCase() === e.key.toLowerCase());
      if (c) {
        e.preventDefault();
        onPick(c.value);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [choices, onPick, locked]);

  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {choices.map((c) => {
        const isCorrect = locked && correct !== undefined && c.value === correct;
        const isWrongPick = locked && picked !== undefined && picked !== null && c.value === picked && c.value !== correct;
        return (
          <motion.button
            key={String(c.value)}
            type="button"
            disabled={locked}
            onClick={() => onPick(c.value)}
            whileHover={locked ? undefined : { y: -2 }}
            whileTap={locked ? undefined : { scale: 0.96 }}
            animate={isWrongPick ? { x: [0, -6, 5, -3, 0] } : isCorrect ? { scale: [1, 1.04, 1] } : {}}
            transition={{ duration: 0.35 }}
            data-testid={`choice-${String(c.value)}`}
            className={cn(
              "relative flex min-h-16 items-center justify-center gap-3 rounded-2xl px-4 py-4 text-lg font-semibold outline-none ring-1 ring-inset transition-colors focus-visible:ring-2 focus-visible:ring-moon-300",
              isCorrect ? "bg-jade-400/20 text-jade-100 ring-jade-400/60" : isWrongPick ? "bg-coral-400/20 text-coral-100 ring-coral-400/60" : "bg-night-800/80 text-ivory-50 ring-ivory-100/10 hover:bg-night-700",
              locked && !isCorrect && !isWrongPick && "opacity-50",
              c.className,
            )}
          >
            {c.label}
            <span className="absolute right-3 top-3 hidden sm:block">
              <Kbd>{c.key.toUpperCase()}</Kbd>
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}

/** Text entry for squares with an optional tap keypad (handy on phones). */
export function SquareEntry({
  onSubmit,
  locked,
  placeholder = "e.g. e4",
  multi = false,
  autoFocus = true,
}: {
  onSubmit: (text: string) => void;
  locked: boolean;
  placeholder?: string;
  multi?: boolean;
  autoFocus?: boolean;
}) {
  const [text, setText] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (autoFocus && !locked) ref.current?.focus();
  }, [autoFocus, locked]);
  const append = (ch: string) => {
    setText((t) => {
      if (!multi) return /^[a-h]$/.test(ch) ? ch : t.length === 1 ? t + ch : t;
      const needsSpace = /^[a-h]$/.test(ch) && t.length > 0 && !t.endsWith(" ");
      return `${t}${needsSpace ? " " : ""}${ch}`;
    });
    ref.current?.focus();
  };
  const submit = () => {
    if (locked || !text.trim()) return;
    onSubmit(text.trim());
  };
  return (
    <div className="space-y-3">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          ref={ref}
          value={text}
          disabled={locked}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          aria-label="Your answer"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          data-testid="drill-input"
          className="h-12 min-w-0 flex-1 rounded-2xl bg-night-850/90 px-4 font-mono text-lg text-ivory-50 outline-none ring-1 ring-inset ring-ivory-100/10 placeholder:font-sans placeholder:text-sm placeholder:text-ivory-500 focus:ring-moon-400/50 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={locked || !text.trim()}
          className="h-12 rounded-2xl bg-gradient-to-b from-ember-300 to-ember-500 px-5 font-semibold text-night-950 outline-none focus-visible:ring-2 focus-visible:ring-moon-300 disabled:opacity-40"
          data-testid="drill-submit"
        >
          Check
        </button>
      </form>
      <div className="grid grid-cols-8 gap-1.5 sm:hidden" aria-label="Keypad">
        {"abcdefgh".split("").map((f) => (
          <button key={f} type="button" disabled={locked} onClick={() => append(f)} className="h-10 rounded-lg bg-night-750 font-mono text-ivory-100 active:bg-night-600">
            {f}
          </button>
        ))}
        {"12345678".split("").map((r) => (
          <button key={r} type="button" disabled={locked} onClick={() => append(r)} className="h-10 rounded-lg bg-night-750 font-mono text-ivory-100 active:bg-night-600">
            {r}
          </button>
        ))}
        {multi ? (
          <button type="button" disabled={locked} onClick={() => setText((t) => t.trim().split(/\s+/).slice(0, -1).join(" "))} className="col-span-4 h-10 rounded-lg bg-night-750 text-sm text-ivory-300">
            ⌫ square
          </button>
        ) : (
          <button type="button" disabled={locked} onClick={() => setText("")} className="col-span-4 h-10 rounded-lg bg-night-750 text-sm text-ivory-300">
            Clear
          </button>
        )}
        <button type="button" disabled={locked} onClick={submit} className="col-span-4 h-10 rounded-lg bg-ember-400 text-sm font-semibold text-night-950">
          Check
        </button>
      </div>
    </div>
  );
}

export function Prompt({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="font-display text-3xl font-semibold leading-tight text-ivory-50 sm:text-4xl" data-testid="drill-prompt">
        {children}
      </h2>
      {sub ? <p className="mt-2 text-ivory-400">{sub}</p> : null}
    </div>
  );
}

export function Sq({ children }: { children: ReactNode }) {
  return <span className="rounded-lg bg-ember-400/15 px-2 font-mono text-ember-200">{children}</span>;
}
