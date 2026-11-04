"use client";
/**
 * Backend client. The backend is optional: free tiers sleep, so every caller has a local
 * fallback and nothing ever blocks on the network.
 */
import { create } from "zustand";

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");

export type BackendState = "disabled" | "checking" | "waking" | "online" | "offline";

type Health = { status: string; version: string; engine: boolean; puzzles: number };

type BackendStore = {
  state: BackendState;
  health: Health | null;
  checkedAt: number;
};

export const useBackend = create<BackendStore>(() => ({
  state: API_URL ? "checking" : "disabled",
  health: null,
  checkedAt: 0,
}));

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function apiFetch<T>(path: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
  if (!API_URL) throw new ApiError("Backend not configured", 0);
  const { timeoutMs = 8000, signal, ...rest } = init;
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), timeoutMs);
  // The caller's signal (e.g. a closed replay) aborts the request too.
  const onAbort = () => ctrl.abort();
  if (signal?.aborted) ctrl.abort();
  else signal?.addEventListener("abort", onAbort, { once: true });
  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...rest,
      signal: ctrl.signal,
      headers: { Accept: "application/json", ...(rest.body ? { "Content-Type": "application/json" } : {}), ...rest.headers },
    });
    if (!res.ok) throw new ApiError(`HTTP ${res.status}`, res.status);
    return (await res.json()) as T;
  } catch (err) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    if (err instanceof ApiError) throw err;
    throw new ApiError(err instanceof Error ? err.message : "Network error", 0);
  } finally {
    window.clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

let inflight: Promise<boolean> | null = null;

/** Pings /api/health. A sleeping free-tier server may take ~30-60 s to wake up. */
export function checkBackend(): Promise<boolean> {
  if (!API_URL) return Promise.resolve(false);
  if (inflight) return inflight;
  if (useBackend.getState().state !== "online") useBackend.setState({ state: "checking" });
  const slow = window.setTimeout(() => {
    if (useBackend.getState().state === "checking") useBackend.setState({ state: "waking" });
  }, 2500);
  inflight = apiFetch<Health>("/api/health", { timeoutMs: 60_000 })
    .then((health) => {
      useBackend.setState({ state: "online", health, checkedAt: Date.now() });
      return true;
    })
    .catch(() => {
      useBackend.setState({ state: "offline", health: null, checkedAt: Date.now() });
      return false;
    })
    .finally(() => {
      window.clearTimeout(slow);
      inflight = null;
    });
  return inflight;
}

export function backendOnline(): boolean {
  return useBackend.getState().state === "online";
}
