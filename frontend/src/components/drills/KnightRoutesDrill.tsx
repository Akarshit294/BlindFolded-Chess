"use client";
import type { Square } from "chess.js";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { Board } from "@/components/board/Board";
import { checkKnightRoute, knightRouteQuestion, parseSquareList, type KnightRouteQ } from "@/lib/drills/generators";
import { DrillRunner, type DrillMeta, type QuestionProps } from "./DrillRunner";
import { Prompt, Sq, SquareEntry } from "./shared";

export const KNIGHT_META: DrillMeta = {
  id: "knight-routes",
  title: "Knight routes",
  tagline: "Find the shortest knight path between two squares in your head. Type the squares the knight lands on.",
  levels: [
    { name: "Hops", blurb: "One or two moves away." },
    { name: "Journeys", blurb: "Exactly three moves." },
    { name: "Expeditions", blurb: "Four to six moves — corner to corner." },
    { name: "Minefield", blurb: "Avoid forbidden squares on the way." },
  ],
  timedSeconds: 120,
  standardCount: 10,
  unit: "routes",
};

function knightFen(sq: Square): string {
  const rows: string[] = [];
  for (let r = 8; r >= 1; r--) {
    let row = "";
    let empty = 0;
    for (const f of "abcdefgh") {
      if (`${f}${r}` === sq) {
        if (empty) row += String(empty);
        empty = 0;
        row += "N";
      } else empty++;
    }
    if (empty) row += String(empty);
    rows.push(row);
  }
  return `${rows.join("/")} w - - 0 1`;
}

/** After answering, the knight hops along the route on a revealed board. */
function RouteReplay({ path, blocked }: { path: Square[]; blocked: Square[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (i >= path.length - 1) return;
    const t = window.setTimeout(() => setI((x) => x + 1), i === 0 ? 450 : 620);
    return () => window.clearTimeout(t);
  }, [i, path.length]);
  const marks: Partial<Record<Square, "path" | "bad" | "target">> = {};
  for (const b of blocked) marks[b] = "bad";
  for (const p of path.slice(0, i + 1)) marks[p] = "path";
  marks[path[path.length - 1]!] = "target";
  const arrows = path.slice(0, i + 1).slice(1).map((to, k) => ({ from: path[k]!, to, color: "ember" as const }));
  return (
    <Board
      fen={knightFen(path[i]!)}
      lastMove={i > 0 ? { from: path[i - 1]!, to: path[i]! } : null}
      interactive={false}
      marks={marks}
      arrows={arrows}
      ariaLabel="Knight route"
    />
  );
}

function Question({ q, locked, onAnswer, result }: QuestionProps<KnightRouteQ>) {
  const [shown, setShown] = useState<Square[] | null>(null);
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,420px)] md:items-start">
      <div>
        <Prompt
          sub={
            q.blocked.length ? (
              <>
                Forbidden squares: <span className="font-mono text-coral-300">{q.blocked.join(" ")}</span>
              </>
            ) : (
              "Type the squares the knight visits, e.g. “c3 d5”."
            )
          }
        >
          Knight from <Sq>{q.from}</Sq> to <Sq>{q.to}</Sq>
        </Prompt>
        <SquareEntry
          multi
          locked={locked}
          placeholder="squares along the way…"
          onSubmit={(text) => {
            const typed = parseSquareList(text);
            const r = checkKnightRoute(q, typed);
            let path = typed[0] === q.from ? typed : [q.from, ...typed];
            if (path[path.length - 1] !== q.to) path = [...path, q.to];
            setShown(r.correct ? path : q.example);
            onAnswer({
              correct: r.correct,
              hold: true,
              expected: r.correct ? `${q.distance} move${q.distance === 1 ? "" : "s"} — ${q.paths} shortest route${q.paths === 1 ? "" : "s"} exist.` : `One shortest route: ${q.example.join(" → ")}`,
              note: r.reason,
            });
          }}
        />
        {!locked ? (
          <p className="mt-3 text-sm text-ivory-500">
            Shortest is <span className="text-ivory-300">{q.distance}</span> move{q.distance === 1 ? "" : "s"}. Start and end squares are optional.
          </p>
        ) : null}
      </div>
      <motion.div initial={false} animate={{ opacity: result ? 1 : 0.9 }}>
        {shown ? (
          <RouteReplay path={shown} blocked={q.blocked} />
        ) : (
          <div className="flex aspect-square w-full items-center justify-center rounded-[10px] bg-night-900 text-center text-sm text-ivory-500 ring-1 ring-ivory-100/[0.06]">
            The board appears after you answer.
          </div>
        )}
      </motion.div>
    </div>
  );
}

export function KnightRoutesDrill() {
  return <DrillRunner meta={KNIGHT_META} generate={(level, rng) => knightRouteQuestion(level, rng)} Question={Question} />;
}
