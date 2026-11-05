"use client";
import { MotionConfig } from "motion/react";
import { useEffect, type ReactNode } from "react";
import { checkBackend } from "@/lib/api/client";
import { useSettings } from "@/lib/settings/store";

/** Hydrates persisted settings, mirrors them onto <html>, and wakes the backend. */
export function Providers({ children }: { children: ReactNode }) {
  const motion = useSettings((s) => s.motion);
  const boardTheme = useSettings((s) => s.boardTheme);
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

  return <MotionConfig reducedMotion={motion === "reduced" ? "always" : motion === "full" ? "never" : "user"}>{children}</MotionConfig>;
}
