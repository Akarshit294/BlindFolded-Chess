"use client";
import { useEffect, useState } from "react";
import { getEngine } from "@/lib/engine/engine";
import { useGame } from "@/lib/game/store";
import { GameScreen } from "./GameScreen";
import { GameSetup, PlayHeader } from "./GameSetup";

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
    // Same header as the setup screen (server-rendered), skeletons where the cards will be.
    return (
      <div className="mx-auto w-full max-w-5xl px-4 pb-10 pt-8 sm:px-6" aria-busy="true">
        <PlayHeader />
        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="skeleton h-[460px] rounded-2xl" />
          <div className="skeleton h-[460px] rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!game) {
    return (
      <GameSetup
        onStart={(config) => {
          useGame.getState().start(config);
          // The setup screen is long on phones; start the game at the top with the board in view.
          window.scrollTo({ top: 0, behavior: "instant" });
        }}
      />
    );
  }
  return (
    <GameScreen
      key={game.id}
      onNewSetup={() => {
        force((n) => n + 1);
        window.scrollTo({ top: 0, behavior: "instant" });
      }}
    />
  );
}
