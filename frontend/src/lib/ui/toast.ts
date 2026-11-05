"use client";
/**
 * Global toasts: short glass messages that confirm or warn without moving focus. The <Toaster> renders them
 * in a polite live region, so callers should not also announce the same text.
 */
import { create } from "zustand";

export type ToastTone = "info" | "good" | "bad";
export type Toast = { id: number; text: string; tone: ToastTone };

type ToastState = {
  toasts: Toast[];
  push: (t: Toast) => void;
  dismiss: (id: number) => void;
  clear: () => void;
};

export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  push: (t) => set((s) => ({ toasts: [...s.toasts.filter((x) => x.text !== t.text), t].slice(-3) })),
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  clear: () => set({ toasts: [] }),
}));

let counter = 0;

/** Shows a toast for `duration` ms (default 2.8 s); returns its id. */
export function toast(text: string, opts: { tone?: ToastTone; duration?: number } = {}): number {
  counter += 1;
  const id = counter;
  useToasts.getState().push({ id, text, tone: opts.tone ?? "info" });
  if (typeof window !== "undefined") window.setTimeout(() => useToasts.getState().dismiss(id), opts.duration ?? 2800);
  return id;
}
