"use client";
import { motion } from "motion/react";
import Link from "next/link";
import { useEffect, useState, type ComponentType } from "react";
import { IconArrowRight, IconBrain, IconDiagonal, IconGrid, IconKnight, IconPuzzle, IconSparkles, IconSquareHalf } from "@/components/ui/Icons";
import { getRatings, listSessions, onProgressChange } from "@/lib/storage/db";
import type { DrillId } from "@/lib/storage/types";
import { cn } from "@/lib/utils/cn";
import { DRILLS } from "./catalog";

const ICONS: Record<DrillId, ComponentType<{ size?: number; className?: string }>> = {
  "square-color": IconSquareHalf,
  coordinates: IconGrid,
  "knight-routes": IconKnight,
  lines: IconDiagonal,
  "where-piece": IconBrain,
  memory: IconSparkles,
  puzzles: IconPuzzle,
};

const ACCENTS = ["from-ember-400/25", "from-moon-400/25", "from-jade-400/20", "from-ember-300/20", "from-moon-300/25", "from-coral-400/20", "from-ember-400/25"];

type Progress = Partial<Record<DrillId, { rating: number; sessions: number; best: number }>>;

export function TrainHub() {
  const [progress, setProgress] = useState<Progress>({});

  useEffect(() => {
    const load = async () => {
      const [ratings, sessions] = await Promise.all([getRatings(), listSessions()]);
      const p: Progress = {};
      for (const s of sessions) {
        const cur = p[s.drill] ?? { rating: ratings.drills[s.drill]?.rating ?? 1200, sessions: 0, best: 0 };
        cur.sessions += 1;
        cur.best = Math.max(cur.best, Math.round(s.accuracy * 100));
        p[s.drill] = cur;
      }
      setProgress(p);
    };
    void load();
    return onProgressChange(() => void load());
  }, []);

  const cards = [
    ...DRILLS.map((d) => ({ id: d.id, title: d.title, tagline: d.tagline, href: `/train/${d.id}`, levels: d.levels.length })),
    { id: "puzzles" as DrillId, title: "Blindfold puzzles", tagline: "The position is given only as text. Find mate in 1–3 or the winning move, and answer in SAN.", href: "/puzzles", levels: 4 },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-10 pt-8 sm:px-6">
      <div className="rise-in">
        <h1 className="text-4xl font-semibold text-ivory-50 sm:text-5xl">
          Train your <span className="italic text-moon-300">mind&apos;s eye</span>
        </h1>
        <p className="mt-3 max-w-2xl text-ivory-300">
          Short, focused drills that build the skills blindfold chess is made of. Ten minutes a day beats an hour once a week.
        </p>
      </div>
      <motion.ul
        className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        initial="hidden"
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
      >
        {cards.map((c, i) => {
          const Icon = ICONS[c.id];
          const p = progress[c.id];
          return (
            <motion.li key={c.id} variants={{ hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } } }}>
              <Link
                href={c.href}
                data-testid={`drill-card-${c.id}`}
                className="group surface relative flex h-full flex-col overflow-hidden rounded-3xl p-5 outline-none transition-transform duration-300 hover:-translate-y-1 focus-visible:ring-2 focus-visible:ring-moon-300"
              >
                <div className={cn("pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gradient-to-br to-transparent opacity-70 blur-2xl transition-opacity group-hover:opacity-100", ACCENTS[i])} />
                <div className="relative flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-night-700 text-ivory-100 ring-1 ring-inset ring-ivory-100/10 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-[-6deg]">
                    <Icon size={22} />
                  </span>
                  <span className="text-xs text-ivory-500">{c.levels} levels</span>
                </div>
                <h2 className="relative mt-4 text-xl font-semibold text-ivory-50">{c.title}</h2>
                <p className="relative mt-1.5 flex-1 text-sm leading-relaxed text-ivory-400">{c.tagline}</p>
                <div className="relative mt-4 flex items-center justify-between border-t border-ivory-100/[0.06] pt-3 text-xs">
                  {p ? (
                    <span className="text-ivory-400">
                      Rating <span className="font-mono text-ivory-100">{p.rating}</span> · best <span className="font-mono text-jade-300">{p.best}%</span>
                    </span>
                  ) : (
                    <span className="text-ivory-500">Not started yet</span>
                  )}
                  <span className="flex items-center gap-1 font-medium text-ember-300 transition-transform group-hover:translate-x-1">
                    Train <IconArrowRight size={14} />
                  </span>
                </div>
              </Link>
            </motion.li>
          );
        })}
      </motion.ul>
    </div>
  );
}
