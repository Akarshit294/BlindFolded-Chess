"use client";
/**
 * Shared shell for every drill: level picker, standard vs timed mode, countdown, question
 * flow with instant feedback, and an end screen that saves the session and updates the
 * drill rating.
 */
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ComponentType, type ReactNode } from "react";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { ProgressLine } from "@/components/ui/Blocks";
import { Button } from "@/components/ui/Button";
import { FieldLabel, Panel, Segmented } from "@/components/ui/Controls";
import { DisplayTitle, PageHeader } from "@/components/ui/Display";
import { DrillVisual } from "./DrillVisual";
import { IconArrowRight, IconCheck, IconChevronLeft, IconClock, IconFire, IconRefresh, IconX } from "@/components/ui/Icons";
import { announce } from "@/lib/a11y/announcer";
import { playSound } from "@/lib/audio/sounds";
import { getRatings, listSessions, newId, saveSession, setRatings } from "@/lib/storage/db";
import type { DrillId, DrillSession } from "@/lib/storage/types";
import { DEFAULT_RATING, updateDrillRating } from "@/lib/stats/rating";
import { mulberry32, randomSeed, type Rng } from "@/lib/utils/random";
import { cn } from "@/lib/utils/cn";
import { formatDuration } from "@/lib/utils/format";

export type AnswerResult = {
  correct: boolean;
  /** Partial credit 0..1 (defaults to 1/0 from `correct`). */
  credit?: number;
  /** How many scored items this answer contained (e.g. 3 questions in one round). */
  items?: number;
  expected?: ReactNode;
  note?: ReactNode;
  /** Wait for "Next" instead of auto-advancing (for answers with a visual reveal). */
  hold?: boolean;
};

export type QuestionProps<Q> = {
  q: Q;
  level: number;
  locked: boolean;
  onAnswer: (r: AnswerResult) => void;
  result: AnswerResult | null;
};

export type DrillMeta = {
  id: DrillId;
  title: string;
  /** The page title as a thin word and a bold word. */
  display: [string, string];
  tagline: string;
  levels: Array<{ name: string; blurb: string }>;
  timedSeconds: number;
  standardCount: number;
  unit: string;
};

type Props<Q> = {
  meta: DrillMeta;
  generate: (level: number, rng: Rng, seed: number) => Q | Promise<Q>;
  Question: ComponentType<QuestionProps<Q>>;
};

type Phase = "intro" | "countdown" | "running" | "done";

type Stats = { correct: number; total: number; credit: number; streak: number; bestStreak: number; answered: number };

const ZERO: Stats = { correct: 0, total: 0, credit: 0, streak: 0, bestStreak: 0, answered: 0 };

function readLevel(id: DrillId, max: number): number {
  try {
    return Math.min(max, Math.max(1, Number(localStorage.getItem(`bf:drill-level:${id}`)) || 1));
  } catch {
    return 1;
  }
}

const noop = () => () => {};

/**
 * ?go=1 (a tap on the Train hub) starts the drill straight away, at the remembered level. Read from the router
 * (see PlayIntent): the parameter is dropped with a null-state replaceState, so the router takes the new URL too.
 */
function GoIntent({ onGo }: { onGo: () => void }) {
  const go = useSearchParams().get("go") === "1";
  useEffect(() => {
    if (!go) return;
    window.history.replaceState(null, "", window.location.pathname);
    const t = window.setTimeout(onGo, 0);
    return () => window.clearTimeout(t);
  }, [go, onGo]);
  return null;
}

