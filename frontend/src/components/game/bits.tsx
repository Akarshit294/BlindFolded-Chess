"use client";
import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { PieceImage } from "@/components/board/PieceImage";
import { cn } from "@/lib/utils/cn";
import { Clock } from "./Clock";

export function ThinkingDots({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex gap-1", className)} aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-current"
          animate={{ opacity: [0.25, 1, 0.25], y: [0, -2, 0] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </span>
  );
}

/** One side of the game: a glossy king for the color, the name, a quiet detail line and the clock. */
export function PlayerBar({
  name,
  detail,
  color,
  time,
  active,
  thinking,
  clockId,
}: {
  name: string;
  detail: ReactNode;
  color: "w" | "b";
  time: number | null;
  active: boolean;
  thinking?: boolean;
  clockId: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-0.5">
      <div className="flex min-w-0 items-center gap-3">
        <span className={cn("relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-shadow duration-300", active ? "pill-secondary" : "glass-well")}>
          <PieceImage color={color} type="k" className="h-9 w-9" />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2 font-semibold leading-tight text-ink">
            <span className="truncate">{name}</span>
            {thinking ? <ThinkingDots className="text-muted" /> : null}
          </div>
          <div className="truncate text-caption text-muted">{detail}</div>
        </div>
      </div>
      {time !== null ? <Clock ms={time} active={active} label={name} testId={clockId} /> : null}
    </div>
  );
}

export function StatusLine({ over, myTurn, thinking, inCheck, engineName }: { over: boolean; myTurn: boolean; thinking: boolean; inCheck: boolean; engineName: string }) {
  let content: ReactNode;
  let key: string;
  if (over) {
    key = "over";
    content = <span className="text-muted">Game over</span>;
  } else if (thinking) {
    key = "thinking";
    content = (
      <span className="flex items-center gap-2 text-muted">
        <ThinkingDots /> {engineName} is thinking
      </span>
    );
  } else if (myTurn) {
    key = inCheck ? "check" : "turn";
    content = inCheck ? <span className="font-semibold text-bad">Check! Your move.</span> : <span className="font-semibold text-ink">Your move</span>;
  } else {
    key = "wait";
    content = <span className="text-muted">Waiting…</span>;
  }
  return (
    <div className="h-6 text-[0.9375rem]" data-testid="status-line">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={key} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 6, transition: { duration: 0.12 } }} transition={{ duration: 0.18 }}>
          {content}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
