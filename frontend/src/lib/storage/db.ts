/**
 * Local progress storage. IndexedDB (via `idb`) when available, otherwise localStorage.
 * Nothing ever leaves the browser except through explicit export.
 */
import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { DEFAULT_RATING } from "@/lib/stats/rating";
import type { DrillSession, ExportBlob, GameRecord, PuzzleAttempt, Ratings } from "./types";

interface BlindfoldDB extends DBSchema {
  games: { key: string; value: GameRecord; indexes: { byStart: number } };
  sessions: { key: string; value: DrillSession; indexes: { byStart: number } };
  puzzles: { key: string; value: PuzzleAttempt; indexes: { byTs: number } };
  meta: { key: string; value: unknown };
}

const DB_NAME = "blindfold-chess";
const DB_VERSION = 1;

export function defaultRatings(): Ratings {
  return {
    blindfold: { rating: DEFAULT_RATING, played: 0, peak: DEFAULT_RATING },
    puzzles: { rating: DEFAULT_RATING, played: 0, peak: DEFAULT_RATING },
    drills: {},
  };
}

type Store = {
  put<K extends "games" | "sessions" | "puzzles">(store: K, value: BlindfoldDB[K]["value"]): Promise<void>;
  all<K extends "games" | "sessions" | "puzzles">(store: K): Promise<Array<BlindfoldDB[K]["value"]>>;
  get<K extends "games" | "sessions" | "puzzles">(store: K, key: string): Promise<BlindfoldDB[K]["value"] | undefined>;
  getMeta<T>(key: string): Promise<T | undefined>;
  setMeta(key: string, value: unknown): Promise<void>;
  clear(): Promise<void>;
};

function idbStore(): Store {
  let dbp: Promise<IDBPDatabase<BlindfoldDB>> | null = null;
  const db = () =>
    (dbp ??= openDB<BlindfoldDB>(DB_NAME, DB_VERSION, {
      upgrade(d) {
        d.createObjectStore("games", { keyPath: "id" }).createIndex("byStart", "startedAt");
        d.createObjectStore("sessions", { keyPath: "id" }).createIndex("byStart", "startedAt");
        d.createObjectStore("puzzles", { keyPath: "id" }).createIndex("byTs", "ts");
        d.createObjectStore("meta");
      },
    }));
  return {
    async put(store, value) {
      await (await db()).put(store, value as never);
    },
    async all(store) {
      return (await db()).getAll(store) as never;
    },
    async get(store, key) {
      return (await db()).get(store, key) as never;
    },
    async getMeta<T>(key: string) {
      return (await (await db()).get("meta", key)) as T | undefined;
    },
    async setMeta(key, value) {
      await (await db()).put("meta", value, key);
    },
    async clear() {
      const d = await db();
      await Promise.all([d.clear("games"), d.clear("sessions"), d.clear("puzzles"), d.clear("meta")]);
    },
  };
}