export function DrillRunner<Q>({ meta, generate, Question }: Props<Q>) {
  const [phase, setPhase] = useState<Phase>("intro");
  // The level last used for this drill (localStorage), until one is picked here.
  const remembered = useSyncExternalStore(
    noop,
    () => readLevel(meta.id, meta.levels.length),
    () => 1,
  );
  const [picked, setPicked] = useState<number | null>(null);
  const level = picked ?? remembered;
  const setLevel = useCallback(
    (l: number) => {
      setPicked(l);
      try {
        localStorage.setItem(`bf:drill-level:${meta.id}`, String(l));
      } catch {
        // Private mode: the level just isn't remembered.
      }
    },
    [meta.id],
  );
  const [timed, setTimed] = useState(false);
  const [q, setQ] = useState<Q | null>(null);
  const [qIndex, setQIndex] = useState(0);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [stats, setStats] = useState<Stats>(ZERO);
  const [startedAt, setStartedAt] = useState(0);
  const [endsAt, setEndsAt] = useState(0);
  const [count, setCount] = useState(3);
  const [summary, setSummary] = useState<{ before: number; after: number; best: boolean; durationMs: number } | null>(null);
  const [rating, setRating] = useState<number>(DEFAULT_RATING);
  const [bests, setBests] = useState<Record<number, number>>({});
  const rngRef = useRef<Rng>(mulberry32(1));
  const seedRef = useRef(0);
  // Bumped for every question request and every new or ended session: a slow generator (e.g.
  // one waiting on the API) can't drop a late question into a session that has moved on.
  const requestRef = useRef(0);
  const advanceTimer = useRef<number | null>(null);
  const statsRef = useRef(stats);
  useLayoutEffect(() => {
    statsRef.current = stats;
  });
  const resultRef = useRef(result);
  useLayoutEffect(() => {
    resultRef.current = result;
  });

  // Load rating + personal bests for the intro screen.
  useEffect(() => {
    if (phase !== "intro") return;
    void getRatings().then((r) => setRating(r.drills[meta.id]?.rating ?? DEFAULT_RATING));
    void listSessions().then((all) => {
      const b: Record<number, number> = {};
      for (const s of all) if (s.drill === meta.id) b[s.level] = Math.max(b[s.level] ?? 0, Math.round(s.accuracy * 100));
      setBests(b);
    });
  }, [phase, meta.id]);

  const nextQuestion = useCallback(
    async (lvl: number) => {
      const request = ++requestRef.current;
      setResult(null);
      setQ(null);
      const seed = Math.floor(rngRef.current() * 2 ** 31);
      seedRef.current = seed;
      const next = await generate(lvl, mulberry32(seed), seed);
      if (request !== requestRef.current) return;
      setQ(next);
      setQIndex((i) => i + 1);
    },
    [generate],
  );

  const begin = useCallback(() => {
    requestRef.current++;
    rngRef.current = mulberry32(randomSeed());
    setStats(ZERO);
    setQIndex(0);
    setSummary(null);
    setCount(3);
    setPhase("countdown");
  }, []);

  // Countdown 3-2-1, then the first question.
  useEffect(() => {
    if (phase !== "countdown") return;
    playSound("tick");
    const t = window.setTimeout(() => {
      if (count > 1) {
        setCount(count - 1);
        return;
      }
      const start = Date.now();
      setPhase("running");
      setStartedAt(start);
      if (timed) setEndsAt(start + meta.timedSeconds * 1000);
      void nextQuestion(level);
    }, 520);
    return () => window.clearTimeout(t);
  }, [phase, count, level, timed, meta.timedSeconds, nextQuestion]);

  const finish = useCallback(async () => {
    if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
    requestRef.current++;
    setPhase("done");
    const s = statsRef.current;
    const durationMs = Date.now() - startedAt;
    const accuracy = s.total ? s.credit / s.total : 0;
    const ratings = await getRatings();
    const cur = ratings.drills[meta.id] ?? { rating: DEFAULT_RATING, played: 0, peak: DEFAULT_RATING };
    const all = await listSessions();
    const prevBest = Math.max(0, ...all.filter((x) => x.drill === meta.id && x.level === level).map((x) => x.accuracy));
    const after = s.total ? updateDrillRating(cur.rating, level, accuracy, cur.played) : cur.rating;
    const session: DrillSession = {
      id: newId("drill"),
      drill: meta.id,
      level,
      timed,
      startedAt,
      durationMs,
      correct: s.correct,
      total: s.total,
      accuracy,
      bestStreak: s.bestStreak,
      ratingAfter: after,
    };
    if (s.total > 0) {
      await saveSession(session);
      await setRatings({ ...ratings, drills: { ...ratings.drills, [meta.id]: { rating: after, played: cur.played + 1, peak: Math.max(cur.peak, after) } } });
    }
    setSummary({ before: cur.rating, after, best: s.total > 0 && accuracy > prevBest, durationMs });
    playSound(accuracy >= 0.8 ? "win" : accuracy >= 0.5 ? "draw" : "lose");
    announce(`Drill complete. ${s.correct} of ${s.total} correct.`);
  }, [startedAt, meta.id, level, timed]);

  // Timed mode: tick the clock and end when it runs out (unless feedback is showing).
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (phase !== "running" || !timed) return;
    const id = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= endsAt && !resultRef.current) void finish();
    }, 100);
    return () => window.clearInterval(id);
  }, [phase, timed, endsAt, finish]);

  const advance = useCallback(() => {
    if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
    advanceTimer.current = null;
    const s = statsRef.current;
    const done = timed ? Date.now() >= endsAt : s.answered >= meta.standardCount;
    if (done) void finish();
    else void nextQuestion(level);
  }, [timed, endsAt, meta.standardCount, finish, nextQuestion, level]);

  const onAnswer = useCallback(
    (r: AnswerResult) => {
      if (result) return;
      setResult(r);
      const items = r.items ?? 1;
      const credit = r.credit ?? (r.correct ? 1 : 0);
      setStats((s) => {
        const streak = r.correct ? s.streak + 1 : 0;
        if (r.correct && streak > 0 && streak % 5 === 0) playSound("streak");
        return {
          correct: s.correct + Math.round(credit * items),
          total: s.total + items,
          credit: s.credit + credit * items,
          streak,
          bestStreak: Math.max(s.bestStreak, streak),
          answered: s.answered + 1,
        };
      });
      playSound(r.correct ? "correct" : "wrong");
      announce(r.correct ? "Correct" : "Incorrect", "assertive");
      if (!r.hold) advanceTimer.current = window.setTimeout(advance, r.correct ? 650 : 1700);
    },
    [result, advance],
  );

  // Enter / Space advances when waiting on feedback.
  useEffect(() => {
    if (!result || phase !== "running") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === "INPUT" && e.key === " ") return;
        e.preventDefault();
        advance();
      }
    };
    const t = window.setTimeout(() => window.addEventListener("keydown", onKey), 150);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [result, phase, advance]);

  useEffect(() => () => {
    if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
  }, []);

  const progress = timed ? Math.max(0, Math.min(1, (endsAt - now) / (meta.timedSeconds * 1000))) : stats.answered / meta.standardCount;
  const levelMeta = meta.levels[level - 1]!;

  /* ------------------------------------------------------------------ intro */
  if (phase === "intro") {
    return (
      <div className="px-5 pb-10 pt-6 sm:px-8 lg:px-12 lg:pt-10">
        <Suspense fallback={null}>
          <GoIntent onGo={begin} />
        </Suspense>
        <Link href="/train" className="-my-2.5 inline-flex items-center gap-1 rounded-full py-2.5 text-small font-semibold text-muted transition-colors hover:text-ink">
          <IconChevronLeft size={16} /> All drills
        </Link>
        <PageHeader thin={meta.display[0]} bold={meta.display[1]} lead={meta.tagline} className="mt-5" />
        <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,46rem)_minmax(0,1fr)] lg:items-start xl:gap-12">
          <Panel className="max-w-3xl p-5 sm:p-6">
            <div className="flex items-baseline justify-between gap-3">
              <FieldLabel id={`levels-${meta.id}`} className="mb-0">
                Level
              </FieldLabel>
              <span className="text-small text-muted">
                Drill rating <span className="font-semibold tabular text-ink">{rating}</span>
              </span>
            </div>
            <div role="radiogroup" aria-labelledby={`levels-${meta.id}`} className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {meta.levels.map((l, i) => {
                const active = level === i + 1;
                return (
                  <button
                    key={l.name}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    data-testid={`drill-level-${i + 1}`}
                    onClick={() => setLevel(i + 1)}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-control p-3.5 text-left outline-none transition-[background,box-shadow,transform] duration-200 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--focus)] active:scale-[0.99]",
                      active ? "pill-secondary" : "hover:bg-ink/[0.05]",
                    )}
                  >
                    <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-small font-semibold tabular", active ? "bg-ink text-on-ink" : "glass-well text-ink")}>{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-ink">{l.name}</span>
                        {bests[i + 1] !== undefined ? <span className="text-caption font-semibold text-muted">best {bests[i + 1]}%</span> : null}
                      </span>
                      <span className="mt-0.5 block text-small text-muted">{l.blurb}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <div>
                <FieldLabel>Mode</FieldLabel>
                <Segmented<"standard" | "timed">
                  label="Mode"
                  value={timed ? "timed" : "standard"}
                  onChange={(v) => setTimed(v === "timed")}
                  options={[
                    { value: "standard", label: `${meta.standardCount} ${meta.unit}` },
                    { value: "timed", label: `Timed, ${meta.timedSeconds}s` },
                  ]}
                />
              </div>
              <Button variant="primary" size="lg" onClick={begin} data-testid="drill-start" trailingIcon={<IconArrowRight size={18} />}>
                Start
              </Button>
            </div>
          </Panel>
          {/* Wide screens: what the drill looks like, beside the choices (the radios above already say it all). */}
          <div className="hidden lg:block" aria-hidden="true">
            <div className="glass-panel rounded-panel p-5">
              <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-control bg-sunken/60">
                <div className="scale-[1.9]">
                  <DrillVisual id={meta.id} />
                </div>
              </div>
              <p className="mt-4 text-small text-muted">
                <span className="font-semibold text-ink">
                  Level {level}, {levelMeta.name}.
                </span>{" "}
                {levelMeta.blurb} {timed ? `As many as you can in ${meta.timedSeconds} seconds.` : `${meta.standardCount} ${meta.unit}, at your pace.`}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------------ countdown */
  if (phase === "countdown") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6" aria-live="assertive">
        <h1 className="text-small font-semibold text-muted">
          {meta.title}, level {level}: {levelMeta.name}
        </h1>
        <AnimatePresence mode="popLayout">
          <motion.div
            key={count}
            initial={{ opacity: 0, scale: 0.4, filter: "blur(10px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 1.5, filter: "blur(8px)" }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="font-display text-[9rem] font-bold leading-none text-ink"
          >
            {count > 0 ? count : "Go"}
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

  /* ------------------------------------------------------------------ done */
  if (phase === "done") {
    const accuracy = stats.total ? Math.round((stats.credit / stats.total) * 100) : 0;
    const delta = summary ? summary.after - summary.before : 0;
    return (
      <div className="px-5 pb-10 pt-10 sm:px-8 lg:px-12" data-testid="drill-done">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }} className="text-center">
          <p className="text-small font-semibold text-muted">
            {meta.title}, level {level}: {levelMeta.name}
          </p>
          <DisplayTitle as="h1" thin="Score" bold={<AnimatedNumber value={accuracy} suffix="%" />} size="xl" className="mt-4" />
          <p className="mt-3 text-body text-fg">
            {stats.correct} of {stats.total} correct
            {summary?.best ? <span className="ml-2 rounded-full bg-good px-2.5 py-0.5 text-caption font-semibold text-white">New best</span> : null}
          </p>
        </motion.div>
        <motion.dl
          className="mx-auto mt-10 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4"
          initial="hidden"
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.2 } } }}
        >
          {[
            { label: "Best streak", value: <AnimatedNumber value={stats.bestStreak} /> },
            { label: "Time", value: formatDuration(summary?.durationMs ?? 0) },
            { label: "Per answer", value: stats.answered ? `${((summary?.durationMs ?? 0) / 1000 / stats.answered).toFixed(1)}s` : "–" },
            {
              label: "Drill rating",
              value: (
                <span>
                  <AnimatedNumber value={summary?.after ?? rating} />
                  <span className={cn("ml-1.5 font-sans text-small font-semibold", delta >= 0 ? "text-good" : "text-bad")}>
                    {delta >= 0 ? "+" : ""}
                    {delta}
                  </span>
                </span>
              ),
            },
          ].map((st) => (
            <motion.div key={st.label} variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }} className="glass-panel rounded-panel p-4">
              <dt className="text-small text-muted">{st.label}</dt>
              <dd className="mt-2 font-display text-[1.875rem] font-bold leading-none tabular text-ink">{st.value}</dd>
            </motion.div>
          ))}
        </motion.dl>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Button variant="primary" size="lg" onClick={begin} icon={<IconRefresh size={18} />} data-testid="drill-again">
            Again
          </Button>
          {level < meta.levels.length ? (
            <Button
              size="lg"
              onClick={() => {
                setLevel(level + 1);
                begin();
              }}
              trailingIcon={<IconArrowRight size={18} />}
            >
              Next level
            </Button>
          ) : null}
          <Button variant="ghost" size="lg" onClick={() => setPhase("intro")}>
            Change level
          </Button>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------------ running */
  return (
    <div className="px-5 pb-10 pt-4 sm:px-8 lg:px-12 lg:pt-6" data-testid="drill-running">
      <h1 className="sr-only">
        {meta.title}, level {level}
      </h1>
      <div className="mb-7 flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => void finish()}>
          End
        </Button>
        <ProgressLine value={progress} label={timed ? "Time left" : "Progress"} tone={timed && progress < 0.2 ? "bad" : "ink"} className="flex-1" />
        <div className="flex items-center gap-3 text-small">
          {timed ? (
            <span className="flex items-center gap-1 font-semibold tabular text-ink">
              <IconClock size={15} /> {Math.max(0, Math.ceil((endsAt - now) / 1000))}s
            </span>
          ) : (
            <span className="tabular text-muted">
              {Math.min(stats.answered + 1, meta.standardCount)}/{meta.standardCount}
            </span>
          )}
          <span className="glass-well rounded-full px-2.5 py-0.5 font-semibold tabular text-ink" data-testid="drill-score" aria-label={`Score ${stats.correct}`}>
            {stats.correct}
          </span>
          <AnimatePresence>
            {stats.streak >= 2 ? (
              <motion.span
                key={stats.streak}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-0.5 font-semibold tabular text-ink"
                aria-label={`Streak ${stats.streak}`}
              >
                <IconFire size={15} />
                {stats.streak}
              </motion.span>
            ) : null}
          </AnimatePresence>
        </div>
      </div>

      <div className="relative">
        <AnimatePresence mode="wait" initial={false}>
          {q ? (
            <motion.div
              key={qIndex}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30, transition: { duration: 0.16 } }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            >
              <Question q={q} level={level} locked={!!result} onAnswer={onAnswer} result={result} />
            </motion.div>
          ) : (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3" aria-busy="true">
              <div className="skeleton h-10 w-2/3" />
              <div className="skeleton h-64 w-full" />
            </motion.div>
          )}
        </AnimatePresence>
        <Feedback result={result} onNext={advance} />
      </div>
    </div>
  );
}

