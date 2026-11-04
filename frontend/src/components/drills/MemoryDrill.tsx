"use client";
import type { PieceSymbol, Square } from "chess.js";
import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { Board, type SquareMark } from "@/components/board/Board";
import { PieceGlyph } from "@/components/board/PieceGlyph";
import { Button } from "@/components/ui/Button";
import { IconTrash } from "@/components/ui/Icons";
import { PIECE_NAMES } from "@/lib/chess/notation";
import { boardMapFromFen, scoreMemory } from "@/lib/drills/generators";
import { getPosition } from "@/lib/drills/source";
import { useSettings } from "@/lib/settings/store";
import { cn } from "@/lib/utils/cn";
import { DrillRunner, type DrillMeta, type QuestionProps } from "./DrillRunner";
import { Prompt } from "./shared";

export const MEMORY_META: DrillMeta = {
  id: "memory",
  title: "Memory",
  tagline: "A position appears for a few seconds. Then the board clears — rebuild it piece by piece.",
  levels: [
    { name: "Glimpse", blurb: "4 pieces, 10 seconds." },
    { name: "Snapshot", blurb: "6 pieces, 10 seconds." },
    { name: "Scene", blurb: "8 pieces, 8 seconds." },
    { name: "Middlegame", blurb: "12 pieces, 8 seconds." },
    { name: "Photographic", blurb: "16 pieces, 6 seconds." },
  ],
  timedSeconds: 240,
  standardCount: 5,
  unit: "positions",
};

const PIECES = [4, 6, 8, 12, 16];
const SECONDS = [10, 10, 8, 8, 6];

type MemoryQ = { fen: string; seconds: number };

async function generate(level: number, _rng: unknown, seed: number): Promise<MemoryQ> {
  const { fen } = await getPosition(PIECES[level - 1] ?? 6, seed);
  return { fen, seconds: SECONDS[level - 1] ?? 8 };
}

export function fenFromMap(map: Map<Square, string>): string {
  const rows: string[] = [];
  for (let r = 8; r >= 1; r--) {
    let row = "";
    let empty = 0;
    for (const f of "abcdefgh") {
      const p = map.get(`${f}${r}` as Square);
      if (!p) {
        empty++;
        continue;
      }
      if (empty) row += String(empty);
      empty = 0;
      row += p[0] === "w" ? p[1]!.toUpperCase() : p[1]!;
    }
    if (empty) row += String(empty);
    rows.push(row);
  }
  return `${rows.join("/")} w - - 0 1`;
}

const TYPES: PieceSymbol[] = ["k", "q", "r", "b", "n", "p"];

