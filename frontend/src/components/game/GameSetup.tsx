"use client";
import { motion } from "motion/react";
import { useState } from "react";
import { PieceGlyph } from "@/components/board/PieceGlyph";
import { Button } from "@/components/ui/Button";
import { Card, SectionLabel, Segmented } from "@/components/ui/Controls";
import { EyeMorph } from "@/components/ui/EyeMorph";
import { IconArrowRight } from "@/components/ui/Icons";
import { ENGINE_LEVELS, getLevel } from "@/lib/engine/levels";
import { useGame, type ColorChoice } from "@/lib/game/store";
import { useSettings } from "@/lib/settings/store";
import type { GameConfig, MoveListMode, Visibility } from "@/lib/storage/types";
import { cn } from "@/lib/utils/cn";

export const VISIBILITY_MODES: Array<{ id: Visibility; name: string; blurb: string; difficulty: number }> = [
  { id: "full", name: "Full board", blurb: "Warm-up. Everything visible.", difficulty: 0 },
  { id: "ghost", name: "Ghost", blurb: "Pieces fade a few seconds after each move.", difficulty: 1 },
  { id: "silhouette", name: "Silhouette", blurb: "See occupied squares, not the pieces.", difficulty: 2 },
  { id: "empty", name: "Empty board", blurb: "Coordinates only. Last move flashes.", difficulty: 3 },
  { id: "blind", name: "Total blindfold", blurb: "No board at all. Just moves and your mind.", difficulty: 4 },
];

const TIME_CONTROLS: Array<{ value: string; label: string; tc: GameConfig["timeControl"] }> = [
  { value: "none", label: "No clock", tc: null },
  { value: "5+3", label: "5+3", tc: { initial: 300, increment: 3 } },
  { value: "10+5", label: "10+5", tc: { initial: 600, increment: 5 } },
  { value: "15+10", label: "15+10", tc: { initial: 900, increment: 10 } },
  { value: "30+0", label: "30+0", tc: { initial: 1800, increment: 0 } },
];

function tcKey(tc: GameConfig["timeControl"]): string {
  return TIME_CONTROLS.find((t) => t.tc?.initial === tc?.initial && t.tc?.increment === tc?.increment)?.value ?? "none";
}