function Feedback({ result, onNext }: { result: AnswerResult | null; onNext: () => void }) {
  return (
    <AnimatePresence>
      {result ? (
        <motion.div
          key="fb"
          initial={{ opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 6, transition: { duration: 0.15 } }}
          transition={{ type: "spring", stiffness: 420, damping: 30 }}
          className="glass-panel mt-6 flex flex-wrap items-center gap-3 rounded-panel p-4"
          role="status"
          data-testid="drill-feedback"
          data-correct={result.correct}
        >
          <motion.span
            initial={{ scale: 0, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 18 }}
            className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white", result.correct ? "bg-good" : "bg-bad")}
          >
            {result.correct ? <IconCheck size={20} strokeWidth={2.2} /> : <IconX size={20} strokeWidth={2.2} />}
          </motion.span>
          <div className="min-w-0 flex-1 text-[0.9375rem]">
            <div className={cn("font-semibold", result.correct ? "text-good" : "text-bad")}>
              {result.correct ? (result.credit !== undefined && result.credit < 1 ? "Partly right" : "Correct") : "Not quite"}
            </div>
            {result.expected ? <div className="text-fg">{result.expected}</div> : null}
            {result.note ? <div className="text-small text-muted">{result.note}</div> : null}
          </div>
          <Button size="sm" variant="primary" onClick={onNext} data-testid="drill-next" trailingIcon={<IconArrowRight size={15} />}>
            Next
          </Button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
