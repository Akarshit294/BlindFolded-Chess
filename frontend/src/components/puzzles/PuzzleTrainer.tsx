"use client";
/**
 * Blindfold puzzles: the position is given only as text. Find the mate or the winning move
 * and type it in SAN; the opponent's replies are announced. Peek and hints are tracked.
 */
import type { Move, Square } from "chess.js";
import { Chess } from "chess.js";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { Board } from "@/components/board/Board";
import { MeltSurface } from "@/components/board/MeltSurface";
import { PieceImage } from "@/components/board/PieceImage";
import { Confetti } from "@/components/fx/Confetti";
import { MoveInput, type MoveInputHandle } from "@/components/game/MoveInput";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { Button } from "@/components/ui/Button";
import { Badge, FieldLabel, Panel, Segmented, Toggle } from "@/components/ui/Controls";
import { PageHeader } from "@/components/ui/Display";
import { EyeMorph } from "@/components/ui/EyeMorph";
import { IconArrowRight, IconBulb, IconFlag, IconVolume } from "@/components/ui/Icons";
import { announce } from "@/lib/a11y/announcer";
import { playSound } from "@/lib/audio/sounds";
import { COLOR_NAMES, describeSide, PIECE_NAMES, piecesFromFen, sanToSpeech, speakSide } from "@/lib/chess/notation";
import { uciToMove } from "@/lib/game/rules";
import { checkStep, goalText, replyAfter, startPuzzle } from "@/lib/puzzles/logic";
import { nextPuzzle, rememberPuzzle } from "@/lib/puzzles/source";
import { GOAL_LABELS, type Puzzle, type PuzzleFilters, type PuzzleGoal } from "@/lib/puzzles/types";
import { useSettings } from "@/lib/settings/store";
import { speak } from "@/lib/speech/tts";
import { getRatings, newId, savePuzzleAttempt, setRatings } from "@/lib/storage/db";
import { updateRating } from "@/lib/stats/rating";
import { cn } from "@/lib/utils/cn";

type Difficulty = "auto" | "easy" | "medium" | "hard" | "expert";
const DIFFICULTY: Record<Exclude<Difficulty, "auto">, [number, number]> = {
  easy: [0, 1200],
  medium: [1200, 1700],
  hard: [1700, 2200],
  expert: [2200, 3500],
};

type LogEntry = { san: string; by: "you" | "them" | "setup" };
type Status = "loading" | "solving" | "solved" | "failed" | "empty";

type Prefs = { goal: PuzzleGoal | "any"; difficulty: Difficulty; maxPieces: number; applySetup: boolean };
const DEFAULT_PREFS: Prefs = { goal: "any", difficulty: "auto", maxPieces: 12, applySetup: true };

/** Puzzle filter preferences, persisted like the app settings (hydrated after mount). */
const usePuzzlePrefs = create<Prefs & { update: (patch: Partial<Prefs>) => void }>()(
  persist((set) => ({ ...DEFAULT_PREFS, update: (patch) => set(patch) }), {
    name: "bf:puzzle-prefs",
    storage: createJSONStorage(() => localStorage),
    skipHydration: true,
    partialize: ({ goal, difficulty, maxPieces, applySetup }) => ({ goal, difficulty, maxPieces, applySetup }),
  }),
);

function filtersFor(prefs: Prefs, rating: number): PuzzleFilters {
  const [minRating, maxRating] = prefs.difficulty === "auto" ? [rating - 250, rating + 250] : DIFFICULTY[prefs.difficulty];
  return { goal: prefs.goal, minRating, maxRating, maxPieces: prefs.maxPieces };
}

