"use client";
import type { PieceSymbol, Square } from "chess.js";
import { Chess } from "chess.js";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { Board } from "@/components/board/Board";
import { PieceGlyph } from "@/components/board/PieceGlyph";
import { Button } from "@/components/ui/Button";
import { IconVolume } from "@/components/ui/Icons";
import { formatMoveList, PIECE_NAMES, sanToSpeech } from "@/lib/chess/notation";
import { parseSquareList, wherePieceQuestions, type MoveSequence, type WhereQ } from "@/lib/drills/generators";
import { getSequence } from "@/lib/drills/source";
import { useSettings } from "@/lib/settings/store";
import { speak, stopSpeaking, ttsSupported } from "@/lib/speech/tts";
import { mulberry32 } from "@/lib/utils/random";
import { cn } from "@/lib/utils/cn";
import { WHERE_META } from "./catalog";
import { DrillRunner, type QuestionProps } from "./DrillRunner";
import { ChoiceButtons, Prompt, Sq, SquareEntry } from "./shared";

const PLIES = [4, 8, 12, 18, 12];

type WhereRound = { seq: MoveSequence; questions: WhereQ[]; turn: "w" | "b" };

async function generate(level: number, _rng: unknown, seed: number): Promise<WhereRound> {
  const seq = await getSequence(PLIES[level - 1] ?? 8, seed);
  return { seq, questions: wherePieceQuestions(seq, mulberry32(seed + 1)), turn: new Chess(seq.fen).turn() };
}

const PIECES: PieceSymbol[] = ["k", "q", "r", "b", "n", "p"];

function PiecePicker({ onPick, locked }: { onPick: (v: string) => void; locked: boolean }) {
  const set = useSettings((s) => s.pieceSet);
  return (
    <div className="space-y-2">
      {(["w", "b"] as const).map((c) => (
        <div key={c} className="grid grid-cols-6 gap-2">
          {PIECES.map((p) => (
            <motion.button
              key={p}
              type="button"
              disabled={locked}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.92 }}
              onClick={() => onPick(`${c === "w" ? "white" : "black"} ${PIECE_NAMES[p]}`)}
              aria-label={`${c === "w" ? "White" : "Black"} ${PIECE_NAMES[p]}`}
              data-testid={`pick-${c}${p}`}
              className="aspect-square rounded-xl bg-night-750 p-1 outline-none ring-1 ring-inset ring-ivory-100/10 hover:bg-night-600 focus-visible:ring-2 focus-visible:ring-moon-300 disabled:opacity-50"
            >
              <PieceGlyph set={set} color={c} type={p} className="h-full w-full" />
            </motion.button>
          ))}
        </div>
      ))}
      <button
        type="button"
        disabled={locked}
        onClick={() => onPick("empty")}
        data-testid="pick-empty"
        className="h-11 w-full rounded-xl bg-night-750 text-sm font-semibold text-ivory-200 ring-1 ring-inset ring-ivory-100/10 hover:bg-night-600 disabled:opacity-50"
      >
        Empty square
      </button>
    </div>
  );
}

