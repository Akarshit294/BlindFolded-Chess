"use client";
/**
 * The game in progress. Persisted to localStorage after every change so a refresh restores it.
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { newId } from "@/lib/storage/db";
import type { GameAnalysisSummary, GameConfig, GameRecord, GameResult } from "@/lib/storage/types";

export const DEFAULT_CONFIG: GameConfig = {
  playerColor: "w",
  levelId: 3,
  visibility: "ghost",
  mode: "practice",
  timeControl: null,
  peeks: 3,
  moveList: "full",
};

export type ColorChoice = "w" | "b" | "random";

type GameState = {
  game: GameRecord | null;
  /** Epoch ms when the side to move started thinking (clock bookkeeping). */
  turnStartedAt: number | null;
  setup: GameConfig & { colorChoice: ColorChoice };
  hydrated: boolean;
  setSetup: (patch: Partial<GameConfig & { colorChoice: ColorChoice }>) => void;
  start: (config: GameConfig) => GameRecord;
  applyMove: (uci: string, san: string, now?: number) => void;
  end: (result: GameResult) => void;
  takeback: (plies: number) => void;
  usePeek: () => boolean;
  illegal: () => void;
  setAnalysis: (a: GameAnalysisSummary) => void;
  setRating: (before: number, after: number) => void;
  resumeClock: () => void;
  clear: () => void;
};

export function peeksLeft(g: GameRecord): number {
  if (g.config.peeks < 0) return Infinity;
  return Math.max(0, g.config.peeks - g.peeksUsed);
}

export const useGame = create<GameState>()(
  persist(
    (set, get) => ({
      game: null,
      turnStartedAt: null,
      hydrated: false,
      setup: { ...DEFAULT_CONFIG, colorChoice: "w" },
      setSetup: (patch) => set((s) => ({ setup: { ...s.setup, ...patch } })),
      start: (config) => {
        const now = Date.now();
        const game: GameRecord = {
          id: newId("game"),
          config,
          startedAt: now,
          updatedAt: now,
          moves: [],
          sans: [],
          moveTimes: [],
          clocks: config.timeControl ? { w: config.timeControl.initial * 1000, b: config.timeControl.initial * 1000 } : null,
          peeksUsed: 0,
          illegalAttempts: 0,
          takebacks: 0,
          result: null,
          endedAt: null,
        };
        set({ game, turnStartedAt: now });
        return game;
      },
      applyMove: (uci, san, now = Date.now()) => {
        const { game, turnStartedAt } = get();
        if (!game || game.result) return;
        const mover = game.moves.length % 2 === 0 ? "w" : "b";
        const spent = turnStartedAt ? Math.max(0, now - turnStartedAt) : 0;
        let clocks = game.clocks;
        if (clocks && game.config.timeControl) {
          clocks = { ...clocks, [mover]: Math.max(0, clocks[mover] - spent) + game.config.timeControl.increment * 1000 };
        }
        set({
          game: { ...game, moves: [...game.moves, uci], sans: [...game.sans, san], moveTimes: [...game.moveTimes, spent], clocks, updatedAt: now },
          turnStartedAt: now,
        });
      },
      end: (result) => {
        const { game, turnStartedAt } = get();
        if (!game || game.result) return;
        const now = Date.now();
        let clocks = game.clocks;
        if (clocks && turnStartedAt) {
          const mover = game.moves.length % 2 === 0 ? "w" : "b";
          clocks = { ...clocks, [mover]: Math.max(0, clocks[mover] - (now - turnStartedAt)) };
        }
        set({ game: { ...game, result, endedAt: now, clocks, updatedAt: now }, turnStartedAt: null });
      },
      takeback: (plies) => {
        const { game } = get();
        if (!game || game.result || plies <= 0) return;
        const n = Math.max(0, game.moves.length - plies);
        set({
          game: {
            ...game,
            moves: game.moves.slice(0, n),
            sans: game.sans.slice(0, n),
            moveTimes: game.moveTimes.slice(0, n),
            takebacks: game.takebacks + 1,
            updatedAt: Date.now(),
          },
          turnStartedAt: Date.now(),
        });
      },
      usePeek: () => {
        const { game } = get();
        if (!game || peeksLeft(game) <= 0) return false;
        set({ game: { ...game, peeksUsed: game.peeksUsed + 1, updatedAt: Date.now() } });
        return true;
      },
      illegal: () => {
        const { game } = get();
        if (!game) return;
        set({ game: { ...game, illegalAttempts: game.illegalAttempts + 1, updatedAt: Date.now() } });
      },
      setAnalysis: (analysis) => {
        const { game } = get();
        if (game) set({ game: { ...game, analysis } });
      },
      setRating: (ratingBefore, ratingAfter) => {
        const { game } = get();
        if (game) set({ game: { ...game, ratingBefore, ratingAfter } });
      },
      /** After a reload the time away does not count: restart the current turn's clock now. */
      resumeClock: () => {
        const { game } = get();
        if (game && !game.result) set({ turnStartedAt: Date.now() });
      },
      clear: () => set({ game: null, turnStartedAt: null }),
    }),
    {
      name: "bf:game",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({ game: s.game, turnStartedAt: s.turnStartedAt, setup: s.setup }),
      onRehydrateStorage: () => () => {
        useGame.setState({ hydrated: true });
      },
    },
  ),
);

/** Remaining time (ms) for a side right now. */
export function remainingMs(game: GameRecord, turnStartedAt: number | null, color: "w" | "b", now = Date.now()): number | null {
  if (!game.clocks) return null;
  const toMove = game.moves.length % 2 === 0 ? "w" : "b";
  const base = game.clocks[color];
  if (game.result || color !== toMove || !turnStartedAt) return base;
  return Math.max(0, base - (now - turnStartedAt));
}
