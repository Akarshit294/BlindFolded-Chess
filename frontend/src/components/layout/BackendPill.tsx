"use client";
import { AnimatePresence, motion } from "motion/react";
import { checkBackend, useBackend } from "@/lib/api/client";
import { cn } from "@/lib/utils/cn";

const COPY = {
  disabled: { text: "Offline mode · built-in data", dot: "bg-ember-400", title: "No backend configured — puzzles, drills and analysis run in your browser." },
  checking: { text: "Connecting…", dot: "bg-moon-400 animate-pulse", title: "Checking the puzzle server" },
  waking: { text: "Waking the server…", dot: "bg-moon-400 animate-pulse", title: "The free server sleeps when idle. Everything works meanwhile." },
  online: { text: "Server online", dot: "bg-jade-400", title: "Connected to the puzzle & analysis server" },
  offline: { text: "Offline mode · built-in data", dot: "bg-ember-400", title: "Server unreachable — using built-in puzzles and in-browser analysis. Click to retry." },
} as const;

/** Small status indicator: the app never depends on the backend, this just says what's used. */
export function BackendPill({ className }: { className?: string }) {
  const state = useBackend((s) => s.state);
  const c = COPY[state];
  return (
    <button
      type="button"
      onClick={() => state === "offline" && void checkBackend()}
      title={c.title}
      data-testid="backend-status"
      data-state={state}
      className={cn(
        "inline-flex items-center gap-2 rounded-full bg-ivory-100/[0.04] px-3 py-1 text-[11px] font-medium text-ivory-400 ring-1 ring-inset ring-ivory-100/[0.07] outline-none transition-colors hover:text-ivory-200 focus-visible:ring-moon-300",
        state !== "offline" && "cursor-default",
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", c.dot)} />
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={state} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18 }}>
          {c.text}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
