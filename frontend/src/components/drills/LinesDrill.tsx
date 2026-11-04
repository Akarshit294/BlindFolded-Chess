"use client";
import type { Square } from "chess.js";
import { useState } from "react";
import { emptyBoardReach } from "@/lib/chess/squares";
import { lineQuestion, lineQuestionText, parseSquareList, type LineQ } from "@/lib/drills/generators";
import { DrillRunner, type DrillMeta, type QuestionProps } from "./DrillRunner";
import { MiniGrid, type GridMark } from "./MiniGrid";
import { ChoiceButtons, Prompt, SquareEntry } from "./shared";

export const LINES_META: DrillMeta = {
  id: "lines",
  title: "Diagonals & lines",
  tagline: "See which squares share diagonals, ranks and files — the highways bishops, rooks and queens travel.",
  levels: [
    { name: "Same diagonal?", blurb: "Yes or no for two squares." },
    { name: "Which line?", blurb: "Diagonal, rank, file — or none." },
    { name: "In between", blurb: "Name every square between two squares." },
    { name: "Reach", blurb: "How many squares does a piece control on an empty board?" },
  ],
  timedSeconds: 90,
  standardCount: 15,
  unit: "questions",
};

function Reveal({ q }: { q: LineQ }) {
  const marks: Partial<Record<Square, GridMark>> = {};
  if (q.kind === "reach") {
    for (const s of emptyBoardReach(q.piece, q.square)) marks[s] = "soft";
    marks[q.square] = "a";
  } else {
    if (q.kind === "between") for (const s of q.answer) marks[s] = "path";
    marks[q.a] = "a";
    marks[q.b] = "b";
  }
  return <MiniGrid marks={marks} labels={q.kind === "between"} className="mx-auto max-w-[320px]" />;
}

function Question({ q, locked, onAnswer }: QuestionProps<LineQ>) {
  const [picked, setPicked] = useState<string | boolean | null>(null);
  const prompt = <Prompt>{lineQuestionText(q)}</Prompt>;

  let input: React.ReactNode = null;
  if (q.kind === "same-diagonal") {
    input = (
      <ChoiceButtons<boolean>
        locked={locked}
        correct={q.answer}
        picked={picked as boolean | null}
        onPick={(v) => {
          setPicked(v);
          onAnswer({ correct: v === q.answer, expected: `${q.a} and ${q.b} are ${q.answer ? "" : "not "}on the same diagonal.` });
        }}
        choices={[
          { value: true, label: "Yes", key: "y" },
          { value: false, label: "No", key: "n" },
        ]}
      />
    );
  } else if (q.kind === "same-line") {
    input = (
      <ChoiceButtons<string>
        columns={2}
        locked={locked}
        correct={q.answer}
        picked={picked as string | null}
        onPick={(v) => {
          setPicked(v);
          onAnswer({ correct: v === q.answer, expected: q.answer === "none" ? "They share no line." : `They share a ${q.answer}.` });
        }}
        choices={[
          { value: "diagonal", label: "Diagonal", key: "d" },
          { value: "rank", label: "Rank", key: "r" },
          { value: "file", label: "File", key: "f" },
          { value: "none", label: "None", key: "n" },
        ]}
      />
    );
  } else if (q.kind === "between") {
    input = (
      <SquareEntry
        multi
        locked={locked}
        placeholder="e.g. c3 d4"
        onSubmit={(text) => {
          const typed = new Set(parseSquareList(text));
          const want = new Set(q.answer);
          const correct = typed.size === want.size && [...want].every((s) => typed.has(s));
          onAnswer({ correct, hold: !correct, expected: `Between ${q.a} and ${q.b}: ${q.answer.join(" ")}` });
        }}
      />
    );
  } else {
    input = (
      <NumberEntry
        locked={locked}
        onSubmit={(n) => onAnswer({ correct: n === q.answer, hold: n !== q.answer, expected: `${q.answer} squares.` })}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_320px] md:items-start">
      <div>
        {prompt}
        {input}
      </div>
      {locked ? <Reveal q={q} /> : <div className="hidden md:block" />}
    </div>
  );
}

function NumberEntry({ locked, onSubmit }: { locked: boolean; onSubmit: (n: number) => void }) {
  const [v, setV] = useState("");
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!locked && v.trim()) onSubmit(Number(v));
      }}
    >
      <input
        autoFocus
        inputMode="numeric"
        value={v}
        disabled={locked}
        onChange={(e) => setV(e.target.value.replace(/[^0-9]/g, ""))}
        aria-label="Number of squares"
        data-testid="drill-input"
        className="h-12 w-32 rounded-2xl bg-night-850/90 px-4 font-mono text-lg text-ivory-50 outline-none ring-1 ring-inset ring-ivory-100/10 focus:ring-moon-400/50"
      />
      <button type="submit" disabled={locked || !v} data-testid="drill-submit" className="h-12 rounded-2xl bg-gradient-to-b from-ember-300 to-ember-500 px-5 font-semibold text-night-950 disabled:opacity-40">
        Check
      </button>
    </form>
  );
}

export function LinesDrill() {
  return <DrillRunner meta={LINES_META} generate={(level, rng) => lineQuestion(level, rng)} Question={Question} />;
}