export function ModePreview({ mode, active }: { mode: Visibility; active: boolean }) {
  const set = useSettings((s) => s.pieceSet);
  const cells = Array.from({ length: 16 }, (_, i) => i);
  const pieces: Record<number, { c: "w" | "b"; t: "k" | "n" | "p" | "q" }> = { 1: { c: "b", t: "k" }, 6: { c: "b", t: "n" }, 9: { c: "w", t: "q" }, 14: { c: "w", t: "k" }, 11: { c: "w", t: "p" } };
  if (mode === "blind") {
    return (
      <div className="flex aspect-square w-full items-center justify-center rounded-lg bg-night-900 text-moon-300 ring-1 ring-inset ring-ivory-100/10">
        <EyeMorph closed={active} size={34} />
      </div>
    );
  }
  return (
    <div className="grid aspect-square w-full grid-cols-4 overflow-hidden rounded-lg ring-1 ring-inset ring-ivory-100/10">
      {cells.map((i) => {
        const dark = (Math.floor(i / 4) + i) % 2 === 1;
        const p = pieces[i];
        return (
          <div key={i} className="relative flex items-center justify-center" style={{ background: dark ? "var(--sq-dark)" : "var(--sq-light)" }}>
            {mode === "empty" ? (
              <span className="font-mono text-[8px] opacity-60" style={{ color: dark ? "var(--sq-coord-dark)" : "var(--sq-coord-light)" }}>
                {"abcd"[i % 4]}
                {4 - Math.floor(i / 4)}
              </span>
            ) : p ? (
              mode === "silhouette" ? (
                <span className="h-[46%] w-[46%] rounded-full bg-[radial-gradient(circle_at_35%_30%,#eef0ff,#9ca7f0_60%,#5d66c0)]" />
              ) : (
                <motion.span
                  className="h-full w-full"
                  animate={mode === "ghost" ? { opacity: active ? [1, 1, 0.12, 0.12, 1] : 0.55 } : { opacity: 1 }}
                  transition={mode === "ghost" && active ? { duration: 3.2, repeat: Infinity, times: [0, 0.3, 0.5, 0.85, 1] } : undefined}
                >
                  <PieceGlyph set={set} color={p.c} type={p.t} className="h-full w-full" />
                </motion.span>
              )
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function GameSetup({ onStart }: { onStart: (config: GameConfig) => void }) {
  const setup = useGame((s) => s.setup);
  const setSetup = useGame((s) => s.setSetup);
  const level = getLevel(setup.levelId);
  const [hoverLevel, setHoverLevel] = useState<number | null>(null);
  const shownLevel = getLevel(hoverLevel ?? setup.levelId);
  const ratedAllowed = setup.visibility !== "full";
  const mode = ratedAllowed ? setup.mode : "practice";

  const start = () => {
    const color = setup.colorChoice === "random" ? (Math.random() < 0.5 ? "w" : "b") : setup.colorChoice;
    const peeks = mode === "rated" ? Math.min(setup.peeks < 0 ? 3 : setup.peeks, 3) : setup.peeks;
    onStart({
      playerColor: color,
      levelId: setup.levelId,
      visibility: setup.visibility,
      mode,
      timeControl: setup.timeControl,
      peeks,
      moveList: setup.moveList,
    });
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-10 pt-8 sm:px-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
        <h1 className="text-4xl font-semibold text-ivory-50 sm:text-5xl">
          Play <span className="italic text-ember-300">blindfolded</span>
        </h1>
        <p className="mt-3 max-w-2xl text-ivory-300">
          Choose how much of the board you can see, pick an opponent, and play by typing, clicking squares or speaking your moves.
        </p>
      </motion.div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card className="p-5 sm:p-6">
          <SectionLabel>Visibility</SectionLabel>
          <div role="radiogroup" aria-label="Visibility mode" className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {VISIBILITY_MODES.map((m, i) => {
              const active = setup.visibility === m.id;
              return (
                <motion.button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  data-testid={`visibility-${m.id}`}
                  onClick={() => setSetup({ visibility: m.id })}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * i, duration: 0.4 }}
                  whileHover={{ y: -3 }}
                  whileTap={{ scale: 0.97 }}
                  className={cn(
                    "group relative flex flex-col gap-2 rounded-2xl p-2.5 text-left outline-none ring-1 ring-inset transition-colors focus-visible:ring-2 focus-visible:ring-moon-300",
                    active ? "bg-ember-400/10 ring-ember-400/60" : "bg-night-850/60 ring-ivory-100/[0.07] hover:ring-ivory-100/20",
                    i === 4 && "col-span-2 sm:col-span-1",
                  )}
                >
                  <ModePreview mode={m.id} active={active} />
                  <div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[13px] font-semibold text-ivory-50">{m.name}</span>
                    </div>
                    <div className="mt-1 flex gap-0.5" aria-label={`Difficulty ${m.difficulty + 1} of 5`}>
                      {[0, 1, 2, 3, 4].map((d) => (
                        <span key={d} className={cn("h-1 flex-1 rounded-full", d <= m.difficulty ? "bg-ember-400" : "bg-night-600")} />
                      ))}
                    </div>
                    <p className="mt-1.5 text-[11.5px] leading-snug text-ivory-400">{m.blurb}</p>
                  </div>
                </motion.button>
              );
            })}
          </div>

          <div className="mt-7">
            <div className="flex items-end justify-between">
              <SectionLabel className="mb-0">Opponent</SectionLabel>
              <span className="font-mono text-xs text-ivory-400">≈{shownLevel.elo} Elo</span>
            </div>
            <div className="mt-3 flex items-baseline gap-3">
              <motion.span key={shownLevel.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="font-display text-3xl font-semibold text-ivory-50">
                {shownLevel.name}
              </motion.span>
              <span className="text-sm text-ivory-400">Level {shownLevel.id}</span>
            </div>
            <p className="mt-1 text-sm text-ivory-300">{shownLevel.blurb}</p>
            <div className="mt-4 grid grid-cols-10 gap-1.5" role="radiogroup" aria-label="Engine level">
              {ENGINE_LEVELS.map((l) => {
                const active = l.id === setup.levelId;
                return (
                  <motion.button
                    key={l.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    aria-label={`Level ${l.id}: ${l.name}, about ${l.elo} Elo`}
                    data-testid={`level-${l.id}`}
                    onClick={() => setSetup({ levelId: l.id })}
                    onMouseEnter={() => setHoverLevel(l.id)}
                    onMouseLeave={() => setHoverLevel(null)}
                    onFocus={() => setHoverLevel(l.id)}
                    onBlur={() => setHoverLevel(null)}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.92 }}
                    className={cn(
                      "relative flex h-12 flex-col items-center justify-end overflow-hidden rounded-lg pb-1 text-[11px] font-semibold outline-none ring-1 ring-inset focus-visible:ring-2 focus-visible:ring-moon-300",
                      active ? "text-night-950 ring-ember-300" : "bg-night-850 text-ivory-400 ring-ivory-100/[0.07] hover:text-ivory-100",
                    )}
                  >
                    <span
                      className={cn("absolute inset-x-0 bottom-0 rounded-t-sm transition-colors", active ? "bg-gradient-to-t from-ember-500 to-ember-300" : "bg-moon-500/25")}
                      style={{ height: `${18 + l.id * 8}%` }}
                    />
                    <span className="relative">{l.id}</span>
                  </motion.button>
                );
              })}
            </div>
          </div>
        </Card>

        <Card className="flex flex-col gap-5 p-5 sm:p-6">
          <div>
            <SectionLabel>Your colour</SectionLabel>
            <Segmented<ColorChoice>
              label="Your colour"
              value={setup.colorChoice}
              onChange={(v) => setSetup({ colorChoice: v })}
              options={[
                { value: "w", label: "White" },
                { value: "random", label: "Random" },
                { value: "b", label: "Black" },
              ]}
            />
          </div>
          <div>
            <SectionLabel>Mode</SectionLabel>
            <Segmented<"practice" | "rated">
              label="Mode"
              value={mode}
              onChange={(v) => setSetup({ mode: v })}
              options={[
                { value: "practice", label: "Practice", hint: "Takebacks, hints and unlimited options" },
                { value: "rated", label: "Rated", hint: "No takebacks or hints; changes your blindfold rating", disabled: !ratedAllowed },
              ]}
            />
            <p className="mt-2 text-xs leading-relaxed text-ivory-400">
              {mode === "rated"
                ? "No takebacks, no move hints, at most 3 peeks. Your blindfold rating changes after the game."
                : ratedAllowed
                  ? "Takebacks allowed, live move hints on. Nothing is at stake."
                  : "Full-board games are warm-ups, so they are always practice."}
            </p>
          </div>
          <div>
            <SectionLabel>Clock</SectionLabel>
            <Segmented
              label="Clock"
              size="sm"
              value={tcKey(setup.timeControl)}
              onChange={(v) => setSetup({ timeControl: TIME_CONTROLS.find((t) => t.value === v)?.tc ?? null })}
              options={TIME_CONTROLS.map((t) => ({ value: t.value, label: t.label }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <SectionLabel>Peeks</SectionLabel>
              <Segmented<number>
                label="Peeks allowed"
                size="sm"
                value={mode === "rated" ? Math.min(setup.peeks < 0 ? 3 : setup.peeks, 3) : setup.peeks}
                onChange={(v) => setSetup({ peeks: v })}
                options={[
                  { value: 0, label: "0" },
                  { value: 1, label: "1" },
                  { value: 3, label: "3" },
                  { value: -1, label: "∞", disabled: mode === "rated" },
                ]}
              />
            </div>
            <div>
              <SectionLabel>Move list</SectionLabel>
              <Segmented<MoveListMode>
                label="Move list"
                size="sm"
                value={setup.moveList}
                onChange={(v) => setSetup({ moveList: v })}
                options={[
                  { value: "full", label: "All" },
                  { value: "last", label: "Last" },
                  { value: "hidden", label: "None" },
                ]}
              />
            </div>
          </div>
          <div className="mt-auto pt-2">
            <Button variant="primary" size="lg" className="w-full" onClick={start} data-testid="start-game" icon={<IconArrowRight size={18} />}>
              Start game vs {level.name}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
