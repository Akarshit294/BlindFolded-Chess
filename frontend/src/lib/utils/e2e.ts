"use client";
/**
 * Test mode for Playwright: `?e2e=1` (remembered for the tab) makes the engine answer
 * instantly and exposes `window.__bf` with the current position.
 */
import { useState } from "react";

export function isE2E(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (new URLSearchParams(window.location.search).get("e2e") === "1") {
      sessionStorage.setItem("bf:e2e", "1");
      return true;
    }
    return sessionStorage.getItem("bf:e2e") === "1";
  } catch {
    return false;
  }
}

export function useE2E(): { enabled: boolean; fast: boolean } {
  // Only affects effects/timing, never rendered markup, so no hydration mismatch.
  const [on] = useState(isE2E);
  return { enabled: on, fast: on };
}
