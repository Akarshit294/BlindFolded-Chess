"use client";
/**
 * Shared shell for every drill: level picker, standard vs timed mode, countdown, question
 * flow with instant feedback, and an end screen that saves the session and updates the
 * drill rating.
 */
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { Button } from "@/components/ui/Button";
import { Card, SectionLabel, Segmented } from "@/components/ui/Controls";
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

export function DrillRunner<Q>({ meta, generate, Question }: Props<Q>) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [level, setLevel] = useState(1);
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
      setResult(null);
      setQ(null);
      const seed = Math.floor(rngRef.current() * 2 ** 31);
      seedRef.current = seed;
      const next = await generate(lvl, mulberry32(seed), seed);
      setQ(next);
      setQIndex((i) => i + 1);
    },
    [generate],
  );

  const begin = () => {
    rngRef.current = mulberry32(randomSeed());
    setStats(ZERO);
    setQIndex(0);
    setSummary(null);
    setCount(3);
    setPhase("countdown");
  };

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
      <div className="mx-auto w-full max-w-4xl px-4 pb-10 pt-8 sm:px-6">
        <Link href="/train" className="inline-flex items-center gap-1 rounded text-sm text-ivory-400 hover:text-ivory-100">
          <IconChevronLeft size={16} /> All drills
        </Link>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4">
          <h1 className="text-4xl font-semibold text-ivory-50 sm:text-5xl">{meta.title}</h1>
          <p className="mt-2 max-w-2xl text-ivory-300">{meta.tagline}</p>
        </motion.div>
        <Card className="mt-8 p-5 sm:p-6">
          <div className="flex items-end justify-between">
            <SectionLabel className="mb-0">Level</SectionLabel>
            <span className="text-xs text-ivory-400">
              Drill rating <span className="font-mono text-ivory-100">{rating}</span>
            </span>
          </div>
          <div role="radiogroup" aria-label="Level" className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {meta.levels.map((l, i) => {
              const active = level === i + 1;
              return (
                <motion.button
                  key={l.name}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  data-testid={`drill-level-${i + 1}`}
                  onClick={() => setLevel(i + 1)}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  className={cn(
                    "flex items-start gap-3 rounded-2xl p-3.5 text-left outline-none ring-1 ring-inset transition-colors focus-visible:ring-2 focus-visible:ring-moon-300",
                    active ? "bg-ember-400/10 ring-ember-400/60" : "bg-night-850/60 ring-ivory-100/[0.07] hover:ring-ivory-100/20",
                  )}
                >
                  <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-mono text-sm font-bold", active ? "bg-ember-400 text-night-950" : "bg-night-700 text-ivory-300")}>
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-ivory-50">{l.name}</span>
                      {bests[i + 1] !== undefined ? <span className="text-[11px] text-jade-300">best {bests[i + 1]}%</span> : null}
                    </span>
                    <span className="mt-0.5 block text-[13px] leading-snug text-ivory-400">{l.blurb}</span>
                  </span>
                </motion.button>
              );
            })}
          </div>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <div>
              <SectionLabel>Mode</SectionLabel>
              <Segmented<"standard" | "timed">
                label="Mode"
                value={timed ? "timed" : "standard"}
                onChange={(v) => setTimed(v === "timed")}
                options={[
                  { value: "standard", label: `${meta.standardCount} ${meta.unit}` },
                  { value: "timed", label: `Timed · ${meta.timedSeconds}s` },
                ]}
              />
            </div>
            <Button variant="primary" size="lg" onClick={begin} data-testid="drill-start" icon={<IconArrowRight size={18} />}>
              Start
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  /* ------------------------------------------------------------------ countdown */
  if (phase === "countdown") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center" aria-live="assertive">
        <AnimatePresence mode="popLayout">
          <motion.div
            key={count}
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.6 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="font-display text-[9rem] font-semibold leading-none text-ember-300"
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
      <div className="mx-auto w-full max-w-3xl px-4 pb-10 pt-10 sm:px-6" data-testid="drill-done">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }} className="text-center">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-ivory-500">
            {meta.title} · Level {level} · {levelMeta.name}
          </div>
          <h1 className="mt-3 text-5xl font-semibold text-ivory-50">
            <AnimatedNumber value={accuracy} suffix="%" />
          </h1>
          <p className="mt-2 text-ivory-300">
            {stats.correct} of {stats.total} correct{summary?.best ? <span className="ml-2 rounded-full bg-jade-400/15 px-2 py-0.5 text-xs font-semibold text-jade-300">New best</span> : null}
          </p>
        </motion.div>
        <motion.div
          className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4"
          initial="hidden"
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.2 } } }}
        >
          {[
            { label: "Best streak", value: <AnimatedNumber value={stats.bestStreak} /> },
            { label: "Time", value: formatDuration(summary?.durationMs ?? 0) },
            { label: "Per answer", value: stats.answered ? `${((summary?.durationMs ?? 0) / 1000 / stats.answered).toFixed(1)}s` : "—" },
            {
              label: "Drill rating",
              value: (
                <span>
                  <AnimatedNumber value={summary?.after ?? rating} />
                  <span className={cn("ml-1 text-sm", delta >= 0 ? "text-jade-300" : "text-coral-300")}>
                    {delta >= 0 ? "+" : ""}
                    {delta}
                  </span>
                </span>
              ),
            },
          ].map((s) => (
            <motion.div key={s.label} variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }} className="rounded-2xl bg-night-850/70 p-4 ring-1 ring-inset ring-ivory-100/[0.06]">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ivory-500">{s.label}</div>
              <div className="mt-1 font-display text-2xl font-semibold text-ivory-50 tabular">{s.value}</div>
            </motion.div>
          ))}
        </motion.div>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button variant="primary" size="lg" onClick={begin} icon={<IconRefresh size={18} />} data-testid="drill-again">
            Again
          </Button>
          {level < meta.levels.length ? (
            <Button
              size="lg"
              onClick={() => {
                setLevel(level + 1);
                setPhase("intro");
              }}
              icon={<IconArrowRight size={18} />}
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
    <div className="mx-auto w-full max-w-4xl px-4 pb-10 pt-6 sm:px-6" data-testid="drill-running">
      <div className="mb-5 flex items-center gap-4">
        <button
          type="button"
          onClick={() => void finish()}
          className="rounded-lg px-2 py-1 text-sm text-ivory-400 outline-none hover:text-ivory-100 focus-visible:ring-2 focus-visible:ring-moon-300"
        >
          End
        </button>
        <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-night-700" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
          <motion.div
            className={cn("absolute inset-0 origin-left rounded-full", timed && progress < 0.2 ? "bg-coral-400" : "bg-gradient-to-r from-moon-400 to-ember-400")}
            animate={{ scaleX: progress }}
            transition={timed ? { duration: 0.1, ease: "linear" } : { type: "spring", stiffness: 200, damping: 30 }}
          />
        </div>
        <div className="flex items-center gap-3 text-sm">
          {timed ? (
            <span className="flex items-center gap-1 font-mono text-ivory-200 tabular">
              <IconClock size={15} /> {Math.max(0, Math.ceil((endsAt - now) / 1000))}s
            </span>
          ) : (
            <span className="font-mono text-ivory-400 tabular">
              {Math.min(stats.answered + 1, meta.standardCount)}/{meta.standardCount}
            </span>
          )}
          <span className="font-mono font-semibold text-ivory-50 tabular" data-testid="drill-score">
            {stats.correct}
          </span>
          <AnimatePresence>
            {stats.streak >= 2 ? (
              <motion.span
                key={stats.streak}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-0.5 font-mono text-ember-300"
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
              exit={{ opacity: 0, x: -30 }}
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
          exit={{ opacity: 0, y: 6 }}
          transition={{ type: "spring", stiffness: 420, damping: 30 }}
          className={cn(
            "mt-5 flex flex-wrap items-center gap-3 rounded-2xl p-4 ring-1 ring-inset",
            result.correct ? "bg-jade-500/10 ring-jade-400/30" : "bg-coral-500/10 ring-coral-400/30",
          )}
          role="status"
          data-testid="drill-feedback"
          data-correct={result.correct}
        >
          <motion.span
            initial={{ scale: 0, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 18 }}
            className={cn("flex h-9 w-9 items-center justify-center rounded-full", result.correct ? "bg-jade-400 text-night-950" : "bg-coral-400 text-night-950")}
          >
            {result.correct ? <IconCheck size={20} /> : <IconX size={20} />}
          </motion.span>
          <div className="min-w-0 flex-1 text-sm">
            <div className={cn("font-semibold", result.correct ? "text-jade-200" : "text-coral-200")}>
              {result.correct ? (result.credit !== undefined && result.credit < 1 ? "Partly right" : "Correct") : "Not quite"}
            </div>
            {result.expected ? <div className="text-ivory-200">{result.expected}</div> : null}
            {result.note ? <div className="text-ivory-400">{result.note}</div> : null}
          </div>
          <Button size="sm" onClick={onNext} data-testid="drill-next" icon={<IconArrowRight size={15} />}>
            Next
          </Button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
