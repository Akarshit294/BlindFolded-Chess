"use client";
import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { IconMenu, IconSettings } from "@/components/ui/Icons";
import { Modal } from "@/components/ui/Modal";
import { PawnMark } from "@/components/ui/PawnMark";
import { cn } from "@/lib/utils/cn";
import { isActive, NAV } from "./nav";

export function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="Blindfold Chess, home"
      className={cn(
        "group flex shrink-0 items-center gap-2.5 rounded-full py-1 pr-2 text-ink outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]",
        className,
      )}
    >
      <PawnMark size={30} className="transition-transform duration-500 ease-out group-hover:-rotate-6" />
      <span className="font-display text-[1.375rem] font-bold uppercase leading-none tracking-[0.05em]">Blindfold</span>
    </Link>
  );
}

const LINK =
  "relative rounded-full px-4 py-2 text-[0.9375rem] font-semibold outline-none transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]";

export function SiteHeader() {
  const pathname = usePathname();
  const [menu, setMenu] = useState(false);
  const [stuck, setStuck] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);

  // Once the page scrolls, the header lifts into a floating glass bar.
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setStuck(!e!.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Close the menu when the route changes.
  const [menuPath, setMenuPath] = useState(pathname);
  if (menuPath !== pathname) {
    setMenuPath(pathname);
    setMenu(false);
  }

  const settingsActive = isActive(pathname, "/settings");

  return (
    <>
      <div ref={sentinel} aria-hidden="true" className="h-px" />
      <header className="sticky top-2 z-40 -mt-px px-2 sm:top-3 sm:px-3" style={{ viewTransitionName: "site-header" }}>
        <div
          className={cn(
            "mx-auto flex h-[var(--header-h)] items-center justify-between gap-4 rounded-full px-3 transition-[background,box-shadow,border-color,backdrop-filter] duration-300 sm:px-5 lg:px-6",
            stuck ? "glass-float" : "border border-transparent",
          )}
        >
          <Logo />
          <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={cn(LINK, active ? "text-ink" : "text-muted hover:text-ink")}>
                  {active ? (
                    <motion.span layoutId="nav-pill" className="pill-secondary absolute inset-0 -z-10 rounded-full" transition={{ type: "spring", stiffness: 480, damping: 38 }} />
                  ) : null}
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-1">
            <Link
              href="/settings"
              aria-label="Settings"
              aria-current={settingsActive ? "page" : undefined}
              className={cn(
                "group relative inline-flex h-10 w-10 items-center justify-center rounded-full text-ink outline-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]",
                settingsActive ? "pill-secondary" : "hover:bg-ink/[0.07]",
              )}
            >
              <IconSettings size={20} className="transition-transform duration-700 ease-out group-hover:rotate-90" />
            </Link>
            <button
              type="button"
              aria-label="Menu"
              aria-haspopup="dialog"
              aria-expanded={menu}
              onClick={() => setMenu(true)}
              className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-ink outline-none transition-colors hover:bg-ink/[0.07] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] md:hidden"
            >
              <IconMenu size={21} />
            </button>
          </div>
        </div>
      </header>

      <Modal open={menu} onClose={() => setMenu(false)} title="Menu" closeButton className="sm:max-w-sm">
        <nav aria-label="Menu">
          <ul className="grid gap-1">
            {[...NAV, { href: "/settings", label: "Settings", icon: IconSettings }, { href: "/credits", label: "Credits", icon: null }].map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setMenu(false)}
                    className={cn(
                      "flex h-12 items-center gap-3 rounded-full px-4 text-base font-semibold outline-none transition-colors focus-visible:outline-2 focus-visible:outline-[var(--focus)]",
                      active ? "pill-secondary text-ink" : "text-ink hover:bg-ink/[0.06]",
                    )}
                  >
                    {Icon ? <Icon size={20} /> : <span className="w-5" aria-hidden="true" />}
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </Modal>
    </>
  );
}
