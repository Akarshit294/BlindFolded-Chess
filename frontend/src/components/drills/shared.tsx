"use client";
import { motion } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { buttonClass } from "@/components/ui/Button";
import { Kbd } from "@/components/ui/Controls";
import { cn } from "@/lib/utils/cn";
import { focusOnDesktop } from "@/lib/utils/hooks";

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
              "relative flex min-h-16 cursor-pointer items-center justify-center gap-3 rounded-panel px-4 py-4 text-lg font-semibold outline-none transition-[background,box-shadow,color,opacity] duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] disabled:cursor-default",
              isCorrect ? "bg-good text-white shadow-raised" : isWrongPick ? "bg-bad text-white shadow-raised" : "pill-secondary text-ink",
              locked && !isCorrect && !isWrongPick && "opacity-45",
              c.className,
            )}
          >
            {c.label}
            <span className="absolute right-3 top-3 hidden opacity-80 sm:block">
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
    if (autoFocus && !locked) focusOnDesktop(ref.current);
  }, [autoFocus, locked]);
  const append = (ch: string) => {
    setText((t) => {
      if (!multi) return /^[a-h]$/.test(ch) ? ch : t.length === 1 ? t + ch : t;
      const needsSpace = /^[a-h]$/.test(ch) && t.length > 0 && !t.endsWith(" ");
      return `${t}${needsSpace ? " " : ""}${ch}`;
    });
    focusOnDesktop(ref.current);
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
          className="glass-well h-12 min-w-0 flex-1 rounded-full px-5 text-lg font-semibold tabular text-ink outline-none placeholder:text-[0.9375rem] placeholder:font-normal placeholder:text-muted focus:shadow-[inset_0_0_0_1.5px_var(--ink)] disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={locked || !text.trim()}
          className={buttonClass("primary", "md", "h-12 px-6")}
          data-testid="drill-submit"
        >
          Check
        </button>
      </form>
      <div className="grid grid-cols-8 gap-1.5 sm:hidden" role="group" aria-label="Keypad">
        {"abcdefgh".split("").map((f) => (
          <button key={f} type="button" disabled={locked} onClick={() => append(f)} className="pill-secondary h-11 rounded-control text-base font-semibold active:scale-95">
            {f}
          </button>
        ))}
        {"12345678".split("").map((r) => (
          <button key={r} type="button" disabled={locked} onClick={() => append(r)} className="pill-secondary h-11 rounded-control text-base font-semibold tabular active:scale-95">
            {r}
          </button>
        ))}
        {multi ? (
          <button type="button" disabled={locked} onClick={() => setText((t) => t.trim().split(/\s+/).slice(0, -1).join(" "))} className="glass-well col-span-4 h-11 rounded-control text-small font-semibold text-ink">
            Delete square
          </button>
        ) : (
          <button type="button" disabled={locked} onClick={() => setText("")} className="glass-well col-span-4 h-11 rounded-control text-small font-semibold text-ink">
            Clear
          </button>
        )}
        <button type="button" disabled={locked} onClick={submit} className="pill-primary col-span-4 h-11 rounded-control text-small font-semibold">
          Check
        </button>
      </div>
    </div>
  );
}

export function Prompt({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="text-[1.75rem] font-semibold leading-tight text-ink sm:text-[2.125rem]" data-testid="drill-prompt">
        {children}
      </h2>
      {sub ? <p className="mt-2 text-body text-muted">{sub}</p> : null}
    </div>
  );
}

export function Sq({ children }: { children: ReactNode }) {
  return <span className="inline-block rounded-full bg-ink px-3 font-display font-bold uppercase tracking-[0.02em] text-on-ink">{children}</span>;
}
