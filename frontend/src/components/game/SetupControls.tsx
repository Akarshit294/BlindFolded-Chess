"use client";
import { AnimatePresence, motion } from "motion/react";
import { useId, useState } from "react";
import { Disclosure } from "@/components/ui/Blocks";
import { FieldLabel, Segmented } from "@/components/ui/Controls";
import { ENGINE_LEVELS, getLevel } from "@/lib/engine/levels";
import type { ColorChoice, Setup } from "@/lib/game/store";
import { VISIBILITY_MODES } from "@/lib/game/modes";
import type { GameConfig, MoveListMode, Visibility } from "@/lib/storage/types";
import { cn } from "@/lib/utils/cn";

/** Small monochrome glyph per visibility mode: the same board, more of it taken away each step. */
export function ModeGlyph({ mode, size = 40, className }: { mode: Visibility; size?: number; className?: string }) {
  const cells = [];
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++)
      cells.push(<rect key={`${r}${c}`} x={4 + c * 10.67} y={4 + r * 10.67} width="10.67" height="10.67" fill={(r + c) % 2 ? "var(--sq-dark)" : "var(--sq-light)"} />);
  const pawn = (x: number, y: number, fill: string, opacity = 1) => (
    <g opacity={opacity} transform={`translate(${x} ${y})`}>
      <circle cx="0" cy="-3.3" r="1.9" fill={fill} />
      <path d="M-1.6 -1.3h3.2l1 3.6h-5.2z" fill={fill} />
      <rect x="-2.9" y="2.1" width="5.8" height="1.4" rx=".7" fill={fill} />
    </g>
  );
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} className={className} aria-hidden="true">
      <defs>
        <clipPath id={`mg-${mode}`}>
          {mode === "blind" ? (
            <path d="M6 13c2-6 8-8 14-8 7 0 13 2 14 9 1 5-2 7-1 11 1 3 3 4 2 7-1 2-4 2-6 1-3-1-4 1-7 2-5 1-11 0-14-3-3-3-2-6-2-9 0-4-1-6 0-10z" />
          ) : (
            <rect x="4" y="4" width="32" height="32" rx="4" />
          )}
        </clipPath>
      </defs>
      <g clipPath={`url(#mg-${mode})`}>{cells}</g>
      {mode === "full" ? (
        <>
          {pawn(15.3, 17.5, "#111")}
          {pawn(26, 28.2, "#fafafa")}
        </>
      ) : null}
      {mode === "ghost" ? (
        <>
          {pawn(15.3, 17.5, "#111", 0.32)}
          {pawn(26, 28.2, "#fafafa", 0.45)}
        </>
      ) : null}
      {mode === "silhouette" ? (
        <>
          <circle cx="15.3" cy="15.3" r="3.6" fill="#6e6e6e" />
          <circle cx="26" cy="26" r="3.6" fill="#6e6e6e" />
        </>
      ) : null}
      {mode === "empty" ? (
        <g fill="none" stroke="var(--sq-coord-light)" strokeWidth="1.2" strokeLinecap="round">
          <path d="M9 31.5h3M19.7 31.5h3M30.3 31.5h3" />
        </g>
      ) : null}
      <rect x="4.5" y="4.5" width="31" height="31" rx="4" fill="none" stroke="var(--line-strong)" strokeWidth={mode === "blind" ? 0 : 1} />
    </svg>
  );
}

