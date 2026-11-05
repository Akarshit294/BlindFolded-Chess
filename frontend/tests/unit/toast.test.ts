import { afterEach, describe, expect, it, vi } from "vitest";
import { toast, useToasts } from "@/lib/ui/toast";

afterEach(() => {
  useToasts.getState().clear();
  vi.useRealTimers();
});

describe("toasts", () => {
  it("shows a message and dismisses it after its duration", () => {
    vi.useFakeTimers();
    vi.stubGlobal("window", globalThis);
    toast("Move taken back.", { duration: 1000 });
    expect(useToasts.getState().toasts.map((t) => t.text)).toEqual(["Move taken back."]);
    vi.advanceTimersByTime(1001);
    expect(useToasts.getState().toasts).toEqual([]);
    vi.unstubAllGlobals();
  });

  it("never stacks the same text twice and keeps at most three", () => {
    for (const t of ["a", "b", "a", "c", "d"]) useToasts.getState().push({ id: Math.random(), text: t, tone: "info" });
    expect(useToasts.getState().toasts.map((t) => t.text)).toEqual(["a", "c", "d"]);
  });
});
