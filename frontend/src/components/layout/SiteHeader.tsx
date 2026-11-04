"use client";
import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { EyeMorph } from "@/components/ui/EyeMorph";
import { IconBook, IconChart, IconKnight, IconPuzzle, IconSettings, IconTarget } from "@/components/ui/Icons";
import { cn } from "@/lib/utils/cn";

export const NAV = [
  { href: "/play", label: "Play", icon: IconKnight },
  { href: "/train", label: "Train", icon: IconTarget },
  { href: "/puzzles", label: "Puzzles", icon: IconPuzzle },
  { href: "/stats", label: "Stats", icon: IconChart },
  { href: "/learn", label: "Learn", icon: IconBook },
] as const;

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Logo() {
  const [hover, setHover] = useState(false);
  return (
    <Link
      href="/"
      className="group flex items-center gap-2.5 rounded-xl px-1 py-1 outline-none focus-visible:ring-2 focus-visible:ring-moon-300"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      aria-label="Blindfold — home"
    >
      <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-night-600 to-night-800 text-ivory-50 ring-1 ring-ivory-100/10 shadow-[0_8px_20px_-10px_rgba(124,133,223,0.7)]">
        <EyeMorph closed={hover} size={22} />
      </span>
      <span className="font-display text-[19px] font-semibold tracking-tight text-ivory-50">
        Blindfold<span className="text-ember-400">.</span>
      </span>
    </Link>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  return (
    <>
      <header
        className="sticky top-0 z-50 border-b border-ivory-100/[0.06] bg-night-950/70 backdrop-blur-xl"
        style={{ viewTransitionName: "site-header" }}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Logo />
          <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative rounded-full px-4 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-moon-300",
                    active ? "text-night-950" : "text-ivory-300 hover:text-ivory-50",
                  )}
                >
                  {active ? (
                    <motion.span
                      layoutId="nav-pill"
                      className="absolute inset-0 -z-10 rounded-full bg-gradient-to-b from-ivory-50 to-ivory-200"
                      transition={{ type: "spring", stiffness: 480, damping: 36 }}
                    />
                  ) : null}
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <Link
            href="/settings"
            aria-label="Settings"
            aria-current={isActive(pathname, "/settings") ? "page" : undefined}
            className={cn(
              "group inline-flex h-10 w-10 items-center justify-center rounded-xl text-ivory-300 outline-none transition-colors hover:bg-ivory-100/[0.07] hover:text-ivory-50 focus-visible:ring-2 focus-visible:ring-moon-300",
              isActive(pathname, "/settings") && "bg-ivory-100/[0.08] text-ivory-50",
            )}
          >
            <IconSettings className="transition-transform duration-500 group-hover:rotate-90" />
          </Link>
        </div>
      </header>

      {/* Mobile tab bar */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-ivory-100/[0.07] bg-night-950/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
      >
        <div className="mx-auto grid max-w-md grid-cols-5">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium outline-none focus-visible:bg-ivory-100/5",
                  active ? "text-ember-300" : "text-ivory-400",
                )}
              >
                {active ? (
                  <motion.span
                    layoutId="tab-dot"
                    className="absolute top-0 h-0.5 w-8 rounded-full bg-ember-400"
                    transition={{ type: "spring", stiffness: 480, damping: 36 }}
                  />
                ) : null}
                <Icon size={21} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
