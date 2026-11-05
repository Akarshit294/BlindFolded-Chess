"use client";
/**
 * User preferences, persisted to localStorage. Hydrated manually after mount (see
 * <Providers>) so server and first client render agree.
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export const THEMES = [
  { id: "system", name: "System" },
  { id: "light", name: "Light" },
  { id: "dark", name: "Dark" },
] as const;
export type ThemePref = (typeof THEMES)[number]["id"];

/** Monochrome board themes. Each has square colors for the light and the dark interface (see globals.css). */
export const BOARD_THEMES = [
  { id: "studio", name: "Studio", light: ["#e3e3e3", "#a3a3a3"], dark: ["#8c8c8c", "#585858"] },
  { id: "graphite", name: "Graphite", light: ["#cfcfcf", "#808080"], dark: ["#737373", "#444444"] },
  { id: "ink", name: "Ink", light: ["#f1f1f1", "#363636"], dark: ["#d4d4d4", "#262626"] },
  { id: "paper", name: "Paper", light: ["#f4f4f4", "#cbcbcb"], dark: ["#ababab", "#7d7d7d"] },
  { id: "contrast", name: "High contrast", light: ["#ffffff", "#3b3b3b"], dark: ["#f2f2f2", "#303030"] },
] as const;
export type BoardThemeId = (typeof BOARD_THEMES)[number]["id"];

export const PIECE_SETS = [
  { id: "gloss", name: "Gloss", note: "Porcelain and lacquer, rendered in 3D" },
  { id: "lumen", name: "Lumen", note: "Flat, drawn for this site" },
  { id: "cburnett", name: "Classic", note: "cburnett · CC BY-SA 3.0" },
] as const;
export type PieceSetId = (typeof PIECE_SETS)[number]["id"];

export type MotionPref = "system" | "full" | "reduced";
export type MoveHints = "autocomplete" | "validate" | "off";

export type Settings = {
  theme: ThemePref;
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
  theme: "system",
  boardTheme: "studio",
  pieceSet: "gloss",
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
export const SETTINGS_VERSION = 2;

/** Colored board themes from before the redesign, mapped to their closest monochrome theme. */
export const LEGACY_BOARD_THEMES: Record<string, BoardThemeId> = {
  nocturne: "studio",
  glacier: "studio",
  walnut: "graphite",
  moss: "graphite",
  rosewood: "graphite",
};

const isBoardTheme = (v: unknown): v is BoardThemeId => BOARD_THEMES.some((t) => t.id === v);
const isPieceSet = (v: unknown): v is PieceSetId => PIECE_SETS.some((p) => p.id === v);
const isTheme = (v: unknown): v is ThemePref => THEMES.some((t) => t.id === v);

/**
 * Brings settings saved by any earlier version up to date. Version 1 (before the redesign) had colored board
 * themes, Lumen as the default piece set and no interface theme.
 */
export function migrateSettings(persisted: unknown, version: number): Partial<Settings> {
  const s = { ...((persisted ?? {}) as Record<string, unknown>) };
  if (version < 2) {
    const bt = s.boardTheme as string | undefined;
    s.boardTheme = (bt && LEGACY_BOARD_THEMES[bt]) ?? (isBoardTheme(bt) ? bt : "studio");
    // Lumen was the old default, so most saved "lumen" values were never a choice: move them to Gloss.
    if (s.pieceSet !== "cburnett") s.pieceSet = "gloss";
    if (!isTheme(s.theme)) s.theme = "system";
  }
  return sanitize(s);
}

/** Drops values that are no longer valid, so a bad localStorage entry can never break the UI. */
export function sanitize(s: Record<string, unknown>): Partial<Settings> {
  const out = { ...s } as Partial<Settings> & Record<string, unknown>;
  if (out.boardTheme !== undefined && !isBoardTheme(out.boardTheme)) out.boardTheme = LEGACY_BOARD_THEMES[out.boardTheme as string] ?? "studio";
  if (out.pieceSet !== undefined && !isPieceSet(out.pieceSet)) out.pieceSet = "gloss";
  if (out.theme !== undefined && !isTheme(out.theme)) out.theme = "system";
  return out;
}

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
      version: SETTINGS_VERSION,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => {
        const { hydrated: _h, set: _s, reset: _r, ...rest } = s;
        return rest;
      },
      migrate: (persisted, version) => migrateSettings(persisted, version) as SettingsState,
      merge: (persisted, current) => ({ ...current, ...sanitize((persisted ?? {}) as Record<string, unknown>) }),
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

/** "light" or "dark" for a theme preference, resolving "system" with the OS setting. */
export function resolveTheme(pref: ThemePref): "light" | "dark" {
  if (pref !== "system") return pref;
  if (typeof window === "undefined" || !window.matchMedia) return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * The inline script that applies theme, board theme and motion attributes before first paint, so a dark-mode
 * visitor never sees a light flash. Mirrors migrateSettings for values saved before the redesign.
 */
export const SETTINGS_BOOT_SCRIPT = `(function(){try{var d=document.documentElement;var s={};try{s=JSON.parse(localStorage.getItem(${JSON.stringify(
  SETTINGS_STORAGE_KEY,
)})||"{}").state||{}}catch(e){}var L=${JSON.stringify(LEGACY_BOARD_THEMES)};var b=L[s.boardTheme]||s.boardTheme;if(${JSON.stringify(
  BOARD_THEMES.map((t) => t.id),
)}.indexOf(b)<0)b="studio";d.setAttribute("data-board-theme",b);var t=s.theme;if(t!=="light"&&t!=="dark"){t=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}d.setAttribute("data-theme",t);if(s.motion&&s.motion!=="system")d.setAttribute("data-motion",s.motion);}catch(e){}})();`;
