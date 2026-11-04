"use client";
/**
 * The landing-page board: plays Morphy's "Opera Game" (Paris, 1858 — public domain) while the
 * pieces dissolve into fog move by move. Hover or focus lifts the fog.
 */
import { Chess, type Move, type Square } from "chess.js";
import { AnimatePresence, motion, useInView } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Board } from "@/components/board/Board";
import { EyeMorph } from "@/components/ui/EyeMorph";
import { cn } from "@/lib/utils/cn";

const OPERA = [
  "e4", "e5", "Nf3", "d6", "d4", "Bg4", "dxe5", "Bxf3", "Qxf3", "dxe5", "Bc4", "Nf6", "Qb3", "Qe7", "Nc3", "c6", "Bg5", "b5",
  "Nxb5", "cxb5", "Bxb5+", "Nbd7", "O-O-O", "Rd8", "Rxd7", "Rxd7", "Rd1", "Qe6", "Bxd7+", "Nxd7", "Qb8+", "Nxb8", "Rd8#",
];

function positions(): { fens: string[]; moves: Move[] } {
  const chess = new Chess();
  const fens = [chess.fen()];
  const moves: Move[] = [];
  for (const san of OPERA) {
    moves.push(chess.move(san));
    fens.push(chess.fen());
  }
  return { fens, moves };
}

export function HeroBoard() {
  const { fens, moves } = useMemo(() => positions(), []);
  const [ply, setPly] = useState(0);
  const [lifted, setLifted] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const inView = useInView(wrap, { margin: "-10% 0px" });
  const done = ply >= OPERA.length;

  useEffect(() => {
    if (!inView) return;
    const delay = done ? 5200 : ply === 0 ? 1200 : ply < 6 ? 1100 : 1600;
    const t = window.setTimeout(() => setPly((p) => (p >= OPERA.length ? 0 : p + 1)), delay);
    return () => window.clearTimeout(t);
  }, [ply, inView, done]);

  const last = ply > 0 ? moves[ply - 1]! : null;
  // The fog creeps in after the opening moves; the final mate is revealed.
  const fogging = ply >= 6 && !done;
  const mated = done ? (new Chess(fens[ply]).findPiece({ type: "k", color: "b" })[0] as Square) : null;

  return (
    <div ref={wrap} className="relative">
      <div
        className="group relative mx-auto w-full max-w-[540px]"
        onMouseEnter={() => setLifted(true)}
        onMouseLeave={() => setLifted(false)}
        onFocus={() => setLifted(true)}
        onBlur={() => setLifted(false)}
      >
        {/* Halo behind the board */}
        <div aria-hidden="true" className="absolute -inset-10 rounded-[40px] bg-[radial-gradient(closest-side,rgba(124,133,223,0.35),transparent)] blur-2xl" />
        <motion.div
          initial={{ opacity: 0, y: 30, rotateX: 14, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, rotateX: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 120, damping: 20, delay: 0.15 }}
          style={{ transformPerspective: 1400 }}
          className="relative"
        >
          <Board
            fen={fens[ply]!}
            lastMove={last ? { from: last.from, to: last.to, flags: last.flags, captured: last.captured, promotion: last.promotion } : null}
            visibility={fogging ? "ghost" : "full"}
            reveal={lifted || done}
            ghostDelayMs={700}
            interactive={false}
            matedSquare={mated}
            speed={done ? "slow" : "normal"}
            ariaLabel="Demo board playing the Opera Game, Paris 1858"
          />
        </motion.div>
      </div>
      <div className="mx-auto mt-5 flex max-w-[540px] items-center justify-between gap-4 text-sm">
        <div className="min-w-0">
          <div className="truncate text-ivory-400">Morphy vs. Duke Karl &amp; Count Isouard · Paris, 1858</div>
          <div className="mt-0.5 h-6 font-mono text-ivory-50" aria-live="off">
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={ply} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }} className="inline-block">
                {last ? `${Math.ceil(ply / 2)}.${last.color === "b" ? ".." : ""} ${last.san}` : "Starting position"}
              </motion.span>
            </AnimatePresence>
          </div>
        </div>
        <div className={cn("flex shrink-0 items-center gap-2 rounded-full px-3 py-1 text-xs ring-1 ring-inset transition-colors", fogging && !lifted ? "text-moon-200 ring-moon-400/30" : "text-ivory-400 ring-ivory-100/10")}>
          <EyeMorph closed={fogging && !lifted} size={16} />
          {done ? "Checkmate" : fogging ? (lifted ? "Fog lifted" : "Hover to lift the fog") : "Watch closely…"}
        </div>
      </div>
    </div>
  );
}
