"use client";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { useHydrated } from "@/lib/utils/hooks";

/**
 * Renders into <body>. Needed for anything `position: fixed` inside the glass stage: its backdrop-filter makes
 * the stage the containing block for fixed descendants, so they would scroll with the page instead.
 */
export function Portal({ children }: { children: ReactNode }) {
  const hydrated = useHydrated();
  return hydrated ? createPortal(children, document.body) : null;
}
