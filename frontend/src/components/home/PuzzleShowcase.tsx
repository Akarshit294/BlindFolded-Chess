"use client";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Button, LinkButton } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Controls";
import { SectionTitle } from "@/components/ui/Display";
import { cn } from "@/lib/utils/cn";
import { MiniBoard, type MiniPiece } from "./MiniBoard";

// The back-rank mate: 6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1, Re8#.
const POSITION: MiniPiece[] = [
  { at: [0, 6], p: "bK" },
  { at: [1, 5], p: "bP" },
  { at: [1, 6], p: "bP" },
  { at: [1, 7], p: "bP" },
  { at: [6, 5], p: "wP" },
  { at: [6, 6], p: "wP" },
  { at: [6, 7], p: "wP" },
  { at: [7, 4], p: "wR" },
  { at: [7, 6], p: "wK" },
];

export function PuzzleShowcase() {
  const [shown, setShown] = useState(false);
  return (
    <section aria-labelledby="puzzle-title" className="px-5 sm:px-8 lg:px-12">
      <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
        <div>
          <SectionTitle thin="Puzzles in" bold="words only" id="puzzle-title" />
          <p className="mt-4 max-w-xl text-body text-fg">
            Thousands of real puzzles from the Lichess database, picked to be solvable blindfold. The position is read to you; the board stays hidden unless
            you peek.
          </p>
          <div className="glass-panel mt-8 max-w-xl rounded-panel p-5 sm:p-6">
            <div className="flex flex-wrap gap-2">
              <Badge tone="ink">Mate in 1</Badge>
              <Badge>White to move</Badge>
            </div>
            <dl className="mt-4 space-y-2 text-[0.9375rem]">
              <div className="flex gap-3">
                <dt className="w-14 shrink-0 font-semibold text-ink">White</dt>
                <dd className="text-fg">King g1, rook e1, pawns f2, g2, h2</dd>
              </div>
              <div className="flex gap-3">
                <dt className="w-14 shrink-0 font-semibold text-ink">Black</dt>
                <dd className="text-fg">King g8, pawns f7, g7, h7</dd>
              </div>
            </dl>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button size="sm" variant={shown ? "secondary" : "primary"} onClick={() => setShown((s) => !s)} aria-expanded={shown}>
                {shown ? "Hide the answer" : "Show the answer"}
              </Button>
              <LinkButton href="/puzzles" size="sm" variant="ghost">
                Solve real puzzles
              </LinkButton>
            </div>
            <AnimatePresence initial={false}>
              {shown ? (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden text-[0.9375rem] text-fg"
                >
                  <span className="block pt-4">
                    <strong className="text-ink">Re8#.</strong> The rook reaches the back rank and the king&apos;s own pawns block every escape.
                  </span>
                </motion.p>
              ) : null}
            </AnimatePresence>
          </div>
        </div>
        <div className="relative mx-auto w-full max-w-[22rem]">
          <MiniBoard size={8} pieces={POSITION} label={shown ? "The position after White's rook reaches e8: checkmate" : undefined} className={cn("transition-[filter,opacity] duration-700", !shown && "opacity-0")}>
            {shown ? (
              <svg viewBox="0 0 8 8" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
                <path d="M4.5 7.5 L4.5 0.95" stroke="var(--ink)" strokeWidth="0.16" strokeLinecap="round" pathLength={100} className={"demo-draw"} fill="none" />
                <path d="M4.18 1.25 L4.5 0.62 L4.82 1.25 Z" fill="var(--ink)" />
              </svg>
            ) : null}
          </MiniBoard>
          {/* Until the reveal, the board is a melted pool. */}
          <div className={cn("absolute inset-0 flex items-center justify-center overflow-hidden transition-opacity duration-700", shown && "pointer-events-none opacity-0")} aria-hidden="true">
            <img src="/3d/hero/light-melted-720.webp" alt="" loading="lazy" className="theme-light-only h-full w-full scale-[1.3] object-cover [mask-image:radial-gradient(closest-side,black_70%,transparent)]" />
            <img src="/3d/hero/dark-melted-720.webp" alt="" loading="lazy" className="theme-dark-only h-full w-full scale-[1.3] object-cover [mask-image:radial-gradient(closest-side,black_70%,transparent)]" />
          </div>
        </div>
      </div>
    </section>
  );
}
