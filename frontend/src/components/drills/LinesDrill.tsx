"use client";
import type { Square } from "chess.js";
import { useState } from "react";
import { buttonClass } from "@/components/ui/Button";
import { emptyBoardReach } from "@/lib/chess/squares";
import { focusOnDesktop } from "@/lib/utils/hooks";
import { lineQuestion, lineQuestionText, parseSquareList, type LineQ } from "@/lib/drills/generators";
import { LINES_META } from "./catalog";
import { DrillRunner, type QuestionProps } from "./DrillRunner";
import { MiniGrid, type GridMark } from "./MiniGrid";
import { ChoiceButtons, Prompt, SquareEntry } from "./shared";

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
        ref={(el) => focusOnDesktop(el)}
        inputMode="numeric"
        value={v}
        disabled={locked}
        onChange={(e) => setV(e.target.value.replace(/[^0-9]/g, ""))}
        aria-label="Number of squares"
        data-testid="drill-input"
        className="glass-well h-12 w-32 rounded-full px-5 text-lg font-semibold tabular text-ink outline-none focus:shadow-[inset_0_0_0_1.5px_var(--ink)]"
      />
      <button type="submit" disabled={locked || !v} data-testid="drill-submit" className={buttonClass("primary", "md", "h-12 px-6")}>
        Check
      </button>
    </form>
  );
}

export function LinesDrill() {
  return <DrillRunner meta={LINES_META} generate={(level, rng) => lineQuestion(level, rng)} Question={Question} />;
}
