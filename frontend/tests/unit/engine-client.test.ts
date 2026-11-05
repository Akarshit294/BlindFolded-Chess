// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EngineClient } from "@/lib/engine/engine";

/** A stand-in for the Stockfish worker that speaks just enough UCI. */
class FakeWorker {
  static all: FakeWorker[] = [];
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  sent: string[] = [];
  answerGo = true;
  constructor() {
    FakeWorker.all.push(this);
  }
  postMessage(cmd: string) {
    this.sent.push(cmd);
    const reply = (line: string) => queueMicrotask(() => this.onmessage?.({ data: line } as MessageEvent));
    if (cmd === "uci") reply("uciok");
    else if (cmd === "isready") reply("readyok");
    else if (cmd.startsWith("go") && this.answerGo) {
      reply("info depth 1 multipv 1 score cp 20 pv e2e4");
      reply("bestmove e2e4");
    } else if (cmd === "stop") reply("bestmove e2e4");
  }
  terminate() {}
}

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

describe("engine client", () => {
  beforeEach(() => {
    FakeWorker.all = [];
    vi.stubGlobal("Worker", FakeWorker);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("sends the game's moves so the engine sees repetitions", async () => {
    const engine = new EngineClient();
    const r = await engine.search(START, { depth: 1 }, { moves: ["g1f3", "g8f6", "f3g1", "f6g8"] });
    expect(r.bestmove).toBe("e2e4");
    expect(FakeWorker.all[0]!.sent).toContain("position startpos moves g1f3 g8f6 f3g1 f6g8");
    await engine.search(START, { depth: 1 });
    expect(FakeWorker.all[0]!.sent).toContain(`position fen ${START}`);
  });

  it("cancels a search when stop() comes while the engine is still loading", async () => {
    const engine = new EngineClient();
    const pending = engine.search(START, { depth: 1 });
    engine.stop();
    const r = await pending;
    expect(r.cancelled).toBe(true);
    expect(FakeWorker.all[0]!.sent.some((c) => c.startsWith("go"))).toBe(false);
  });

  it("fails a running search when the worker crashes, then starts a new worker", async () => {
    const engine = new EngineClient();
    await engine.init();
    const worker = FakeWorker.all[0]!;
    worker.answerGo = false;
    const pending = engine.search(START, { depth: 1 });
    await vi.waitFor(() => expect(worker.sent.some((c) => c.startsWith("go"))).toBe(true));
    worker.onerror?.(new ErrorEvent("error", { message: "wasm crashed" }));
    await expect(pending).rejects.toThrow("wasm crashed");
    expect(engine.status).toBe("error");
    const again = await engine.search(START, { depth: 1 });
    expect(again.bestmove).toBe("e2e4");
    expect(FakeWorker.all).toHaveLength(2);
  });
});
