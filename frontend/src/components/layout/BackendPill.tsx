"use client";
import { AnimatePresence, motion } from "motion/react";
import { checkBackend, useBackend } from "@/lib/api/client";
import { cn } from "@/lib/utils/cn";

const COPY = {
  disabled: { text: "Offline mode, built-in data", dot: "bg-muted", title: "No backend configured. Puzzles, drills and analysis run in your browser." },
  checking: { text: "Connecting…", dot: "bg-muted animate-pulse", title: "Checking the puzzle server" },
  waking: { text: "Waking the server…", dot: "bg-muted animate-pulse", title: "The free server sleeps when idle. Everything works meanwhile." },
  online: { text: "Server online", dot: "bg-good", title: "Connected to the puzzle and analysis server" },
  offline: { text: "Offline mode, built-in data", dot: "bg-muted", title: "Server unreachable: using built-in puzzles and in-browser analysis. Click to retry." },
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
        "glass-well inline-flex h-8 items-center gap-2 rounded-full px-3 text-caption font-semibold text-muted outline-none transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-[var(--focus)]",
        state === "offline" ? "cursor-pointer" : "cursor-default",
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
