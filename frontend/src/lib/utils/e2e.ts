"use client";
/**
 * Test mode for Playwright: `?e2e=1` (remembered for the tab) makes the engine answer
 * instantly and exposes `window.__bf` with the current position. `?e2e=2` exposes the hook but
 * keeps normal engine timing and motion (for screenshots of short-lived states such as a check).
 */
import { useState } from "react";

type Mode = "fast" | "slow" | null;

function e2eMode(): Mode {
  if (typeof window === "undefined") return null;
  try {
    const q = new URLSearchParams(window.location.search).get("e2e");
    if (q === "1" || q === "2") sessionStorage.setItem("bf:e2e", q);
    const v = sessionStorage.getItem("bf:e2e");
    return v === "1" ? "fast" : v === "2" ? "slow" : null;
  } catch {
    return null;
  }
}

export function isE2E(): boolean {
  return e2eMode() !== null;
}

export function useE2E(): { enabled: boolean; fast: boolean } {
  // Only affects effects/timing, never rendered markup, so no hydration mismatch.
  const [mode] = useState(e2eMode);
  return { enabled: mode !== null, fast: mode === "fast" };
}
