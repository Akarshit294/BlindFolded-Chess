"use client";
import type { Square } from "chess.js";
import { useState } from "react";
import { Board } from "@/components/board/Board";
import { coordinateQuestion, parseSquareList, type CoordinateQ } from "@/lib/drills/generators";
import { COORDINATES_META } from "./catalog";
import { DrillRunner, type QuestionProps } from "./DrillRunner";
import { Prompt, Sq, SquareEntry } from "./shared";

const EMPTY = "8/8/8/8/8/8/8/8 w - - 0 1";

function Question({ q, locked, onAnswer }: QuestionProps<CoordinateQ>) {
  const [clicked, setClicked] = useState<Square | null>(null);
  const [typed, setTyped] = useState<Square | null>(null);

  const marks: Partial<Record<Square, "good" | "bad" | "focus" | "target">> = {};
  if (q.mode === "name") marks[q.square] = locked ? (typed === q.square ? "good" : "bad") : "focus";
  if (q.mode === "find" && locked) {
    marks[q.square] = "good";
    if (clicked && clicked !== q.square) marks[clicked] = "bad";
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,440px)] md:items-start">
      <div>
        {q.mode === "find" ? (
          <Prompt sub={`Board seen from ${q.orientation === "white" ? "White" : "Black"}'s side.`}>
            Click <Sq>{q.square}</Sq>
          </Prompt>
        ) : (
          <>
            <Prompt sub={`Board seen from ${q.orientation === "white" ? "White" : "Black"}'s side.`}>Which square is lit?</Prompt>
            <SquareEntry
              locked={locked}
              onSubmit={(text) => {
                const sq = parseSquareList(text)[0] ?? null;
                setTyped(sq);
                onAnswer({ correct: sq === q.square, expected: `It was ${q.square}.` });
              }}
            />
          </>
        )}
      </div>
      <Board
        fen={EMPTY}
        orientation={q.orientation}
        interactive={false}
        coordinates={q.showCoords ? "edge" : "none"}
        marks={marks}
        onSquareClick={
          q.mode === "find" && !locked
            ? (sq) => {
                setClicked(sq);
                onAnswer({ correct: sq === q.square, expected: sq === q.square ? undefined : `You clicked ${sq}; ${q.square} is highlighted.` });
              }
            : undefined
        }
        ariaLabel="Coordinate board"
      />
    </div>
  );
}

export function CoordinatesDrill() {
  return <DrillRunner meta={COORDINATES_META} generate={(level, rng) => coordinateQuestion(level, rng)} Question={Question} />;
}
