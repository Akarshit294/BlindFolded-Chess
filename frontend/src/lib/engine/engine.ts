/**
 * A small UCI client around the Stockfish WASM Web Worker.
 *
 * - The worker (and its ~1.9 MB wasm) is created lazily on first use.
 * - Searches are serialised through a queue; `stop()` cancels the running search.
 * - The single-threaded lite build needs no cross-origin isolation headers.
 */
import { getLevel, sampleMove, type EngineLevel } from "./levels";

export type Score = { cp: number | null; mate: number | null };
export type InfoLine = { depth: number; multipv: number; score: Score; pv: string[]; bound?: "lower" | "upper" };
export type SearchResult = { bestmove: string | null; lines: InfoLine[]; cancelled: boolean };
export type SearchLimits = { depth?: number; movetime?: number; nodes?: number };

type Job = {
  fen: string;
  /** Moves from the standard start; when given the engine sees the history (repetitions). */
  moves?: string[];
  options: Record<string, string>;
  limits: SearchLimits;
  multipv: number;
  onInfo?: (line: InfoLine) => void;
  resolve: (r: SearchResult) => void;
  reject: (e: unknown) => void;
  lines: Map<number, InfoLine>;
  cancelled: boolean;
  started: boolean;
};

export type EngineStatus = "idle" | "loading" | "ready" | "error";

const ENGINE_URL = "/engine/stockfish.js";

export function parseInfo(line: string): InfoLine | null {
  if (!line.startsWith("info ") || !line.includes(" score ")) return null;
  const tokens = line.split(/\s+/);
  let depth = 0;
  let multipv = 1;
  const score: Score = { cp: null, mate: null };
  let pv: string[] = [];
  let bound: InfoLine["bound"];
  for (let i = 1; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === "depth") depth = Number(tokens[++i]);
    else if (t === "multipv") multipv = Number(tokens[++i]);
    else if (t === "score") {
      const kind = tokens[++i];
      const value = Number(tokens[++i]);
      if (kind === "cp") score.cp = value;
      else if (kind === "mate") score.mate = value;
      const next = tokens[i + 1];
      if (next === "lowerbound" || next === "upperbound") {
        bound = next === "lowerbound" ? "lower" : "upper";
        i++;
      }
    } else if (t === "pv") {
      pv = tokens.slice(i + 1);
      break;
    }
  }
  return { depth, multipv, score, pv, bound };
}

export class EngineClient {
  private worker: Worker | null = null;
  private initPromise: Promise<void> | null = null;
  private queue: Job[] = [];
  private current: Job | null = null;
  private appliedOptions = new Map<string, string>();
  private readyWaiters: Array<() => void> = [];
  private uciWaiters: Array<() => void> = [];
  private statusListeners = new Set<(s: EngineStatus) => void>();
  /** Bumped by stop(): searches requested before it are cancelled even if still starting. */
  private epoch = 0;
  status: EngineStatus = "idle";

  onStatus(fn: (s: EngineStatus) => void): () => void {
    this.statusListeners.add(fn);
    fn(this.status);
    return () => this.statusListeners.delete(fn);
  }

  private setStatus(s: EngineStatus) {
    this.status = s;
    for (const fn of this.statusListeners) fn(s);
  }

  init(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.setStatus("loading");
    this.initPromise = new Promise<void>((resolve, reject) => {
      try {
        const worker = new Worker(ENGINE_URL);
        this.worker = worker;
        const timeout = setTimeout(() => {
          this.setStatus("error");
          reject(new Error("Engine did not start in time"));
        }, 30_000);
        worker.onmessage = (e: MessageEvent) => this.onLine(String(e.data));
        worker.onerror = (e) => {
          clearTimeout(timeout);
          const err = e instanceof ErrorEvent ? new Error(e.message) : new Error("Engine worker failed");
          reject(err);
          // A crash after start-up must not leave a search waiting forever: fail what is
          // pending and start a fresh worker on the next request.
          this.reset(err);
          this.setStatus("error");
        };
        this.uciWaiters.push(() => {
          this.post("setoption name Hash value 32");
          this.waitReady().then(() => {
            clearTimeout(timeout);
            this.setStatus("ready");
            resolve();
          }, reject);
        });
        this.post("uci");
      } catch (err) {
        this.setStatus("error");
        reject(err);
      }
    });
    this.initPromise.catch(() => {
      this.initPromise = null;
    });
    return this.initPromise;
  }

  private reset(err: Error) {
    const pending = [...(this.current ? [this.current] : []), ...this.queue];
    this.current = null;
    this.queue = [];
    this.readyWaiters = [];
    this.uciWaiters = [];
    this.worker?.terminate();
    this.worker = null;
    this.initPromise = null;
    this.appliedOptions.clear();
    for (const job of pending) job.reject(err);
  }

  private post(cmd: string) {
    this.worker?.postMessage(cmd);
  }

  private waitReady(): Promise<void> {
    return new Promise((resolve) => {
      this.readyWaiters.push(resolve);
      this.post("isready");
    });
  }

  private onLine(line: string) {
    if (line === "uciok") {
      const waiters = this.uciWaiters.splice(0);
      waiters.forEach((w) => w());
      return;
    }
    if (line === "readyok") {
      const w = this.readyWaiters.shift();
      w?.();
      return;
    }
    const job = this.current;
    if (!job) return;
    if (line.startsWith("info ")) {
      const info = parseInfo(line);
      if (info && info.pv.length > 0) {
        job.lines.set(info.multipv, info);
        job.onInfo?.(info);
      }
      return;
    }
    if (line.startsWith("bestmove")) {
      const move = line.split(/\s+/)[1];
      const lines = [...job.lines.values()].sort((a, b) => a.multipv - b.multipv);
      this.current = null;
      job.resolve({ bestmove: move && move !== "(none)" ? move : null, lines, cancelled: job.cancelled });
      this.pump();
    }
  }

