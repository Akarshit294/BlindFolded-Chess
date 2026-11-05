"use client";
import { create } from "zustand";

/** Page-level UI state shared with the shell (e.g. a live game hides the phone dock for the move bar). */
export const useUi = create<{
  immersive: boolean;
  setImmersive: (v: boolean) => void;
  /** "More options" in the quick setup stays open across the restarts its changes cause. */
  setupMoreOpen: boolean;
  setSetupMoreOpen: (v: boolean) => void;
}>((set) => ({
  immersive: false,
  setImmersive: (immersive) => set({ immersive }),
  setupMoreOpen: false,
  setSetupMoreOpen: (setupMoreOpen) => set({ setupMoreOpen }),
}));
