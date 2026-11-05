"use client";
import { MotionConfig } from "motion/react";
import { useEffect, type ReactNode } from "react";
import { checkBackend } from "@/lib/api/client";
import { resolveTheme, useSettings } from "@/lib/settings/store";

/** Status-bar color per theme (matches --studio-mid). */
const THEME_COLOR = { light: "#ececec", dark: "#1d1d1d" } as const;

/** Hydrates persisted settings, mirrors them onto <html>, follows the OS theme, and wakes the backend. */
export function Providers({ children }: { children: ReactNode }) {
  const motion = useSettings((s) => s.motion);
  const boardTheme = useSettings((s) => s.boardTheme);
  const theme = useSettings((s) => s.theme);
  const hydrated = useSettings((s) => s.hydrated);

  useEffect(() => {
    void useSettings.persist.rehydrate();
    void checkBackend();
    const id = window.setInterval(() => void checkBackend(), 5 * 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const el = document.documentElement;
    el.setAttribute("data-board-theme", boardTheme);
    if (motion === "system") el.removeAttribute("data-motion");
    else el.setAttribute("data-motion", motion);
  }, [motion, boardTheme, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    const apply = () => {
      const t = resolveTheme(theme);
      document.documentElement.setAttribute("data-theme", t);
      // The browser chrome follows the app theme even when it differs from the OS one.
      document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", THEME_COLOR[t]));
    };
    apply();
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme, hydrated]);

  return <MotionConfig reducedMotion={motion === "reduced" ? "always" : motion === "full" ? "never" : "user"}>{children}</MotionConfig>;
}