function Question({ q, level, locked, onAnswer }: QuestionProps<WhereRound>) {
  const [phase, setPhase] = useState<"read" | "ask">("read");
  const [idx, setIdx] = useState(0);
  const [marks, setMarks] = useState<boolean[]>([]);
  const [lastWrong, setLastWrong] = useState<string | null>(null);
  const audioOnly = level === 5 && ttsSupported();
  const hideInAsk = level >= 3;
  const text = formatMoveList(q.seq.sans);
  const spoken = q.seq.sans.map((s, i) => `${i % 2 === 0 ? `${Math.floor(i / 2) + 1}.` : ""} ${sanToSpeech(s)}`).join(". ");

  useEffect(() => {
    if (audioOnly) void speak(spoken, { force: true });
    return () => stopSpeaking();
  }, [audioOnly, spoken]);

  const answer = (correct: boolean, expected: string) => {
    const next = [...marks, correct];
    setMarks(next);
    setLastWrong(correct ? null : expected);
    if (next.length >= q.questions.length) {
      const credit = next.filter(Boolean).length / next.length;
      onAnswer({ correct: credit === 1, credit, items: next.length, hold: true, expected: credit < 1 ? expected : `All ${next.length} right.`, note: `Moves: ${text}` });
    } else {
      window.setTimeout(() => setIdx((i) => i + 1), correct ? 350 : 1300);
    }
  };

  const cur = q.questions[Math.min(idx, q.questions.length - 1)]!;
  const side = q.turn === "w" ? "White" : "Black";

  if (phase === "read") {
    return (
      <div>
        <Prompt sub={audioOnly ? "Listen carefully — the moves are only read aloud." : "Play these moves on the board in your head."}>The game so far</Prompt>
        {audioOnly ? (
          <div className="flex items-center gap-3 rounded-2xl bg-night-850/80 p-5 text-ivory-300 ring-1 ring-inset ring-ivory-100/10">
            <IconVolume className="text-moon-300" /> {q.seq.sans.length} plies, read aloud.
          </div>
        ) : (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-2xl bg-night-850/80 p-5 font-mono text-xl leading-relaxed text-ivory-50 ring-1 ring-inset ring-ivory-100/10"
            data-testid="where-moves"
            data-ucis={q.seq.ucis.join(" ")}
          >
            {text}
          </motion.p>
        )}
        <div className="mt-5 flex flex-wrap gap-3">
          <Button variant="primary" size="lg" onClick={() => setPhase("ask")} data-testid="where-ready">
            I&apos;m ready
          </Button>
          {ttsSupported() ? (
            <Button size="lg" icon={<IconVolume size={18} />} onClick={() => void speak(spoken, { force: true })}>
              {audioOnly ? "Repeat" : "Read aloud"}
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,400px)] md:items-start">
      <div>
        <div className="mb-4 flex gap-1.5" aria-label="Question progress">
          {q.questions.map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 flex-1 rounded-full",
                i < marks.length ? (marks[i] ? "bg-jade-400" : "bg-coral-400") : i === idx ? "bg-ember-400" : "bg-night-600",
              )}
            />
          ))}
        </div>
        {!hideInAsk ? <p className="mb-4 font-mono text-sm text-ivory-400">{text}</p> : null}
        <AnimatePresence mode="wait">
          <motion.div key={idx} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.2 }}>
            {cur.kind === "on-square" ? (
              <>
                <Prompt>
                  What is on <Sq>{cur.square}</Sq>?
                </Prompt>
                <PiecePicker locked={locked || marks.length > idx} onPick={(v) => answer(v === cur.answer, `${cur.square} has ${cur.answer === "empty" ? "nothing on it" : `a ${cur.answer}`}.`)} />
              </>
            ) : cur.kind === "where-is" ? (
              <>
                <Prompt sub={cur.answer.length > 1 ? "Any of them counts." : undefined}>
                  Where is {cur.answer.length > 1 ? "a" : "the"} {cur.color === "w" ? "white" : "black"} {PIECE_NAMES[cur.piece]}?
                </Prompt>
                <SquareEntry
                  locked={locked || marks.length > idx}
                  onSubmit={(t) => {
                    const sq = parseSquareList(t)[0] as Square | undefined;
                    answer(!!sq && cur.answer.includes(sq), `It's on ${cur.answer.join(" or ")}.`);
                  }}
                />
              </>
            ) : (
              <>
                <Prompt sub={`${side} to move.`}>
                  Is <Sq>{cur.san}</Sq> legal now?
                </Prompt>
                <ChoiceButtons<boolean>
                  locked={locked || marks.length > idx}
                  onPick={(v) => answer(v === cur.answer, `${cur.san} is ${cur.answer ? "legal" : "not legal"} here.`)}
                  choices={[
                    { value: true, label: "Legal", key: "y" },
                    { value: false, label: "Illegal", key: "n" },
                  ]}
                />
              </>
            )}
          </motion.div>
        </AnimatePresence>
        {lastWrong && !locked ? <p className="mt-3 text-sm text-coral-300">{lastWrong}</p> : null}
      </div>
      {locked ? (
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}>
          <Board fen={q.seq.fen} interactive={false} lastMove={{ from: q.seq.ucis.at(-1)!.slice(0, 2) as Square, to: q.seq.ucis.at(-1)!.slice(2, 4) as Square }} ariaLabel="Final position" />
        </motion.div>
      ) : (
        <div className="hidden aspect-square w-full items-center justify-center rounded-[10px] bg-night-900 text-sm text-ivory-500 ring-1 ring-ivory-100/[0.06] md:flex">
          The position is revealed at the end.
        </div>
      )}
    </div>
  );
}

export function WherePieceDrill() {
  return <DrillRunner meta={WHERE_META} generate={generate} Question={Question} />;
}
