"use client";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUi } from "@/lib/ui/store";
import { cn } from "@/lib/utils/cn";
import { isActive, NAV } from "./nav";

/**
 * Phone navigation: a floating glass dock within thumb reach. It steps aside during a live game, where the move
 * bar takes its place (the header menu still reaches every page).
 */
export function MobileDock() {
  const pathname = usePathname();
  const immersive = useUi((s) => s.immersive);
  return (
    <AnimatePresence initial={false}>
      {immersive ? null : (
        <motion.nav
          key="dock"
          aria-label="Main"
          initial={{ y: 90, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 90, opacity: 0, transition: { duration: 0.2 } }}
          transition={{ type: "spring", stiffness: 420, damping: 36 }}
          className="fixed inset-x-2 bottom-[max(0.5rem,env(safe-area-inset-bottom))] z-50 md:hidden"
        >
          {/* Named here, not on the nav: a view-transition-name on an ancestor would stop the backdrop blur. */}
          <ul className="glass-float mx-auto grid h-[var(--dock-h)] max-w-md grid-cols-5 rounded-[1.375rem] px-1.5" style={{ viewTransitionName: "site-dock" }}>
            {NAV.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <li key={item.href} className="flex">
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative flex flex-1 flex-col items-center justify-center gap-1 rounded-2xl text-caption font-semibold outline-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--focus)]",
                      active ? "text-ink" : "text-muted",
                    )}
                  >
                    {active ? (
                      <motion.span
                        layoutId="dock-pill"
                        className="pill-secondary absolute inset-x-1 inset-y-1.5 -z-10 rounded-2xl"
                        transition={{ type: "spring", stiffness: 480, damping: 38 }}
                      />
                    ) : null}
                    <Icon size={21} />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </motion.nav>
      )}
    </AnimatePresence>
  );
}
