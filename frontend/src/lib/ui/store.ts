"use client";
import { create } from "zustand";

/** Page-level UI state shared with the shell (e.g. a live game hides the phone dock for the move bar). */
export const useUi = create<{ immersive: boolean; setImmersive: (v: boolean) => void }>((set) => ({
  immersive: false,
  setImmersive: (immersive) => set({ immersive }),
}));
