"use client";
import { useState } from "react";
import { squareColorQuestion, type SquareColorQ } from "@/lib/drills/generators";
import { DrillRunner, type DrillMeta, type QuestionProps } from "./DrillRunner";
import { MiniGrid } from "./MiniGrid";
import { ChoiceButtons, Prompt, Sq } from "./shared";

export const SQUARE_COLOR_META: DrillMeta = {
  id: "square-color",
  title: "Square colour",
  tagline: "The foundation of board vision: know the colour of any square instantly, without looking.",
  levels: [
    { name: "Guided", blurb: "A colourless grid shows where the square is." },
    { name: "Blind", blurb: "Just the square's name. Picture it." },
    { name: "Quick", blurb: "No grid, and aim for under two seconds." },
    { name: "Pairs", blurb: "Are two squares the same colour?" },
  ],
  timedSeconds: 60,
  standardCount: 20,
  unit: "squares",
};

function Swatch({ shade }: { shade: "light" | "dark" }) {
  return <span className="h-7 w-7 rounded-md ring-1 ring-inset ring-ivory-50/20" style={{ background: shade === "light" ? "var(--sq-light)" : "var(--sq-dark)" }} />;
}

function Question({ q, level, locked, onAnswer }: QuestionProps<SquareColorQ>) {
  const [picked, setPicked] = useState<string | boolean | null>(null);
  if (q.kind === "pair") {
    return (
      <div>
        <Prompt sub="Same colour or different?">
          Are <Sq>{q.a}</Sq> and <Sq>{q.b}</Sq> the same colour?
        </Prompt>
        <ChoiceButtons<boolean>
          locked={locked}
          correct={q.answer}
          picked={picked as boolean | null}
          onPick={(v) => {
            setPicked(v);
            onAnswer({ correct: v === q.answer, expected: `${q.a} and ${q.b} are ${q.answer ? "the same colour" : "different colours"}.` });
          }}
          choices={[
            { value: true, label: "Same", key: "y" },
            { value: false, label: "Different", key: "n" },
          ]}
        />
      </div>
    );
  }
  return (
    <div className="grid gap-6 md:grid-cols-[1fr_280px] md:items-center">
      <div>
        <Prompt sub={level === 3 ? "Trust your first instinct." : "Light or dark?"}>
          What colour is <Sq>{q.square}</Sq>?
        </Prompt>
        <ChoiceButtons<"light" | "dark">
          locked={locked}
          correct={q.answer}
          picked={picked as "light" | "dark" | null}
          onPick={(v) => {
            setPicked(v);
            onAnswer({ correct: v === q.answer, expected: `${q.square} is a ${q.answer} square.` });
          }}
          choices={[
            { value: "light", label: <><Swatch shade="light" /> Light</>, key: "l" },
            { value: "dark", label: <><Swatch shade="dark" /> Dark</>, key: "d" },
          ]}
        />
      </div>
      {level === 1 || locked ? (
        <MiniGrid marks={{ [q.square]: locked ? (picked === q.answer ? "good" : "bad") : "a" }} labels colored={locked} className="mx-auto max-w-[280px]" />
      ) : null}
    </div>
  );
}

export function SquareColorDrill() {
  return <DrillRunner meta={SQUARE_COLOR_META} generate={(level, rng) => squareColorQuestion(level, rng)} Question={Question} />;
}
