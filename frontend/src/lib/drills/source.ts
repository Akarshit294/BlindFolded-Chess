"use client";
/**
 * Drill data: from the backend when it is online (seeded, realistic), otherwise generated
 * locally with the same seeds. The UI never waits more than a moment for the network.
 */
import { apiFetch, backendOnline } from "@/lib/api/client";
import { mulberry32 } from "@/lib/utils/random";
import { generateSequence, randomPosition, type MoveSequence } from "./generators";

export async function getSequence(plies: number, seed: number): Promise<MoveSequence & { source: "server" | "local" }> {
  if (backendOnline()) {
    try {
      const r = await apiFetch<{ san: string[]; uci: string[]; fen: string }>(`/api/drills/sequence?plies=${plies}&seed=${seed}`, { timeoutMs: 2500 });
      if (r.san.length === plies) return { sans: r.san, ucis: r.uci, fen: r.fen, source: "server" };
    } catch {
      // fall back
    }
  }
  return { ...generateSequence(plies, mulberry32(seed)), source: "local" };
}

export async function getPosition(pieces: number, seed: number): Promise<{ fen: string; source: "server" | "local" }> {
  if (backendOnline()) {
    try {
      const r = await apiFetch<{ fen: string; pieces: number }>(`/api/drills/position?pieces=${pieces}&seed=${seed}`, { timeoutMs: 2500 });
      if (r.fen) return { fen: r.fen, source: "server" };
    } catch {
      // fall back
    }
  }
  return { fen: randomPosition(pieces, mulberry32(seed)), source: "local" };
}