/** Visibility mode: five tiles, keyboard-navigable like a radio group. */
export function ModePicker({ value, onChange, compact = false }: { value: Visibility; onChange: (v: Visibility) => void; compact?: boolean }) {
  const labelId = useId();
  const current = VISIBILITY_MODES.find((m) => m.id === value)!;
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const dir = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const i = VISIBILITY_MODES.findIndex((m) => m.id === value);
    const next = VISIBILITY_MODES[(i + dir + VISIBILITY_MODES.length) % VISIBILITY_MODES.length]!;
    onChange(next.id);
    e.currentTarget.querySelectorAll<HTMLButtonElement>("button[role=radio]")[VISIBILITY_MODES.indexOf(next)]?.focus();
  };
  return (
    <div>
      <FieldLabel id={labelId}>Visibility</FieldLabel>
      <div role="radiogroup" aria-labelledby={labelId} onKeyDown={onKeyDown} className="grid grid-cols-5 gap-1.5">
        {VISIBILITY_MODES.map((m) => {
          const active = m.id === value;
          return (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={active}
              tabIndex={active ? 0 : -1}
              aria-label={`${m.name}. ${m.blurb}`}
              data-testid={`visibility-${m.id}`}
              onClick={() => onChange(m.id)}
              className={cn(
                "group flex cursor-pointer flex-col items-center gap-1.5 rounded-control px-1 pb-2 pt-2.5 outline-none transition-[background,box-shadow,transform] duration-200 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--focus)] active:scale-[0.97]",
                active ? "pill-secondary" : "hover:bg-ink/[0.05]",
              )}
            >
              <ModeGlyph mode={m.id} size={compact ? 34 : 40} className="transition-transform duration-300 group-hover:-translate-y-0.5" />
              <span className={cn("text-center text-[0.75rem] font-semibold leading-tight", active ? "text-ink" : "text-muted")}>{m.short ?? m.name}</span>
            </button>
          );
        })}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={current.id}
          initial={{ opacity: 0, y: 3 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, transition: { duration: 0.1 } }}
          transition={{ duration: 0.2 }}
          className="mt-2 text-small text-muted"
        >
          {current.blurb}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

/** Opponent: a ladder of ten levels, taller bars for stronger engines. */
export function LevelPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = getLevel(hover ?? value);
  const labelId = useId();
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const dir = e.key === "ArrowRight" || e.key === "ArrowUp" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const next = Math.max(1, Math.min(10, value + dir));
    onChange(next);
    e.currentTarget.querySelectorAll<HTMLButtonElement>("button[role=radio]")[next - 1]?.focus();
  };
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <FieldLabel id={labelId} className="mb-0">
          Opponent
        </FieldLabel>
        <span className="tabular text-small text-muted">About {shown.elo}</span>
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="font-display text-[1.75rem] font-bold uppercase leading-none tracking-[0.01em] text-ink">{shown.name}</span>
        <span className="text-small text-muted">Level {shown.id}</span>
      </div>
      <p className="mt-1 text-small text-muted">{shown.blurb}</p>
      <div role="radiogroup" aria-labelledby={labelId} onKeyDown={onKeyDown} className="mt-3 grid grid-cols-10 items-end gap-1">
        {ENGINE_LEVELS.map((l) => {
          const active = l.id === value;
          return (
            <button
              key={l.id}
              type="button"
              role="radio"
              aria-checked={active}
              tabIndex={active ? 0 : -1}
              aria-label={`Level ${l.id}: ${l.name}, about ${l.elo}`}
              data-testid={`level-${l.id}`}
              onClick={() => onChange(l.id)}
              onPointerEnter={() => setHover(l.id)}
              onPointerLeave={() => setHover(null)}
              onFocus={() => setHover(l.id)}
              onBlur={() => setHover(null)}
              className="group relative flex h-12 cursor-pointer flex-col items-center justify-end rounded-md outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]"
            >
              <span
                className={cn(
                  "w-full rounded-[5px] transition-[background,transform] duration-200 group-hover:scale-y-[1.04] group-active:scale-95",
                  active ? "bg-ink" : "bg-ink/15 group-hover:bg-ink/30",
                )}
                style={{ height: `${22 + l.id * 7.8}%`, transformOrigin: "bottom" }}
              />
              <span className={cn("absolute -bottom-5 text-[0.6875rem] font-semibold tabular", active ? "text-ink" : "text-muted")}>{l.id}</span>
            </button>
          );
        })}
      </div>
      <div className="h-5" aria-hidden="true" />
    </div>
  );
}

const TIME_CONTROLS: Array<{ value: string; label: string; tc: GameConfig["timeControl"] }> = [
  { value: "none", label: "None", tc: null },
  { value: "5+3", label: "5+3", tc: { initial: 300, increment: 3 } },
  { value: "10+5", label: "10+5", tc: { initial: 600, increment: 5 } },
  { value: "15+10", label: "15+10", tc: { initial: 900, increment: 10 } },
  { value: "30+0", label: "30+0", tc: { initial: 1800, increment: 0 } },
];

