"use client";
import { useEffect, useRef } from "react";
import { Board } from "@/components/board/Board";
import { getEngine } from "@/lib/engine/engine";
import { VISIBILITY_MODES } from "@/lib/game/modes";
import { useGame } from "@/lib/game/store";
import type { Visibility } from "@/lib/storage/types";
import { GameScreen } from "./GameScreen";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/**
 * /play is board first. With nothing in progress it starts a game from the remembered setup straight away, so
 * the first move is the start. /play?new=1 (Play now) always starts a fresh one; &mode= picks the visibility.
 */
export function PlayClient() {
  const hydrated = useGame((s) => s.hydrated);
  const game = useGame((s) => s.game);
  const started = useRef(false);

  useEffect(() => {
    void useGame.persist.rehydrate();
    // Warm the engine up (lazy: only on the Play page).
    const t = window.setTimeout(() => void getEngine().init().catch(() => undefined), 400);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!hydrated || started.current) return;
    started.current = true;
    const params = new URLSearchParams(window.location.search);
    const fresh = params.get("new") === "1";
    const mode = params.get("mode");
    const visibility = VISIBILITY_MODES.some((m) => m.id === mode) ? (mode as Visibility) : undefined;
    const st = useGame.getState();
    if (fresh || !st.game) st.startFromSetup(visibility ? { visibility } : undefined);
    if (fresh || mode) {
      // Drop the one-shot parameters so a reload restores the game instead of starting another.
      params.delete("new");
      params.delete("mode");
      const q = params.toString();
      window.history.replaceState(window.history.state, "", `/play${q ? `?${q}` : ""}`);
    }
  }, [hydrated]);

  if (!hydrated || !game) {
    // Same layout as the game, server-rendered: the board is there before anything loads.
    return (
      <div className="px-3 pb-10 pt-2 sm:px-6 lg:px-10" aria-busy="true">
        <h1 className="sr-only">Play blindfold chess</h1>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-start lg:gap-8 xl:grid-cols-[minmax(0,1fr)_25rem]">
          <div className="mx-auto w-full max-w-[min(100%,calc(100dvh-14rem))] lg:max-w-[min(100%,calc(100dvh-13rem))]">
            <div className="skeleton h-10 w-48 rounded-full" />
            <div className="my-3">
              <Board fen={START} interactive={false} ariaLabel="Chessboard (loading)" />
            </div>
            <div className="skeleton h-10 w-40 rounded-full" />
          </div>
          <div className="flex flex-col gap-4">
            <div className="skeleton h-44 rounded-panel" />
            <div className="skeleton h-72 rounded-panel" />
          </div>
        </div>
      </div>
    );
  }
  return <GameScreen key={game.id} />;
}