function lsStore(): Store {
  const key = (s: string) => `bf:db:${s}`;
  const read = <T>(s: string, fallback: T): T => {
    try {
      const raw = localStorage.getItem(key(s));
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  };
  const write = (s: string, v: unknown) => {
    try {
      localStorage.setItem(key(s), JSON.stringify(v));
    } catch {
      // Quota exceeded: drop silently, progress is best-effort.
    }
  };
  return {
    async put(store, value) {
      const map = read<Record<string, unknown>>(store, {});
      map[(value as { id: string }).id] = value;
      write(store, map);
    },
    async all(store) {
      return Object.values(read<Record<string, never>>(store, {}));
    },
    async get(store, k) {
      return read<Record<string, never>>(store, {})[k];
    },
    async getMeta<T>(k: string) {
      return read<Record<string, T>>("meta", {})[k];
    },
    async setMeta(k, v) {
      const m = read<Record<string, unknown>>("meta", {});
      m[k] = v;
      write("meta", m);
    },
    async clear() {
      for (const s of ["games", "sessions", "puzzles", "meta"]) localStorage.removeItem(key(s));
    },
  };
}

let store: Store | null = null;
function getStore(): Store {
  if (store) return store;
  store = typeof indexedDB !== "undefined" ? idbStore() : lsStore();
  return store;
}

/** For tests. */
export function __setStoreForTests(kind: "idb" | "ls" | null) {
  store = kind === "idb" ? idbStore() : kind === "ls" ? lsStore() : null;
}

const listeners = new Set<() => void>();
export function onProgressChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function emit() {
  for (const fn of listeners) fn();
}

export async function saveGame(g: GameRecord) {
  await getStore().put("games", g);
  emit();
}
export async function saveSession(s: DrillSession) {
  await getStore().put("sessions", s);
  emit();
}
export async function savePuzzleAttempt(a: PuzzleAttempt) {
  await getStore().put("puzzles", a);
  emit();
}
export async function getGame(id: string) {
  return getStore().get("games", id);
}
export async function listGames(): Promise<GameRecord[]> {
  return (await getStore().all("games")).sort((a, b) => a.startedAt - b.startedAt);
}
export async function listSessions(): Promise<DrillSession[]> {
  return (await getStore().all("sessions")).sort((a, b) => a.startedAt - b.startedAt);
}
export async function listPuzzleAttempts(): Promise<PuzzleAttempt[]> {
  return (await getStore().all("puzzles")).sort((a, b) => a.ts - b.ts);
}
export async function getRatings(): Promise<Ratings> {
  const r = await getStore().getMeta<Ratings>("ratings");
  const d = defaultRatings();
  return r ? { ...d, ...r, drills: { ...d.drills, ...r.drills } } : d;
}
export async function setRatings(r: Ratings) {
  await getStore().setMeta("ratings", r);
  emit();
}

export async function exportProgress(): Promise<ExportBlob> {
  const [games, sessions, puzzles, ratings] = await Promise.all([listGames(), listSessions(), listPuzzleAttempts(), getRatings()]);
  return { app: "blindfold-chess", version: 1, exportedAt: new Date().toISOString(), games, sessions, puzzles, ratings };
}

export function validateExport(data: unknown): data is ExportBlob {
  if (!data || typeof data !== "object") return false;
  const d = data as Partial<ExportBlob>;
  return d.app === "blindfold-chess" && d.version === 1 && Array.isArray(d.games) && Array.isArray(d.sessions) && Array.isArray(d.puzzles) && !!d.ratings;
}

/** Imports an export file. "merge" keeps existing records (same id → imported wins). */
export async function importProgress(data: unknown, mode: "merge" | "replace" = "merge"): Promise<{ games: number; sessions: number; puzzles: number }> {
  if (!validateExport(data)) throw new Error("This file is not a Blindfold progress export.");
  const s = getStore();
  if (mode === "replace") await s.clear();
  for (const g of data.games) await s.put("games", g);
  for (const x of data.sessions) await s.put("sessions", x);
  for (const p of data.puzzles) await s.put("puzzles", p);
  const current = mode === "replace" ? defaultRatings() : await getRatings();
  // Keep whichever rating has more history behind it.
  const pickR = <T extends { played: number }>(a: T | undefined, b: T | undefined): T | undefined => (!a ? b : !b ? a : b.played >= a.played ? b : a);
  const drills = { ...current.drills };
  for (const [k, v] of Object.entries(data.ratings.drills ?? {})) {
    drills[k as keyof typeof drills] = pickR(drills[k as keyof typeof drills], v);
  }
  await s.setMeta("ratings", {
    blindfold: pickR(current.blindfold, data.ratings.blindfold) ?? current.blindfold,
    puzzles: pickR(current.puzzles, data.ratings.puzzles) ?? current.puzzles,
    drills,
  });
  emit();
  return { games: data.games.length, sessions: data.sessions.length, puzzles: data.puzzles.length };
}

export async function clearProgress() {
  await getStore().clear();
  emit();
}

export function newId(prefix = "id"): string {
  const rand = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}