function tcKey(tc: GameConfig["timeControl"]): string {
  return TIME_CONTROLS.find((t) => t.tc?.initial === tc?.initial && t.tc?.increment === tc?.increment)?.value ?? "none";
}

/** Everything a game can be set up with. Changes are applied (and remembered) at once. */
export function SetupControls({
  setup,
  onChange,
  compact = false,
  moreOpen,
  onMoreOpenChange,
}: {
  setup: Setup;
  onChange: (patch: Partial<Setup>) => void;
  compact?: boolean;
  moreOpen?: boolean;
  onMoreOpenChange?: (open: boolean) => void;
}) {
  const ratedAllowed = setup.visibility !== "full";
  const mode = ratedAllowed ? setup.mode : "practice";
  const peeks = mode === "rated" ? Math.min(setup.peeks < 0 ? 3 : setup.peeks, 3) : setup.peeks;
  return (
    <div className={cn("flex flex-col", compact ? "gap-5" : "gap-6")}>
      <ModePicker value={setup.visibility} onChange={(v) => onChange({ visibility: v })} compact={compact} />
      <LevelPicker value={setup.levelId} onChange={(v) => onChange({ levelId: v })} />
      <div>
        <FieldLabel>Your colour</FieldLabel>
        <Segmented<ColorChoice>
          label="Your colour"
          value={setup.colorChoice}
          onChange={(v) => onChange({ colorChoice: v })}
          options={[
            { value: "w", label: "White" },
            { value: "random", label: "Random" },
            { value: "b", label: "Black" },
          ]}
        />
      </div>
      <Disclosure summary="More options: rated, clock, peeks" open={moreOpen} onOpenChange={onMoreOpenChange} testId="more-options">
        <div className="flex flex-col gap-5 pb-1 pt-2">
          <div>
            <FieldLabel>Mode</FieldLabel>
            <Segmented<"practice" | "rated">
              label="Mode"
              value={mode}
              onChange={(v) => onChange({ mode: v })}
              options={[
                { value: "practice", label: "Practice", hint: "Takebacks and move hints" },
                { value: "rated", label: "Rated", hint: "No takebacks or hints; changes your blindfold rating", disabled: !ratedAllowed },
              ]}
            />
            <p className="mt-2 text-caption text-muted">
              {mode === "rated"
                ? "No takebacks, no move hints, at most 3 peeks. Your blindfold rating changes after the game."
                : ratedAllowed
                  ? "Takebacks allowed and move hints on. Nothing is at stake."
                  : "Full-board games are warm-ups, so they are always practice."}
            </p>
          </div>
          <div>
            <FieldLabel>Clock</FieldLabel>
            <Segmented
              label="Clock"
              size="sm"
              value={tcKey(setup.timeControl)}
              onChange={(v) => onChange({ timeControl: TIME_CONTROLS.find((t) => t.value === v)?.tc ?? null })}
              options={TIME_CONTROLS.map((t) => ({ value: t.value, label: t.label }))}
            />
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <FieldLabel>Peeks</FieldLabel>
              <Segmented<number>
                label="Peeks allowed"
                size="sm"
                value={peeks}
                onChange={(v) => onChange({ peeks: v })}
                options={[
                  { value: 0, label: "0" },
                  { value: 1, label: "1" },
                  { value: 3, label: "3" },
                  { value: -1, label: "Any", ariaLabel: "Unlimited", disabled: mode === "rated" },
                ]}
              />
            </div>
            <div>
              <FieldLabel>Move list</FieldLabel>
              <Segmented<MoveListMode>
                label="Move list"
                size="sm"
                value={setup.moveList}
                onChange={(v) => onChange({ moveList: v })}
                options={[
                  { value: "full", label: "All" },
                  { value: "last", label: "Last" },
                  { value: "hidden", label: "None" },
                ]}
              />
            </div>
          </div>
        </div>
      </Disclosure>
    </div>
  );
}

/** "You play White against Candle (about 700) in Ghost mode." */
export function describeSetup(setup: Setup): string {
  const level = getLevel(setup.levelId);
  const color = setup.colorChoice === "random" ? "a random colour" : setup.colorChoice === "w" ? "White" : "Black";
  const mode = VISIBILITY_MODES.find((m) => m.id === setup.visibility)!.name;
  return `You play ${color} against ${level.name} (about ${level.elo}) in ${mode} mode.`;
}