function Question({ q, locked, onAnswer }: QuestionProps<MemoryQ>) {
  const set = useSettings((s) => s.pieceSet);
  const [phase, setPhase] = useState<"study" | "build">("study");
  const [left, setLeft] = useState(q.seconds);
  const [tool, setTool] = useState<string>("wp");
  const [placed, setPlaced] = useState<Map<Square, string>>(new Map());
  const target = useMemo(() => boardMapFromFen(q.fen), [q.fen]);

  useEffect(() => {
    if (phase !== "study") return;
    const t = window.setTimeout(() => {
      if (left <= 1) setPhase("build");
      else setLeft(left - 1);
    }, 1000);
    return () => window.clearTimeout(t);
  }, [phase, left]);

  const score = locked ? scoreMemory(target, placed) : null;
  const marks: Partial<Record<Square, SquareMark>> = {};
  if (score) {
    for (const [sq, p] of target) marks[sq] = placed.get(sq) === p ? "good" : "bad";
    for (const sq of score.extra) marks[sq] = "bad";
  }

  if (phase === "study") {
    return (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,460px)] md:items-start">
        <div>
          <Prompt sub="Memorise every piece and square.">Study the position</Prompt>
          <div className="flex items-center gap-4">
            <div className="relative h-16 w-16">
              <svg viewBox="0 0 36 36" className="h-16 w-16 -rotate-90">
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--color-night-600)" strokeWidth="3" />
                <motion.circle
                  cx="18"
                  cy="18"
                  r="15.5"
                  fill="none"
                  stroke="var(--color-ember-400)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  initial={{ pathLength: 1 }}
                  animate={{ pathLength: 0 }}
                  transition={{ duration: q.seconds, ease: "linear" }}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center font-mono text-xl font-semibold text-ivory-50" data-testid="memory-countdown">
                {left}
              </span>
            </div>
            <Button onClick={() => setPhase("build")} data-testid="memory-ready">
              I&apos;ve got it
            </Button>
          </div>
        </div>
        <Board fen={q.fen} interactive={false} ariaLabel="Position to memorise" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,460px)] md:items-start">
      <div>
        <Prompt sub="Pick a piece, then click squares to place it. Click again to remove.">Rebuild it</Prompt>
        <div className="space-y-2" role="radiogroup" aria-label="Piece to place">
          {(["w", "b"] as const).map((c) => (
            <div key={c} className="grid grid-cols-7 gap-1.5">
              {TYPES.map((t) => {
                const id = `${c}${t}`;
                return (
                  <motion.button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={tool === id}
                    aria-label={`${c === "w" ? "White" : "Black"} ${PIECE_NAMES[t]}`}
                    data-testid={`tool-${id}`}
                    disabled={locked}
                    onClick={() => setTool(id)}
                    whileTap={{ scale: 0.9 }}
                    className={cn(
                      "aspect-square rounded-xl p-1 outline-none ring-1 ring-inset transition-colors focus-visible:ring-2 focus-visible:ring-moon-300",
                      tool === id ? "bg-ember-400/25 ring-ember-400/70" : "bg-night-750 ring-ivory-100/10 hover:bg-night-600",
                    )}
                  >
                    <PieceGlyph set={set} color={c} type={t} className="h-full w-full" />
                  </motion.button>
                );
              })}
              {c === "w" ? (
                <motion.button
                  type="button"
                  role="radio"
                  aria-checked={tool === "erase"}
                  aria-label="Eraser"
                  disabled={locked}
                  onClick={() => setTool("erase")}
                  whileTap={{ scale: 0.9 }}
                  className={cn(
                    "row-span-2 flex items-center justify-center rounded-xl outline-none ring-1 ring-inset",
                    tool === "erase" ? "bg-coral-400/25 text-coral-200 ring-coral-400/60" : "bg-night-750 text-ivory-300 ring-ivory-100/10",
                  )}
                >
                  <IconTrash />
                </motion.button>
              ) : null}
            </div>
          ))}
        </div>
        <div className="mt-5 flex items-center gap-3">
          <Button
            variant="primary"
            size="lg"
            disabled={locked}
            data-testid="memory-check"
            onClick={() => {
              const s = scoreMemory(target, placed);
              onAnswer({
                correct: s.accuracy === 1,
                credit: s.accuracy,
                hold: true,
                expected: `${s.correct} of ${target.size} pieces right${s.extra.length ? `, ${s.extra.length} extra` : ""}.`,
                note: s.missing.length || s.wrong.length ? `Missed: ${[...s.missing, ...s.wrong].join(", ")}` : undefined,
              });
            }}
          >
            Check
          </Button>
          <span className="text-sm text-ivory-400">
            {placed.size} / {target.size} placed
          </span>
        </div>
      </div>
      <div className="space-y-3">
        <Board
          fen={locked ? q.fen : fenFromMap(placed)}
          interactive={false}
          marks={marks}
          onSquareClick={
            locked
              ? undefined
              : (sq) => {
                  setPlaced((cur) => {
                    const next = new Map(cur);
                    if (tool === "erase" || next.get(sq) === tool) next.delete(sq);
                    else next.set(sq, tool);
                    return next;
                  });
                }
          }
          ariaLabel="Rebuild board"
        />
        {locked ? <p className="text-center text-xs text-ivory-500">Showing the original position — green squares you got right.</p> : null}
      </div>
    </div>
  );
}

export function MemoryDrill() {
  return <DrillRunner meta={MEMORY_META} generate={generate} Question={Question} />;
}
