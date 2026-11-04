"use client";
/** Puzzles from the backend when online, otherwise from the bundled JSON in /public/data. */
import { apiFetch, backendOnline } from "@/lib/api/client";
import { choosePuzzle } from "./logic";
import type { Puzzle, PuzzleFilters } from "./types";

let bundled: Promise<Puzzle[]> | null = null;

export function loadBundledPuzzles(): Promise<Puzzle[]> {
  bundled ??= fetch("/data/puzzles.json")
    .then((r) => (r.ok ? r.json() : { puzzles: [] }))
    .then((d: { puzzles?: Puzzle[] }) => d.puzzles ?? [])
    .catch(() => {
      bundled = null;
      return [];
    });
  return bundled;
}

const RECENT_KEY = "bf:puzzles:recent";

export function recentPuzzleIds(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

export function rememberPuzzle(id: string) {
  try {
    const list = [...recentPuzzleIds()].filter((x) => x !== id);
    list.push(id);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(-300)));
  } catch {
    // ignore
  }
}

export async function nextPuzzle(f: PuzzleFilters): Promise<{ puzzle: Puzzle | null; source: "server" | "bundled" }> {
  const exclude = recentPuzzleIds();
  if (backendOnline()) {
    try {
      const params = new URLSearchParams({
        goal: f.goal,
        min_rating: String(f.minRating),
        max_rating: String(f.maxRating),
        max_pieces: String(f.maxPieces),
        exclude: [...exclude].slice(-80).join(","),
      });
      const p = await apiFetch<Puzzle>(`/api/puzzles/random?${params.toString()}`, { timeoutMs: 3000 });
      if (p?.id && Array.isArray(p.moves)) return { puzzle: p, source: "server" };
    } catch {
      // fall back to bundled
    }
  }
  const all = await loadBundledPuzzles();
  return { puzzle: choosePuzzle(all, f, exclude), source: "bundled" };
}
