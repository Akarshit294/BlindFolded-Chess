"use client";
/**
 * User preferences, persisted to localStorage. Hydrated manually after mount (see
 * <Providers>) so server and first client render agree.
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export const BOARD_THEMES = [
  { id: "nocturne", name: "Nocturne", light: "#c9cedb", dark: "#69748f" },
  { id: "walnut", name: "Walnut", light: "#ecd8b6", dark: "#a8774e" },
  { id: "glacier", name: "Glacier", light: "#e8eff4", dark: "#86a3b9" },
  { id: "moss", name: "Moss", light: "#e5e8d3", dark: "#7b9264" },
  { id: "rosewood", name: "Rosewood", light: "#f2dfd6", dark: "#b07a70" },
  { id: "contrast", name: "High contrast", light: "#ffffff", dark: "#4a4a4a" },
] as const;
export type BoardThemeId = (typeof BOARD_THEMES)[number]["id"];

export const PIECE_SETS = [
  { id: "lumen", name: "Lumen", note: "Original set drawn for this site" },
  { id: "cburnett", name: "Classic", note: "cburnett · CC BY-SA 3.0" },
] as const;
export type PieceSetId = (typeof PIECE_SETS)[number]["id"];

export type MotionPref = "system" | "full" | "reduced";
export type MoveHints = "autocomplete" | "validate" | "off";

export type Settings = {
  boardTheme: BoardThemeId;
  pieceSet: PieceSetId;
  coordinates: boolean;
  figurine: boolean;
  sound: boolean;
  volume: number;
  voiceOutput: boolean;
  voiceInput: boolean;
  voiceName: string | null;
  speechRate: number;
  motion: MotionPref;
  ghostDelay: number;
  peekSeconds: number;
  moveHints: MoveHints;
  announceOwnMoves: boolean;
  confirmResign: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  boardTheme: "nocturne",
  pieceSet: "lumen",
  coordinates: true,
  figurine: false,
  sound: true,
  volume: 0.7,
  voiceOutput: true,
  voiceInput: true,
  voiceName: null,
  speechRate: 1,
  motion: "system",
  ghostDelay: 3,
  peekSeconds: 3,
  moveHints: "autocomplete",
  announceOwnMoves: false,
  confirmResign: true,
};

type SettingsState = Settings & {
  hydrated: boolean;
  set: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  reset: () => void;
};

export const SETTINGS_STORAGE_KEY = "bf:settings";

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      hydrated: false,
      set: (key, value) => set({ [key]: value } as Partial<SettingsState>),
      reset: () => set({ ...DEFAULT_SETTINGS }),
    }),
    {
      name: SETTINGS_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => {
        const { hydrated: _h, set: _s, reset: _r, ...rest } = s;
        return rest;
      },
      merge: (persisted, current) => ({ ...current, ...(persisted as Partial<Settings>) }),
      onRehydrateStorage: () => (state) => {
        if (state) state.hydrated = true;
        useSettings.setState({ hydrated: true });
      },
    },
  ),
);

/** Non-hook accessor for code outside React (sound, speech). */
export function getSettings(): Settings {
  return useSettings.getState();
}

/** The inline script that applies theme/motion attributes before first paint. */
export const SETTINGS_BOOT_SCRIPT = `(function(){try{var s=JSON.parse(localStorage.getItem(${JSON.stringify(
  SETTINGS_STORAGE_KEY,
)})||"{}").state||{};var d=document.documentElement;d.setAttribute("data-board-theme",s.boardTheme||"nocturne");if(s.motion&&s.motion!=="system")d.setAttribute("data-motion",s.motion);}catch(e){}})();`;
