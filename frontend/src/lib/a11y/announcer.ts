"use client";
/** Global ARIA live-region announcer (rendered once by <LiveRegion/>). */
import { create } from "zustand";

type AnnouncerState = { polite: string; assertive: string; n: number };

export const useAnnouncer = create<AnnouncerState>(() => ({ polite: "", assertive: "", n: 0 }));

export function announce(message: string, politeness: "polite" | "assertive" = "polite") {
  // Appending an invisible counter forces screen readers to re-read identical messages.
  const n = useAnnouncer.getState().n + 1;
  const text = `${message}${n % 2 ? "" : "​"}`;
  useAnnouncer.setState(politeness === "polite" ? { polite: text, n } : { assertive: text, n });
}
