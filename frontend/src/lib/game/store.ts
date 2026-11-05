"use client";
/**
 * The game in progress. Persisted to localStorage after every change so a refresh restores it.
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { replay, uciToMove } from "@/lib/game/rules";
import { newId } from "@/lib/storage/db";
import type { GameAnalysisSummary, GameConfig, GameRecord, GameResult } from "@/lib/storage/types";

/** First-visit defaults: White, a friendly opponent (Candle, about 700) and Ghost mode. */
export const DEFAULT_CONFIG: GameConfig = {
  playerColor: "w",
  levelId: 2,
  visibility: "ghost",
  mode: "practice",
  timeControl: null,
  peeks: 3,
  moveList: "full",
};

export type ColorChoice = "w" | "b" | "random";
export type Setup = GameConfig & { colorChoice: ColorChoice };

/**
 * The game config a setup produces: Random picks a color, full-board games are always practice, and rated games
 * allow at most three peeks.
 */
export function configFromSetup(setup: Setup, rand: () => number = Math.random): GameConfig {
  const playerColor = setup.colorChoice === "random" ? (rand() < 0.5 ? "w" : "b") : setup.colorChoice;
  const mode = setup.visibility === "full" ? "practice" : setup.mode;
  const peeks = mode === "rated" ? Math.min(setup.peeks < 0 ? 3 : setup.peeks, 3) : setup.peeks;
  return { playerColor, levelId: setup.levelId, visibility: setup.visibility, mode, timeControl: setup.timeControl, peeks, moveList: setup.moveList };
}

/** A game worth continuing: started, not finished. */
export function isResumable(game: GameRecord | null): game is GameRecord {
  return !!game && !game.result && game.moves.length > 0;
}

type GameState = {
  game: GameRecord | null;
  /** Epoch ms when the side to move started (or resumed) thinking; null while paused. */
  turnStartedAt: number | null;
  /** Time already charged to the side to move during this turn, before a pause. */
  turnBanked: number;
  setup: Setup;
  hydrated: boolean;
  setSetup: (patch: Partial<Setup>) => void;
  start: (config: GameConfig) => GameRecord;
  /** Applies an optional setup change (remembered) and starts a game from the setup. */
  startFromSetup: (patch?: Partial<Setup>) => GameRecord;
  /** Records a move if it is legal in the current position; returns whether it was. */
  applyMove: (uci: string, now?: number) => boolean;
  end: (result: GameResult) => void;
  takeback: (plies: number) => void;
  usePeek: () => boolean;
  illegal: () => void;
  setAnalysis: (a: GameAnalysisSummary) => void;
  setRating: (before: number, after: number) => void;
  pauseClock: (now?: number) => void;
  resumeClock: (now?: number) => void;
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
      turnBanked: 0,
      hydrated: false,
      setup: { ...DEFAULT_CONFIG, colorChoice: "w" },
      setSetup: (patch) => set((s) => ({ setup: { ...s.setup, ...patch } })),
      startFromSetup: (patch) => {
        if (patch) get().setSetup(patch);
        return get().start(configFromSetup(get().setup));
      },
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
        set({ game, turnStartedAt: now, turnBanked: 0 });
        return game;
      },
      applyMove: (uci, now = Date.now()) => {
        const { game, turnStartedAt, turnBanked } = get();
        if (!game || game.result) return false;
        // Only a legal move from the current position is recorded. A stale or out-of-turn move
        // would leave the saved game and the board out of step for good.
        const { chess, history } = replay(game.moves);
        if (history.length !== game.moves.length) return false;
        let san: string;
        try {
          san = chess.move(uciToMove(uci)).san;
        } catch {
          return false;
        }
        const mover = game.moves.length % 2 === 0 ? "w" : "b";
        const spent = turnStartedAt ? Math.max(0, now - turnStartedAt) : 0;
        let clocks = game.clocks;
        if (clocks && game.config.timeControl) {
          clocks = { ...clocks, [mover]: Math.max(0, clocks[mover] - spent) + game.config.timeControl.increment * 1000 };
        }
        set({
          game: { ...game, moves: [...game.moves, uci], sans: [...game.sans, san], moveTimes: [...game.moveTimes, (turnBanked ?? 0) + spent], clocks, updatedAt: now },
          turnStartedAt: now,
          turnBanked: 0,
        });
        return true;
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
        set({ game: { ...game, result, endedAt: now, clocks, updatedAt: now }, turnStartedAt: null, turnBanked: 0 });
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
          turnBanked: 0,
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
      /**
       * Leaving the game (reload, closing the tab, another page) charges the time spent so far
       * on this move and stops the clock, so a reload can't give that time back.
       */
      pauseClock: (now = Date.now()) => {
        const { game, turnStartedAt, turnBanked } = get();
        if (!game || game.result || turnStartedAt === null) return;
        const spent = Math.max(0, now - turnStartedAt);
        const mover = game.moves.length % 2 === 0 ? "w" : "b";
        const clocks = game.clocks ? { ...game.clocks, [mover]: Math.max(0, game.clocks[mover] - spent) } : null;
        set({ game: { ...game, clocks }, turnStartedAt: null, turnBanked: (turnBanked ?? 0) + spent });
      },
      /** Coming back restarts the clock; the time away does not count. */
      resumeClock: (now = Date.now()) => {
        const { game } = get();
        if (game && !game.result) set({ turnStartedAt: now });
      },
      clear: () => set({ game: null, turnStartedAt: null, turnBanked: 0 }),
    }),
    {
      name: "bf:game",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({ game: s.game, turnStartedAt: s.turnStartedAt, turnBanked: s.turnBanked, setup: s.setup }),
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
  return Math.max(0, base - Math.max(0, now - turnStartedAt));
}