export function PuzzleTrainer() {
  const peekSeconds = useSettings((s) => s.peekSeconds);
  const motionPref = useSettings((s) => s.motion);
  const goal = usePuzzlePrefs((s) => s.goal);
  const difficulty = usePuzzlePrefs((s) => s.difficulty);
  const maxPieces = usePuzzlePrefs((s) => s.maxPieces);
  const applySetup = usePuzzlePrefs((s) => s.applySetup);
  const prefs: Prefs = { goal, difficulty, maxPieces, applySetup };
  const [rating, setRating] = useState(1200);
  const [solver, setSolver] = useState<"w" | "b">("w");
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [source, setSource] = useState<"server" | "bundled">("bundled");
  const [status, setStatus] = useState<Status>("loading");
  const [chess, setChess] = useState<Chess | null>(null);
  const [step, setStep] = useState(0);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [hint, setHint] = useState<string | null>(null);
  const [peeks, setPeeks] = useState(0);
  const [peeking, setPeeking] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: "good" | "bad" | "info" } | null>(null);
  const [delta, setDelta] = useState<number | null>(null);
  const [confetti, setConfetti] = useState(0);
  const [lastMove, setLastMove] = useState<Move | null>(null);
  const startedAt = useRef(0);
  const inputRef = useRef<MoveInputHandle>(null);
  const [, setFenTick] = useState(0);
  // The opponent's reply comes after a short beat; until then the solver can't act.
  const [replying, setReplying] = useState(false);
  const replyTimer = useRef<number | null>(null);
  const peekTimer = useRef<number | null>(null);
  const clearTimers = useCallback(() => {
    if (replyTimer.current !== null) window.clearTimeout(replyTimer.current);
    if (peekTimer.current !== null) window.clearTimeout(peekTimer.current);
    replyTimer.current = null;
    peekTimer.current = null;
  }, []);
  useEffect(() => clearTimers, [clearTimers]);

  const load = useCallback(async (filters: PuzzleFilters) => {
    // A reply or a peek still pending from the previous puzzle must not touch this one.
    clearTimers();
    setReplying(false);
    setPeeking(false);
    setStatus("loading");
    setMessage(null);
    setDelta(null);
    setHint(null);
    const { puzzle: p, source: src } = await nextPuzzle(filters);
    if (!p) {
      setStatus("empty");
      return;
    }
    const s = startPuzzle(p);
    setPuzzle(p);
    setSolver(s.solver);
    setSource(src);
    setChess(s.chess);
    setStep(0);
    setMistakes(0);
    setPeeks(0);
    setLastMove(s.setup);
    setLog([{ san: s.setup.san, by: "setup" }]);
    setStatus("solving");
    startedAt.current = Date.now();
    rememberPuzzle(p.id);
    announce(`New puzzle. ${goalText(p, s.solver)}`);
    window.setTimeout(() => inputRef.current?.focusSoft(), 100);
  }, [clearTimers]);

  // Preferences and rating live in the browser: read them after mount, then load a puzzle.
  useEffect(() => {
    void (async () => {
      await usePuzzlePrefs.persist.rehydrate();
      const r = await getRatings();
      setRating(r.puzzles.rating);
      await load(filtersFor(usePuzzlePrefs.getState(), r.puzzles.rating));
    })();
  }, [load]);

  const setPrefs = (patch: Partial<Prefs>) => {
    usePuzzlePrefs.getState().update(patch);
    if ("goal" in patch || "difficulty" in patch || "maxPieces" in patch) void load(filtersFor({ ...prefs, ...patch }, rating));
  };
  const nextOne = useCallback(
    () => void load(filtersFor({ goal, difficulty, maxPieces, applySetup }, rating)),
    [load, goal, difficulty, maxPieces, applySetup, rating],
  );

  const finish = useCallback(
    async (solved: boolean) => {
      if (!puzzle) return;
      setStatus(solved ? "solved" : "failed");
      const clean = solved && mistakes === 0 && !hint;
      const score = clean ? (peeks > 0 ? 0.5 : 1) : 0;
      const r = await getRatings();
      const after = updateRating(r.puzzles.rating, puzzle.rating, score, r.puzzles.played);
      await setRatings({ ...r, puzzles: { rating: after, played: r.puzzles.played + 1, peak: Math.max(r.puzzles.peak, after) } });
      await savePuzzleAttempt({
        id: newId("pz"),
        puzzleId: puzzle.id,
        puzzleRating: puzzle.rating,
        goal: puzzle.goal,
        solved,
        firstTry: clean,
        mistakes,
        peeks,
        timeMs: Date.now() - startedAt.current,
        ts: Date.now(),
        ratingAfter: after,
      });
      setDelta(after - r.puzzles.rating);
      setRating(after);
      if (solved) {
        playSound("win");
        setConfetti((c) => c + 1);
        announce("Solved!", "assertive");
      } else {
        playSound("lose");
      }
    },
    [puzzle, mistakes, hint, peeks],
  );

  const onMove = (move: Move) => {
    if (!puzzle || !chess || status !== "solving" || replying) return;
    const verdict = checkStep(puzzle, step, chess, move);
    if (verdict === "wrong") {
      setMistakes((m) => m + 1);
      playSound("wrong");
      setMessage({ text: `${move.san} isn't it. Try again.`, tone: "bad" });
      announce(`${sanToSpeech(move.san)} is not the solution`, "assertive");
      return;
    }
    const played = chess.move(uciToMove(move.lan));
    setLastMove(played);
    const entries: LogEntry[] = [{ san: played.san, by: "you" }];
    playSound(played.san.includes("+") || played.san.includes("#") ? "check" : played.captured ? "capture" : "move");
    const reply = verdict === "alt-mate" ? null : replyAfter(puzzle, step);
    if (!reply || chess.isGameOver()) {
      setLog((l) => [...l, ...entries]);
      setFenTick((t) => t + 1);
      setMessage({ text: chess.isCheckmate() ? "Checkmate!" : "Solved — that wins.", tone: "good" });
      void finish(true);
      return;
    }
    // Opponent replies after a beat.
    setMessage({ text: "Correct. Keep going…", tone: "good" });
    playSound("correct");
    setReplying(true);
    replyTimer.current = window.setTimeout(() => {
      replyTimer.current = null;
      setReplying(false);
      const r = chess.move(uciToMove(reply));
      setLastMove(r);
      setLog((l) => [...l, { san: r.san, by: "them" }]);
      setStep((s) => s + 1);
      setFenTick((t) => t + 1);
      playSound(r.captured ? "capture" : "move");
      const text = `${COLOR_NAMES[r.color] === "white" ? "White" : "Black"} replies ${sanToSpeech(r.san)}`;
      announce(text);
      void speak(sanToSpeech(r.san));
      setMessage({ text: `${text.replace(sanToSpeech(r.san), r.san)}. Your move.`, tone: "info" });
    }, 500);
    setLog((l) => [...l, ...entries]);
    setFenTick((t) => t + 1);
  };

  const showHint = () => {
    if (!puzzle || !chess || status !== "solving" || replying) return;
    const expected = puzzle.moves[1 + step * 2]!;
    const piece = chess.get(expected.slice(0, 2) as Square);
    const text = piece ? `Look at your ${PIECE_NAMES[piece.type]} on ${expected.slice(0, 2)}.` : "Look for checks.";
    setHint(text);
    setMessage({ text, tone: "info" });
    announce(text);
  };

  const peek = () => {
    if (status !== "solving" || peeking) return;
    setPeeks((p) => p + 1);
    setPeeking(true);
    playSound("peek");
    peekTimer.current = window.setTimeout(() => {
      peekTimer.current = null;
      setPeeking(false);
    }, peekSeconds * 1000);
  };

  const giveUp = () => {
    if (!puzzle || !chess || status !== "solving" || replying) return;
    // Play out the rest of the solution so the reveal shows the final position.
    const rest = puzzle.moves.slice(1 + step * 2);
    const entries: LogEntry[] = [];
    let last: Move | null = null;
    for (let i = 0; i < rest.length; i++) {
      last = chess.move(uciToMove(rest[i]!));
      entries.push({ san: last.san, by: i % 2 === 0 ? "you" : "them" });
    }
    setLastMove(last);
    setLog((l) => [...l, ...entries]);
    setMessage({ text: `Solution: ${entries.map((e) => e.san).join(" ")}`, tone: "info" });
    void finish(false);
  };

  // Enter = next puzzle once finished.
  useEffect(() => {
    if (status !== "solved" && status !== "failed") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        nextOne();
      }
    };
    const t = window.setTimeout(() => window.addEventListener("keydown", onKey), 300);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [status, nextOne]);

  const startFen = puzzle ? (prefs.applySetup ? startPuzzle(puzzle).chess.fen() : puzzle.fen) : null;
  const pieces = startFen ? piecesFromFen(startFen) : [];
  const setupMove = log.find((l) => l.by === "setup");
  const done = status === "solved" || status === "failed";
  const reveal = done || peeking;
  const readAloud = () => {
    if (!startFen || !puzzle) return;
    const ps = piecesFromFen(startFen);
    const intro = prefs.applySetup ? "" : `${solver === "w" ? "Black" : "White"} is about to play ${sanToSpeech(setupMove?.san ?? "")}. `;
    void speak(`White: ${speakSide(ps, "w")}. Black: ${speakSide(ps, "b")}. ${intro}${goalText(puzzle, solver)}`, { force: true });
  };

  const still = motionPref === "reduced";
  return (
    <div className="px-5 pb-10 pt-6 sm:px-8 lg:px-12 lg:pt-10">
      <Confetti fire={confetti} />
      <PageHeader
        thin="Blindfold"
        bold="puzzles"
        lead="The position is only described in words. Build it in your head, then find the move."
        actions={
          <div className="glass-panel rounded-panel px-5 py-3 text-right">
            <div className="text-small text-muted">Puzzle rating</div>
            <div className="mt-1 font-display text-[2rem] font-bold leading-none tabular text-ink" data-testid="puzzle-rating">
              <AnimatedNumber value={rating} />
              {delta !== null ? (
                <span className={cn("ml-2 font-sans text-small font-semibold", delta >= 0 ? "text-good" : "text-bad")}>
                  {delta >= 0 ? "+" : ""}
                  {delta}
                </span>
              ) : null}
            </div>
          </div>
        }
      />

      {/* Filters */}
      <Panel className="mt-8 grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1.3fr)_minmax(0,1fr)]">
        <div>
          <FieldLabel>Goal</FieldLabel>
          <Segmented<PuzzleGoal | "any">
            label="Goal"
            size="sm"
            value={prefs.goal}
            onChange={(g) => setPrefs({ goal: g })}
            options={(["any", "mate1", "mate2", "mate3", "win"] as const).map((g) => ({
              value: g,
              label: g === "any" ? "Any" : g === "win" ? "Win" : GOAL_LABELS[g].replace("Mate in ", "M"),
              hint: g === "any" ? "Any goal" : GOAL_LABELS[g],
            }))}
          />
        </div>
        <div>
          <FieldLabel>Difficulty</FieldLabel>
          <Segmented<Difficulty>
            label="Difficulty"
            size="sm"
            value={prefs.difficulty}
            onChange={(d) => setPrefs({ difficulty: d })}
            options={[
              { value: "auto", label: "Auto", hint: "Near your puzzle rating" },
              { value: "easy", label: "Easy" },
              { value: "medium", label: "Med", ariaLabel: "Medium" },
              { value: "hard", label: "Hard" },
              { value: "expert", label: "Expert" },
            ]}
          />
        </div>
        <div className="sm:col-span-2 lg:col-span-1">
          <FieldLabel>Most pieces</FieldLabel>
          <Segmented<number>
            label="Maximum pieces"
            size="sm"
            value={prefs.maxPieces}
            onChange={(n) => setPrefs({ maxPieces: n })}
            options={[
              { value: 6, label: "6" },
              { value: 9, label: "9" },
              { value: 12, label: "12" },
              { value: 32, label: "Any" },
            ]}
          />
        </div>
      </Panel>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] lg:items-start">
        {/* Text side */}
        <Panel className="p-5 sm:p-6">
          {status === "loading" || !puzzle || !chess ? (
            status === "empty" ? (
              <div className="py-6 text-center">
                <h2 className="display text-display-md">No puzzles here</h2>
                <p className="mt-2 text-fg">No puzzles match these filters. Widen the goal, difficulty or piece count.</p>
              </div>
            ) : (
              <div className="space-y-4" aria-busy="true">
                <div className="skeleton h-6 w-40 rounded-full" />
                <div className="skeleton h-8 w-3/4" />
                <div className="skeleton h-28 w-full" />
                <div className="skeleton h-12 w-full rounded-full" />
              </div>
            )
          ) : (
            <div data-testid="puzzle" data-puzzle-id={puzzle.id}>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="ink">{GOAL_LABELS[puzzle.goal]}</Badge>
                <Badge>Rated {puzzle.rating}</Badge>
                <Badge>{puzzle.pieces} pieces</Badge>
                {source === "bundled" ? <Badge>Offline set</Badge> : null}
              </div>
              <h2 className="mt-4 text-[1.5rem] font-semibold leading-snug text-ink" data-testid="puzzle-goal">
                {goalText(puzzle, solver)}
              </h2>

              <dl className="mt-5 space-y-2" data-testid="puzzle-position">
                {(["w", "b"] as const).map((c) => (
                  <div key={c} className="glass-well relative min-h-[4.25rem] rounded-control py-3.5 pl-[4.125rem] pr-3.5">
                    <dt className="text-small font-semibold text-ink">
                      <PieceImage color={c} type="k" className="absolute left-3.5 top-3.5 h-10 w-10" />
                      {c === "w" ? "White" : "Black"}
                    </dt>
                    <dd className="mt-0.5 text-[0.9375rem] leading-relaxed text-fg">{describeSide(pieces, c) || "Nothing"}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-small text-muted">
                {prefs.applySetup ? (
                  <>
                    {solver === "w" ? "Black" : "White"} just played <strong className="font-semibold text-ink">{setupMove?.san}</strong> (already shown above).
                  </>
                ) : (
                  <>
                    First, {solver === "w" ? "Black" : "White"} plays <strong className="font-semibold text-ink">{setupMove?.san}</strong>: apply it in your head.
                  </>
                )}
              </p>

              {log.length > 1 ? (
                <ol className="mt-3 flex flex-wrap gap-1.5" aria-label="Solution so far">
                  {log.slice(1).map((e, i) => (
                    <motion.li
                      key={i}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className={cn("rounded-full px-3 py-0.5 text-small font-semibold tabular", e.by === "you" ? "bg-ink text-on-ink" : "glass-well text-ink")}
                    >
                      {e.san}
                    </motion.li>
                  ))}
                </ol>
              ) : null}

              <div className="mt-5">
                <MoveInput
                  ref={inputRef}
                  chess={chess}
                  disabled={status !== "solving" || replying}
                  hints="off"
                  placeholder="Your move in SAN, e.g. Qh7#"
                  disabledPlaceholder={replying ? "Opponent replying…" : status === "solved" ? "Solved. Press Enter for the next one" : "Puzzle over. Press Enter for the next one"}
                  onMove={onMove}
                  onIllegal={() => {
                    setMistakes((m) => m + 1);
                    setMessage({ text: "That move isn't legal in this position.", tone: "bad" });
                  }}
                />
              </div>
              <AnimatePresence mode="wait">
                {message ? (
                  <motion.p
                    key={message.text}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className={cn("px-1 text-small font-semibold", message.tone === "good" ? "text-good" : message.tone === "bad" ? "text-bad" : "text-ink")}
                    data-testid="puzzle-message"
                  >
                    {message.text}
                  </motion.p>
                ) : null}
              </AnimatePresence>

              <div className="mt-5 flex flex-wrap gap-2">
                {done ? (
                  <Button variant="primary" onClick={nextOne} trailingIcon={<IconArrowRight size={17} />} data-testid="puzzle-next">
                    Next puzzle
                  </Button>
                ) : (
                  <>
                    <Button variant="primary" onClick={peek} disabled={peeking} icon={<EyeMorph closed={!peeking} size={18} />} data-testid="puzzle-peek">
                      Peek
                    </Button>
                    <Button onClick={showHint} disabled={!!hint || replying} icon={<IconBulb size={17} />} data-testid="puzzle-hint">
                      Hint
                    </Button>
                    <Button onClick={readAloud} icon={<IconVolume size={17} />}>
                      Read aloud
                    </Button>
                    <Button variant="ghost" onClick={giveUp} disabled={replying} icon={<IconFlag size={17} />} data-testid="puzzle-giveup">
                      Show solution
                    </Button>
                  </>
                )}
              </div>
              <div className="mt-5 border-t border-line pt-3">
                <Toggle
                  checked={!prefs.applySetup}
                  onChange={(v) => setPrefs({ applySetup: !v })}
                  label="Harder: apply the opponent's last move yourself"
                  description="The position is shown before their move."
                />
              </div>
            </div>
          )}
        </Panel>

        {/* Board side: a melted pool until a peek or the end. */}
        <div className="relative">
          <AnimatePresence mode="wait" initial={false}>
            {chess && reveal ? (
              <motion.div
                key="board"
                initial={{ opacity: 0, y: 24, scale: 0.96, filter: "blur(8px)" }}
                animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: 16, scale: 0.98, filter: "blur(6px)" }}
                transition={{ type: "spring", stiffness: 260, damping: 28 }}
                className="relative"
              >
                <Board
                  fen={chess.fen()}
                  orientation={solver === "w" ? "white" : "black"}
                  lastMove={lastMove ? { from: lastMove.from, to: lastMove.to, flags: lastMove.flags, promotion: lastMove.promotion, captured: lastMove.captured } : null}
                  interactive={false}
                  checkSquare={chess.inCheck() && !chess.isCheckmate() ? (chess.findPiece({ type: "k", color: chess.turn() })[0] as Square) : null}
                  matedSquare={chess.isCheckmate() ? (chess.findPiece({ type: "k", color: chess.turn() })[0] as Square) : null}
                  ariaLabel="Puzzle board"
                />
                {status === "solved" ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 18, delay: 0.3 }}
                    className="pill-primary pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full px-7 py-3 font-display text-[2rem] font-bold uppercase leading-none"
                    data-testid="puzzle-solved"
                  >
                    Solved
                  </motion.div>
                ) : null}
              </motion.div>
            ) : (
              <motion.div
                key="veil"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="relative flex aspect-square w-full flex-col items-center justify-center gap-4 overflow-hidden rounded-[0.875rem] text-center shadow-[0_0_0_1px_var(--board-edge),0_34px_60px_-32px_rgb(0_0_0/0.5)]"
                style={{ background: "var(--sq-light)" }}
              >
                <MeltSurface melt={1} still={still} ownSquares />
                {/* A light veil so the melted board still reads through it behind the text. */}
                <div className="absolute inset-0 bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--studio-hi)_72%,transparent),color-mix(in_oklab,var(--studio-hi)_30%,transparent))] backdrop-blur-[5px]" />
                <span className="relative text-ink/70">
                  <EyeMorph closed size={44} />
                </span>
                <p className="relative max-w-[16rem] text-[0.9375rem] text-fg">The board stays hidden. Peek if you must: it is counted.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
