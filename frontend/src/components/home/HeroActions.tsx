"use client";
import { useEffect, useState } from "react";
import { describeSetup, SetupControls } from "@/components/game/SetupControls";
import { LinkButton } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { getLevel } from "@/lib/engine/levels";
import { modeName } from "@/lib/game/modes";
import { isResumable, useGame } from "@/lib/game/store";

/**
 * The hero's actions. "Play now" is a plain link to /play?new=1 (it works before hydration and gets the board
 * morph); /play starts the game from the remembered setup. A game in progress turns it into "Continue game".
 */
export function HeroActions() {
  const hydrated = useGame((s) => s.hydrated);
  const game = useGame((s) => s.game);
  const setup = useGame((s) => s.setup);
  const setSetup = useGame((s) => s.setSetup);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    void useGame.persist.rehydrate();
  }, []);

  const resumable = hydrated && isResumable(game);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        {resumable ? (
          <>
            <LinkButton href="/play" variant="primary" size="lg" transitionTypes={["enter-game"]} data-testid="continue-game">
              Continue game
            </LinkButton>
            <LinkButton href="/play?new=1" size="lg" transitionTypes={["enter-game"]} data-testid="play-now">
              New game
            </LinkButton>
          </>
        ) : (
          <>
            <LinkButton href="/play?new=1" variant="primary" size="lg" transitionTypes={["enter-game"]} data-testid="play-now">
              Play now
            </LinkButton>
            <LinkButton href="/train" size="lg">
              Warm up with a drill
            </LinkButton>
          </>
        )}
      </div>
      <p className="mt-5 max-w-md text-small text-muted" data-testid="setup-summary">
        {resumable
          ? `Move ${Math.ceil((game.moves.length + 1) / 2)} of your ${modeName(game.config.visibility)} game against ${getLevel(game.config.levelId).name}.`
          : describeSetup(setup)}{" "}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="cursor-pointer rounded font-semibold text-ink underline decoration-line-strong underline-offset-4 transition-colors hover:decoration-ink"
          data-testid="change-setup"
        >
          Change
        </button>
      </p>

      <Modal open={open} onClose={() => setOpen(false)} title="Your next game" description="Changes are saved for next time." closeButton className="sm:max-w-lg">
        <SetupControls setup={setup} onChange={setSetup} />
        <div className="mt-7 flex flex-wrap justify-end gap-3">
          <LinkButton href="/play?new=1" variant="primary" transitionTypes={["enter-game"]} onClick={() => setOpen(false)} data-testid="setup-play">
            Play this setup
          </LinkButton>
        </div>
      </Modal>
    </div>
  );
}
