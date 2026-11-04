"use client";
import { useEffect, useState } from "react";
import { getEngine } from "@/lib/engine/engine";
import { useGame } from "@/lib/game/store";
import { GameScreen } from "./GameScreen";
import { GameSetup } from "./GameSetup";

export function PlayClient() {
  const hydrated = useGame((s) => s.hydrated);
  const game = useGame((s) => s.game);
  const [, force] = useState(0);

  useEffect(() => {
    void useGame.persist.rehydrate();
    // Warm the engine up while the user picks settings (lazy: only on the Play page).
    const t = window.setTimeout(() => void getEngine().init().catch(() => undefined), 600);
    return () => window.clearTimeout(t);
  }, []);

  if (!hydrated) {
    return (
      <div className="mx-auto grid max-w-5xl gap-6 px-4 pt-8 sm:px-6 lg:grid-cols-[1.4fr_1fr]" aria-busy="true" aria-label="Loading">
        <div className="skeleton h-12 w-2/3 lg:col-span-2" />
        <div className="skeleton h-[420px]" />
        <div className="skeleton h-[420px]" />
      </div>
    );
  }

  if (!game) {
    return <GameSetup onStart={(config) => useGame.getState().start(config)} />;
  }
  return <GameScreen key={game.id} onNewSetup={() => force((n) => n + 1)} />;
}
