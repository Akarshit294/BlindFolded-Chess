"use client";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { IconX } from "@/components/ui/Icons";
import { cn } from "@/lib/utils/cn";
import { useHydrated } from "@/lib/utils/hooks";

type Props = {
  open: boolean;
  onClose?: () => void;
  title?: ReactNode;
  /** Short text under the title. */
  description?: ReactNode;
  children: ReactNode;
  className?: string;
  dismissable?: boolean;
  /** Show the round close button in the corner. */
  closeButton?: boolean;
};

const FOCUSABLE = "button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex='-1'])";

/**
 * Glass dialog. A bottom sheet on phones, centered on larger screens. Focus moves in, is trapped, and is restored
 * on close; Escape and the scrim dismiss it.
 */
export function Modal({ open, onClose, title, description, children, className, dismissable = true, closeButton = false }: Props) {
  const panel = useRef<HTMLDivElement>(null);
  const restore = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descId = useId();
  // Portals need the document: render nothing during SSR and hydration.
  const mounted = useHydrated();

  useEffect(() => {
    if (!open) return;
    restore.current = document.activeElement as HTMLElement | null;
    const t = window.setTimeout(() => {
      const el = panel.current?.querySelector<HTMLElement>("[data-autofocus]") ?? panel.current?.querySelector<HTMLElement>(FOCUSABLE);
      el?.focus();
    }, 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissable) onClose?.();
      if (e.key === "Tab" && panel.current) {
        const focusables = panel.current.querySelectorAll<HTMLElement>(FOCUSABLE);
        if (focusables.length === 0) return;
        const first = focusables[0]!;
        const last = focusables[focusables.length - 1]!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey);
      restore.current?.focus?.({ preventScroll: true });
    };
  }, [open, onClose, dismissable]);

  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[100] flex items-end justify-center p-2 sm:items-center sm:p-6">
          <motion.div
            className="absolute inset-0 bg-[var(--scrim)] backdrop-blur-[6px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.16 } }}
            transition={{ duration: 0.24 }}
            onClick={() => dismissable && onClose?.()}
          />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            aria-describedby={description ? descId : undefined}
            className={cn(
              "glass-float relative max-h-[calc(100dvh-1rem)] w-full overflow-y-auto rounded-panel p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:max-h-[calc(100dvh-3rem)] sm:p-7",
              // One width class only, so the override always wins.
              className?.includes("max-w-") ? null : "max-w-md",
              className,
            )}
            initial={{ opacity: 0, y: 28, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.99, transition: { duration: 0.16 } }}
            transition={{ type: "spring", stiffness: 420, damping: 36 }}
          >
            {closeButton && dismissable ? (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="absolute right-4 top-4 inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-ink transition-colors hover:bg-ink/[0.07] focus-visible:outline-2 focus-visible:outline-[var(--focus)]"
              >
                <IconX size={18} />
              </button>
            ) : null}
            {title ? (
              <h2 id={titleId} className="display pr-10 text-[1.625rem] leading-none">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p id={descId} className="mt-3 text-[0.9375rem] text-fg">
                {description}
              </p>
            ) : null}
            <div className={title || description ? "mt-5" : undefined}>{children}</div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
