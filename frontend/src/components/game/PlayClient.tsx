"use client";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useLayoutEffect, useRef } from "react";
import { Board } from "@/components/board/Board";
import { getEngine } from "@/lib/engine/engine";
import { VISIBILITY_MODES } from "@/lib/game/modes";
import { useGame } from "@/lib/game/store";
import type { Visibility } from "@/lib/storage/types";
import { GameScreen } from "./GameScreen";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/**
 * What the URL asks for. /play?new=1 (Play now, a mode card) always starts a fresh game, &mode= picks its
 * visibility; plain /play starts one from the remembered setup only when nothing is in progress.
 *
 * The parameters come from the router (useSearchParams), not window.location: on a client-side navigation this
 * can mount before the address bar changes, and a one-shot read of window.location then missed ?new=1. Acting on
 * every change of the parameters makes the order irrelevant.
 */
function PlayIntent() {
  const params = useSearchParams();
  const hydrated = useGame((s) => s.hydrated);
  const fresh = params.get("new") === "1";
  const mode = params.get("mode");
  const handled = useRef<string | null>(null);

  // A layout effect, so a fresh game replaces the one in progress before the first paint (no flash of the old board).
  useLayoutEffect(() => {
    if (!hydrated) return;
    const st = useGame.getState();
    if (!fresh && !mode) {
      handled.current = null;
      if (!st.game) st.startFromSetup();
      return;
    }
    const key = `${fresh}|${mode}`;
    if (handled.current === key) return;
    handled.current = key;
    const visibility = VISIBILITY_MODES.some((m) => m.id === mode) ? (mode as Visibility) : undefined;
    if (fresh || !st.game) st.startFromSetup(visibility ? { visibility } : undefined);
    // Drop the one-shot parameters so a reload restores the game instead of starting another. The state must be
    // null: Next.js only syncs its router with a replaceState that does not carry its own history state, and an
    // unsynced router writes the old URL back on its next update.
    const rest = new URLSearchParams(params.toString());
    rest.delete("new");
    rest.delete("mode");
    const q = rest.toString();
    window.history.replaceState(null, "", `/play${q ? `?${q}` : ""}`);
  }, [hydrated, fresh, mode, params]);

  return null;
}

/** /play is board first: the game (or its server-rendered skeleton) with the URL's intent applied beside it. */
export function PlayClient() {
  const hydrated = useGame((s) => s.hydrated);
  const game = useGame((s) => s.game);

  useEffect(() => {
    void useGame.persist.rehydrate();
    // Warm the engine up (lazy: only on the Play page).
    const t = window.setTimeout(() => void getEngine().init().catch(() => undefined), 400);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <>
      <Suspense fallback={null}>
        <PlayIntent />
      </Suspense>
      <PlayView hydrated={hydrated} gameId={game?.id ?? null} />
    </>
  );
}

function PlayView({ hydrated, gameId }: { hydrated: boolean; gameId: string | null }) {
  if (!hydrated || !gameId) {
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
  return <GameScreen key={gameId} />;
}