  private pump() {
    if (this.current || this.queue.length === 0) return;
    const job = this.queue.shift()!;
    if (job.cancelled) {
      job.resolve({ bestmove: null, lines: [], cancelled: true });
      this.pump();
      return;
    }
    this.current = job;
    job.started = true;
    for (const [name, value] of Object.entries(job.options)) {
      if (this.appliedOptions.get(name) === value) continue;
      this.post(`setoption name ${name} value ${value}`);
      this.appliedOptions.set(name, value);
    }
    this.post(job.moves?.length ? `position startpos moves ${job.moves.join(" ")}` : `position fen ${job.fen}`);
    const parts = ["go"];
    if (job.limits.depth) parts.push("depth", String(job.limits.depth));
    if (job.limits.movetime) parts.push("movetime", String(job.limits.movetime));
    if (job.limits.nodes) parts.push("nodes", String(job.limits.nodes));
    if (parts.length === 1) parts.push("depth", "12");
    this.post(parts.join(" "));
  }

  /** Runs a search. Resolves when Stockfish answers `bestmove` (also after `stop()`). */
  async search(
    fen: string,
    limits: SearchLimits,
    opts: { multipv?: number; options?: Record<string, string>; onInfo?: (l: InfoLine) => void; moves?: string[] } = {},
  ): Promise<SearchResult> {
    const epoch = this.epoch;
    await this.init();
    // stop() while the engine was still loading cancels this search as well.
    if (epoch !== this.epoch) return { bestmove: null, lines: [], cancelled: true };
    if (!this.worker) throw new Error("Engine worker failed");
    const multipv = opts.multipv ?? 1;
    return new Promise<SearchResult>((resolve, reject) => {
      this.queue.push({
        fen,
        moves: opts.moves,
        limits,
        multipv,
        options: { MultiPV: String(multipv), ...(opts.options ?? {}) },
        onInfo: opts.onInfo,
        resolve,
        reject,
        lines: new Map(),
        cancelled: false,
        started: false,
      });
      this.pump();
    });
  }

  /** Cancels queued searches and stops the running one. */
  stop() {
    this.epoch++;
    for (const job of this.queue) job.cancelled = true;
    if (this.current) {
      this.current.cancelled = true;
      this.post("stop");
    }
  }

  newGame() {
    this.stop();
    this.post("ucinewgame");
    this.appliedOptions.delete("Clear Hash");
  }

  terminate() {
    this.stop();
    this.worker?.terminate();
    this.worker = null;
    this.initPromise = null;
    this.current = null;
    this.queue = [];
    this.appliedOptions.clear();
    this.setStatus("idle");
  }
}

let shared: EngineClient | null = null;
/** App-wide engine instance (one worker for play, hints and analysis). */
export function getEngine(): EngineClient {
  if (!shared) shared = new EngineClient();
  return shared;
}

const FULL_STRENGTH = { UCI_LimitStrength: "false", "Skill Level": "20" };

/**
 * Picks the engine's move for a level. Returns UCI or null (no legal moves / cancelled).
 * Pass the game's `moves` (from the standard start) so the engine can see repetitions.
 */
export async function pickEngineMove(
  fen: string,
  levelId: number,
  opts: { timeBudgetMs?: number; rand?: () => number; engine?: EngineClient; moves?: string[] } = {},
): Promise<{ uci: string | null; cancelled: boolean; level: EngineLevel }> {
  const engine = opts.engine ?? getEngine();
  const level = getLevel(levelId);
  const budget = opts.timeBudgetMs;
  const cap = (ms: number | undefined) => (ms && budget ? Math.max(50, Math.min(ms, budget)) : ms);

  if (level.sample) {
    const res = await engine.search(
      fen,
      { depth: level.depth ?? 4, movetime: cap(2000) },
      { multipv: level.sample.multipv, options: FULL_STRENGTH, moves: opts.moves },
    );
    if (res.cancelled) return { uci: null, cancelled: true, level };
    const lines = res.lines
      .filter((l) => l.pv[0])
      .map((l) => ({
        move: l.pv[0]!,
        cp: l.score.mate !== null ? (l.score.mate > 0 ? 3000 - l.score.mate : -3000 - l.score.mate) : (l.score.cp ?? 0),
      }));
    const choice = sampleMove(lines, level.sample.temperature, level.sample.blunderChance, opts.rand) ?? res.bestmove;
    return { uci: choice, cancelled: false, level };
  }

  const options: Record<string, string> = level.uciElo
    ? { UCI_LimitStrength: "true", UCI_Elo: String(level.uciElo), "Skill Level": "20" }
    : FULL_STRENGTH;
  const res = await engine.search(fen, { movetime: cap(level.movetime ?? 800) }, { multipv: 1, options, moves: opts.moves });
  return { uci: res.bestmove, cancelled: res.cancelled, level };
}

/** Full-strength evaluation of a position, White's point of view. */
export async function evaluatePosition(
  fen: string,
  limits: SearchLimits,
  engine: EngineClient = getEngine(),
): Promise<{ score: Score; best: string | null; pv: string[]; cancelled: boolean }> {
  const res = await engine.search(fen, limits, { multipv: 1, options: FULL_STRENGTH });
  const line = res.lines[0];
  const whiteToMove = fen.split(" ")[1] !== "b";
  const sign = whiteToMove ? 1 : -1;
  const score: Score = line
    ? { cp: line.score.cp === null ? null : line.score.cp * sign, mate: line.score.mate === null ? null : line.score.mate * sign }
    : { cp: 0, mate: null };
  return { score, best: res.bestmove, pv: line?.pv ?? [], cancelled: res.cancelled };
}
