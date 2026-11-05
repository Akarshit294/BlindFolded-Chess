"use client";
import { AnimatePresence, motion } from "motion/react";
import { IconCheck, IconInfo, IconX } from "@/components/ui/Icons";
import { useToasts } from "@/lib/ui/toast";
import { cn } from "@/lib/utils/cn";

/**
 * Glass toasts. Top center on larger screens; on phones they sit above the dock or the move bar, where the thumb
 * and the eye already are.
 */
export function Toaster() {
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      role="status"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--dock-h)+1.25rem+env(safe-area-inset-bottom)+var(--kb))] z-[80] flex flex-col items-center gap-2 px-4 sm:bottom-auto sm:top-[calc(var(--header-h)+1.25rem)]"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98, transition: { duration: 0.16 } }}
            transition={{ type: "spring", stiffness: 520, damping: 36 }}
            className="glass-float pointer-events-auto flex max-w-[min(92vw,26rem)] items-center gap-2.5 rounded-full py-2 pl-2.5 pr-4 text-small font-semibold text-ink"
            onClick={() => dismiss(t.id)}
          >
            <span
              aria-hidden="true"
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                t.tone === "good" ? "bg-good text-white" : t.tone === "bad" ? "bg-bad text-white" : "bg-ink text-on-ink",
              )}
            >
              {t.tone === "good" ? <IconCheck size={14} strokeWidth={2.4} /> : t.tone === "bad" ? <IconX size={13} strokeWidth={2.4} /> : <IconInfo size={14} strokeWidth={2.2} />}
            </span>
            <span>{t.text}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
